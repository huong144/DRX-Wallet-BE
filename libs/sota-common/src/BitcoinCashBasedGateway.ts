import { inspect } from 'util';
import _ from 'lodash';
import Axios from 'axios';
import {
  Account,
  Block,
  BaseGateway,
  TransactionStatus,
  UTXOBCHBasedTransactions,
  UTXOBCHBasedTransaction,
  getLogger,
  override,
  implement,
  BigNumber,
} from '..';
import {
  ISignedRawTransaction,
  ISubmittedTransaction,
  IBCHRawVOut,
  IRawTransaction,
  IBCHInsightAddressInfo,
  IBCHInsightUtxoInfo,
  IBCHUtxoTxInfoDetail,
  IBCHInsightTxsInfo,
  IBCHUtxoTxInfo,
  IBCHUtxoBlockInfo,
  IBCHBoiledVOut,
  IBCHBitcoreUtxoInput,
  IBCHBoiledVIn,
} from './interfaces';
import { EnvConfigRegistry } from './registries';
import pLimit from 'p-limit';
import { getRedisClient } from '../src/RedisChannel';

const bchaddr = require('bchaddrjs');
import { forEachComment } from 'tslint';
import { ExceptionHandler } from 'winston';

const limit = pLimit(1);
const INSIGHT_REQUEST_MAX_RETRIES = 10;
const logger = getLogger('BitcoinCashBasedGateway');

export abstract class BitcoinCashBasedGateway extends BaseGateway {
  /**
   * Validate an address
   * @param address
   */
  @override
  public isValidAddressAsync(address: string): boolean {
    const bitcore = this.getBitCoreLib();
    const network = EnvConfigRegistry.isMainnet() ? bitcore.Networks.mainnet : bitcore.Networks.testnet;

    try {
      return bitcore.Address.isValid(address, network);
    } catch (e) {
      logger.error(`Could not validate address ${address} due to error: ${inspect(e)}`);
    }

    return false;
  }

  @implement
  public async createAccountAsync(): Promise<Account> {
    const bitcore = this.getBitCoreLib();
    const network = EnvConfigRegistry.isMainnet() ? bitcore.Networks.mainnet : bitcore.Networks.testnet;
    const privateKey = new bitcore.PrivateKey(null, network);
    const wif = privateKey.toWIF();
    const address = privateKey.toAddress();

    return {
      address: address.toString(),
      privateKey: wif,
    };
  }

  public async getAccountFromPrivateKey(rawPrivateKey: string): Promise<Account> {
    const bitcore = this.getBitCoreLib();
    const network = EnvConfigRegistry.isMainnet() ? bitcore.Networks.mainnet : bitcore.Networks.testnet;
    const privateKey = new bitcore.PrivateKey(rawPrivateKey, network);
    const address = privateKey.toAddress().toString();
    return { address, privateKey: privateKey.toWIF() };
  }

  public convertUtxoInput(utxo: IBCHInsightUtxoInfo): IBCHBitcoreUtxoInput {
    const result: IBCHBitcoreUtxoInput = {
      address: utxo.address,
      txId: utxo.mintTxid,
      outputIndex: utxo.mintIndex,
      vout: utxo.mintIndex,
      scriptPubKey: utxo.script,
      satoshis: utxo.value,
    };
    return result;
  }

  /**
   * Create a raw transaction that tranfers currencies
   * from an address (in most cast it's a hot wallet address)
   * to one or multiple addresses
   * This method is async because we need to check state of sender address
   * Errors can be throw if the sender's balance is not sufficient
   *
   * @returns {IRawTransaction}
   */
  public async constructRawTransaction(
    fromAddresses: string | string[],
    vouts: IBCHRawVOut[]
  ): Promise<IRawTransaction> {
    if (typeof fromAddresses === 'string') {
      fromAddresses = [fromAddresses];
    }
    const pickedUtxos: IBCHBitcoreUtxoInput[] = [];
    const allUtxos: IBCHBitcoreUtxoInput[] = await this.getMultiAddressesUtxos(fromAddresses);
    const totalOutputAmount: BigNumber = vouts.reduce((memo, vout) => {
      return memo.plus(vout.amount);
    }, new BigNumber(0));

    // Estimate fee to choose transaction inputs
    let totalInputAmount: BigNumber = new BigNumber(0);
    let estimatedFee: BigNumber = new BigNumber(0);
    let estimatedTxSize = vouts.length * 34 + 10; // vouts plus 10
    let isSufficientBalance = false;
    // tslint:disable-next-line:forin
    for (const utxo of allUtxos) {
      pickedUtxos.push(utxo);
      totalInputAmount = totalInputAmount.plus(utxo.satoshis);
      estimatedTxSize += 181; // additional vin
      estimatedFee = new BigNumber(estimatedTxSize * (await this.getFeeInSatoshisPerByte()));
      if (totalInputAmount.gt(new BigNumber(totalOutputAmount.plus(estimatedFee)))) {
        isSufficientBalance = true;
        break;
      }
    }

    if (!isSufficientBalance) {
      const errMsg =
        'Could not construct tx because of in sufficient balance:' +
        ` addresses=[${fromAddresses}]` +
        ` total balance=${totalInputAmount.toFixed()}` +
        ` total output=${totalOutputAmount.toFixed()}` +
        ` estimatedFee=${estimatedFee.toFixed()}`;
      throw new Error(errMsg);
    }

    return this._constructRawTransaction(pickedUtxos, vouts, estimatedFee);
  }

  //
  public async constructRawConsolidateTransaction(
    pickedUtxos: IBCHBitcoreUtxoInput[],
    toAddress: string
  ): Promise<IRawTransaction> {
    const totalInputAmount: BigNumber = pickedUtxos.reduce((memo, utxo) => {
      return memo.plus(new BigNumber(utxo.satoshis));
    }, new BigNumber(0));

    const estimatedTxSize = pickedUtxos.length * 181 + 34 + 10;
    const estimatedFee: BigNumber = new BigNumber(estimatedTxSize * (await this.getFeeInSatoshisPerByte()));
    const vout = {
      toAddress,
      amount: totalInputAmount.minus(estimatedFee),
    };

    return this._constructRawTransaction(pickedUtxos, [vout], estimatedFee);
  }

  /**
   * Sign a raw transaction with single private key
   * Most likely is used to sign transaction sent from normal hot wallet
   *
   * @param {string} unsignedRaw is result of "constructRawTransaction" method
   * @param {string} privateKey private key to sign, in string format
   *
   * @returns the signed transaction
   */
  public async signRawTransaction(unsignedRaw: string, privateKeys: string | string[]): Promise<ISignedRawTransaction> {
    let tx: any;
    if (typeof privateKeys === 'string') {
      privateKeys = [privateKeys];
    }

    try {
      tx = new (this.getBitCoreLib()).Transaction(JSON.parse(unsignedRaw));
    } catch (e) {
      throw new Error(`Couldn't sign raw tx because of wrong unsignedRaw`);
    }

    try {
      privateKeys.forEach(privateKey => {
        tx.sign(privateKey);
      });
    } catch (e) {
      logger.error(`Something went wrong while signing btc-based tx`);
      logger.error(e);
      throw new Error(`Couldn't sign raw tx because of wrong privateKey`);
    }

    const txid: string = tx.hash as string;
    const signedRaw: string = tx.serialize({
      disableDustOutputs: true,
    });

    return {
      txid,
      signedRaw,
      unsignedRaw,
    };
  }

  /**
   * Validate a transaction and broadcast it to the blockchain network
   *
   * @param {String} signedRawTx: the hex-encoded transaction data
   * @returns {String}: the transaction hash in hex
   */
  public async sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    const txid = await this._rpcClient.call<string>('sendrawtransaction', [signedRawTx]);
    return { txid };
  }

  public async getRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    const txid = await this._rpcClient.call<string>('getrawtransaction', [signedRawTx, 1]);
    return { txid };
  }

  /**
   * Re-construct raw transaction from output of "constructRawTransaction" method
   * @param rawTx
   */
  @implement
  public reconstructRawTx(rawTx: string): IRawTransaction {
    const bitcore = this.getBitCoreLib();
    const tx = new bitcore.Transaction(JSON.parse(rawTx));
    const unsignedRaw = JSON.stringify(tx.toObject());
    return {
      txid: tx.hash,
      unsignedRaw,
    };
  }

  /**
   * getBlockCount
   */
  @implement
  public async getBlockCount(): Promise<number> {
    return await this._rpcClient.call<number>('getblockcount');
  }

  public toBCHAddress(address: string): string {
    return bchaddr.toCashAddress(address).split(':')[1];
  }

  /**
   * getAddressBalance
   * @param address
   */
  @implement
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const apiEndpoint = this.getInsightAPIEndpoint();
    let response;
    try {
      const addressBCH = this.toBCHAddress(address);
      response = await Axios.get(`${apiEndpoint}/address/${addressBCH}/balance`);
    } catch (e) {
      let errMsg = '';
      if (e.response) {
        errMsg += ` status=${e.response.status} response=${JSON.stringify(e.response.data)}`;
      } else if (e.request) {
        errMsg += ` no response was received`;
      }

      throw new Error(`Could not get balance of address=${address} error=${e.toString()} info=${errMsg}`);
    }
    const addressInfo = response.data;
    return new BigNumber(addressInfo.confirmed);
  }

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {string}: the tx status
   */
  @implement
  public async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    const tx = await this.getOneTransaction(txid);
    if (!tx) {
      return TransactionStatus.UNKNOWN;
    }

    const requiredConfirmations = this.getCurrencyConfig().requiredConfirmations;
    if (tx.confirmations >= requiredConfirmations) {
      return TransactionStatus.COMPLETED;
    }

    return TransactionStatus.CONFIRMING;
  }

  @implement
  public async getOneAddressUtxos(address: string): Promise<IBCHBitcoreUtxoInput[]> {
    const apiEndpoint = this.getInsightAPIEndpoint();
    let response;
    try {
      const addressBCH = this.toBCHAddress(address);
      response = await Axios.get<IBCHInsightUtxoInfo[]>(`${apiEndpoint}/address/${addressBCH}/?unspent=true`);
    } catch (e) {
      logger.error(e);
      throw new Error(`Could not get utxos of address=${address}...`);
    }

    const utxos: IBCHInsightUtxoInfo[] = response.data.filter(utxo => utxo.spentTxid === '');
    return utxos
      .sort((a, b) => b.confirmations - a.confirmations)
      .map(utxo => {
        return this.convertUtxoInput(utxo);
      });
  }

  @implement
  public async getMultiAddressesUtxos(addresses: string[]): Promise<IBCHBitcoreUtxoInput[]> {
    const result: IBCHBitcoreUtxoInput[] = [];
    for (const address of addresses) {
      result.push(...(await this.getOneAddressUtxos(address)));
    }
    return result;
  }

  public async getOneTxVouts(txid: string, address?: string): Promise<IBCHBoiledVOut[]> {
    const apiEndpoint = this.getInsightAPIEndpoint();
    let tx;
    try {
      tx = await this.getOneTransaction(txid);
    } catch (e) {
      // throw new Error(`TODO: Handle me please...`);
      throw e;
    }
    // @ts-ignore
    const result = tx.outputs;
    return result.filter((output: IBCHBoiledVIn) => {
      if (!address) {
        return true;
      }

      if (!output.address || output.address === 'false') {
        return false;
      }

      return bchaddr.toLegacyAddress(output.address) === address;
    });
  }

  public async getMultiTxsVouts(txids: string[], address?: string): Promise<IBCHBoiledVOut[]> {
    const result: IBCHBoiledVOut[] = [];
    for (const txid of txids) {
      result.push(...(await this.getOneTxVouts(txid, address)));
    }
    return result;
  }

  public getPathBlock(
    blockNumber: string | number,
    pageNumber?: string | number,
    rowPerPage: string | number = 100
  ): string {
    const endpoint = this.getInsightAPIEndpoint();
    if (pageNumber) {
      return `${endpoint}/tx?blockHeight=${blockNumber}&paging=${pageNumber}&limit=${rowPerPage}`;
    }
    return `${endpoint}/tx?blockHeight=${blockNumber}`;
  }

  /**
   * getBlockTransactions from network
   * @param blockHash
   */
  @override
  public async getBlockTransactions(blockNumber: string | number): Promise<UTXOBCHBasedTransactions> {
    const block = await this.getOneBlock(blockNumber);
    const endpoint = this.getInsightAPIEndpoint();
    const listTxs = new UTXOBCHBasedTransactions();
    const listTxsResult = [];
    const txsUrl = this.getPathBlock(blockNumber);
    let response;
    let retryCount = 0;
    while (true) {
      try {
        response = await Axios.get<IBCHUtxoTxInfo[]>(txsUrl);
        break;
      } catch (e) {
        let errMsg = `Could not get txs of block=${blockNumber} fetching url=${txsUrl} err=${e.toString()}`;
        if (e.response) {
          errMsg += ` response=${JSON.stringify(e.response.data)} status=${e.response.status} retryCount=${retryCount}`;
        }
        logger.error(errMsg);

        if (++retryCount === INSIGHT_REQUEST_MAX_RETRIES) {
          throw new Error(`Could not get txs of block=${blockNumber} endpoint=${endpoint}`);
        }
      }
    }

    const txs: IBCHUtxoTxInfo[] = response.data;
    // tslint:disable-next-line:prefer-for-of
    for (let index = 0; index < txs.length; index++) {
      const tx = await this.getOneTransaction(txs[index].txid);
      // @ts-ignore
      listTxs.push(tx);
    }

    return listTxs;
  }

  public getInsightAPIEndpoint(): string {
    return this.getCurrencyConfig().restEndpoint;
  }

  public async getFeeInSatoshisPerByte(): Promise<number> {
    return 15;
  }

  public getParallelNetworkRequestLimit() {
    return 5;
  }

  /**
   * Construct bitcoin-based transactions from data of one block txs page (insight-api)
   */
  protected async _fetchOneBlockTxsInsightPage(
    block: Block,
    page: number,
    pageTotal: number,
    networkBlockCount: number
  ): Promise<UTXOBCHBasedTransaction[]> {
    const endpoint = this.getInsightAPIEndpoint();
    const currency = this.getCurrency();
    const blockNumber = block.number;
    let confirmations = 0;
    let pageResponse;
    let retryCount = 0;
    let data = [];
    const result: UTXOBCHBasedTransaction[] = [];
    while (true) {
      const gwName = this.constructor.name;
      const url = this.getPathBlock(blockNumber, page);
      logger.debug(`${gwName}::getBlockTransactions block=${blockNumber} pageNum=${page + 1}/${pageTotal}`);
      try {
        const key = this.getCurrency().symbol + url;
        const redisClient = getRedisClient();
        const cachedData = await redisClient.get(key);
        if (!!cachedData) {
          data = JSON.parse(cachedData);
          confirmations = networkBlockCount - blockNumber + 1;
          break;
        }

        pageResponse = await Axios.get(url);
        data = pageResponse.data;
        redisClient.setex(key, 7200000, JSON.stringify(pageResponse.data));
        break;
      } catch (e) {
        let errMsg = `Could not get txs of block=${blockNumber} page=${page} fetching url=${url} err=${e.toString()}`;
        if (e.response) {
          errMsg += ` response=${JSON.stringify(e.response.data)} status=${e.response.status} retryCount=${retryCount}`;
        }

        if (++retryCount === INSIGHT_REQUEST_MAX_RETRIES) {
          logger.fatal(`Too many fails: ${errMsg}`);
          throw new Error(errMsg);
        } else {
          logger.error(errMsg);
        }
      }
    }
    // tslint:disable-next-line:prefer-for-of
    for (let index = 0; index < data.length; index++) {
      const txRaw: UTXOBCHBasedTransaction = await this._getOneTransaction(data[index].txid);
      result.push(txRaw);
    }

    return _.compact(result);
  }

  //
  protected _constructRawTransaction(
    pickedUtxos: IBCHBitcoreUtxoInput[],
    vouts: IBCHRawVOut[],
    estimatedFee: BigNumber
  ): IRawTransaction {
    // Since @types/bitcore-lib definition is not up-to-date with original bitcore-lib
    // We need to cast Transaction into `any` type
    // Will remove type casting when @types/bitcore-lib is completed
    let tx: any;
    const totalInput: BigNumber = pickedUtxos.reduce((memo, utxo) => {
      return memo.plus(new BigNumber(utxo.satoshis));
    }, new BigNumber(0));

    const totalOutput: BigNumber = vouts.reduce((memo, vout) => {
      return memo.plus(vout.amount);
    }, new BigNumber(0));

    if (totalInput.lt(totalOutput.plus(estimatedFee))) {
      throw new Error(`Could not construct tx: input=${totalInput}, output=${totalOutput}, fee=${estimatedFee}`);
    }

    try {
      tx = new (this.getBitCoreLib()).Transaction().from(pickedUtxos) as any;
      for (const vout of vouts) {
        tx.to(bchaddr.toCashAddress(vout.toAddress), vout.amount.toNumber());
      }
      tx.fee(estimatedFee.toNumber());
      if (totalInput.gt(totalOutput.plus(estimatedFee))) {
        // tx.change(pickedUtxos[0].address); // left money for address or first from address
        tx.to(pickedUtxos[0].address, totalInput.minus(totalOutput.plus(estimatedFee)).toNumber()); // left money for address or first from address
      }
    } catch (e) {
      logger.error(`BitcoinCashBasedGateway::constructRawTransaction failed due to error:`);
      logger.error(e);
      throw new Error(`Could not construct raw tx error=${e.toString()}`);
    }
    let txid: string;
    let unsignedRaw: string;
    try {
      txid = tx.hash;
      unsignedRaw = JSON.stringify(tx.toObject());
    } catch (err) {
      logger.error(`Could not serialize tx due to error: ${err}`);
      return null;
    }

    // Make sure we can re-construct tx from the raw data
    try {
      const revivedTx = this.reconstructRawTx(unsignedRaw);
      if (txid !== revivedTx.txid) {
        throw new Error(`Revived transaction has different txid`);
      }

      if (unsignedRaw !== revivedTx.unsignedRaw) {
        throw new Error(`Revived transaction has different raw data`);
      }
    } catch (err) {
      logger.error(`Could not construct tx due to error: ${err}`);
      return null;
    }
    return { txid, unsignedRaw };
  }

  /**
   * Get block details txids: string[]*
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  @implement
  protected async _getOneBlock(blockIdentifier: string | number): Promise<Block> {
    let blockHash: string;
    if (typeof blockIdentifier === 'number') {
      blockHash = await this._rpcClient.call<string>('getblockhash', [blockIdentifier as number]);
    } else {
      blockHash = blockIdentifier;
    }

    const block = await this._rpcClient.call<IBCHUtxoBlockInfo>('getblock', [blockHash]);
    const blockProps = {
      hash: block.hash,
      number: block.height,
      timestamp: block.time,
    };

    return new Block(blockProps, block.tx);
  }

  /**
   * Get one transaction object from blockchain network
   *
   * @param {String} txid: the transaction hash
   * @returns {Transaction}: the transaction details
   */
  @implement
  protected async _getOneTransaction(txid: string): Promise<UTXOBCHBasedTransaction> {
    const apiEndpoint = this.getInsightAPIEndpoint();
    let response;
    let responseTxDetail;
    try {
      response = await Axios.get<IBCHUtxoTxInfo>(`${apiEndpoint}/tx/${txid}`);
      responseTxDetail = await Axios.get<IBCHUtxoTxInfoDetail>(`${apiEndpoint}/tx/${txid}/coins`);
    } catch (e) {
      throw e;
      // throw new Error(`TODO: Handle me please...`);
    }

    const txInfo: IBCHUtxoTxInfo = response.data;
    txInfo.inputs = responseTxDetail.data.inputs;
    txInfo.outputs = responseTxDetail.data.outputs;

    // transaction was sent, but it is being not included in any block
    // We just don't count it
    // @ts-ignore
    if (!txInfo.blockHash) {
      return null;
    }

    const block = await this.getOneBlock(txInfo.blockHash);
    return new UTXOBCHBasedTransaction(this.getCurrency(), txInfo, block);
  }

  protected abstract getBitCoreLib(): any;
}
