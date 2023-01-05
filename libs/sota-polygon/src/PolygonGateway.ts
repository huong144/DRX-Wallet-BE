import * as web3_core from 'web3-core';
import { keccak256 } from 'ethereum-cryptography/keccak';
import { AbiItem } from 'web3-utils';
import {
  Block,
  Address,
  BigNumber,
  CurrencyRegistry,
  EnvConfigRegistry,
  GatewayRegistry,
  getLogger,
  IErc20Token,
  IRawTransaction,
  ISignedRawTransaction,
  ISubmittedTransaction,
  TokenType,
  BlockchainPlatform,
  TransactionStatus,
} from 'sota-common';
import LRU from 'lru-cache';
import * as web3_types from 'web3/eth/types';
import { CustomChain, Common } from '@ethereumjs/common';
import { web3 } from './web3';
import ERC20ABI from '../config/abi/erc20.json';
import { Buffer } from 'buffer';
import { AccountBasedGateway } from 'sota-common';
const logger = getLogger('PolygonGateway');
import * as PolygonTypeConverter from './PolygonTypeConverter';
import PolygonTransaction from './PolygonTransaction';
import { Utils } from '../../sota-common';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';
const ethMaxGasPrice = EnvConfigRegistry.getCustomEnvConfig('POLYGON_MAX_GAS_PRICE');
const maxGasPrice = ethMaxGasPrice ? ethMaxGasPrice : 300000000000; // 300 gwei
const maxPriorityFeePerGas = 2000000000;
const _cacheRawTxByHash: LRU<string, web3_types.Transaction> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _cacheRawTxReceipt: LRU<string, web3_core.TransactionReceipt> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _cacheBlockNumber = {
  value: 0,
  updatedAt: 0,
  isRequesting: false,
};
const _isRequestingTx: Map<string, boolean> = new Map<string, boolean>();
const _isRequestingReceipt: Map<string, boolean> = new Map<string, boolean>();

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Polygon, () => new PolygonGateway());

export class PolygonGateway extends AccountBasedGateway {
  // tslint:disable-next-line:member-access
  readonly commonOpts: Common;
  constructor() {
    super(CurrencyRegistry.Polygon);
    this.commonOpts = Common.custom(
      EnvConfigRegistry.getCustomEnvConfig('NETWORK') !== 'testnet'
        ? CustomChain.PolygonMainnet
        : CustomChain.PolygonMumbai
    );
  }

  public async getGasPrice(useLowerNetworkFee?: boolean): Promise<BigNumber> {
    let mulNumber = 5;
    if (!!useLowerNetworkFee) {
      mulNumber = 2;
    }

    const realGasPrice = new BigNumber(await web3.eth.getGasPrice()).multipliedBy(mulNumber);
    return realGasPrice.gt(maxGasPrice) ? new BigNumber(maxGasPrice) : realGasPrice;
  }

  public getChainId(): number {
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    return Number(config.chainId);
  }

  public async getMaxFeePerGas(useLowerNetworkFee?: boolean): Promise<string> {
    let mulNumber = 3;
    if (!!useLowerNetworkFee) {
      mulNumber = 1.3;
    }
    const baseFee = (await web3.eth.getBlock('pending')).baseFeePerGas;
    const recommendTxFeePerGas = new BigNumber(baseFee + maxPriorityFeePerGas).multipliedBy(mulNumber);
    return recommendTxFeePerGas.gt(maxGasPrice)
      ? new BigNumber(maxGasPrice).toString()
      : recommendTxFeePerGas.toFixed(0);
  }

  public async constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    value: BigNumber,
    options: {
      isConsolidate: false;
      destinationTag?: string;
      useLowerNetworkFee?: boolean;
      explicitGasLimit?: number;
    }
  ): Promise<IRawTransaction> {
    let amount = web3.utils.toBN(value.toString());
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const maxFeePerGas = web3.utils.toBN(await this.getMaxFeePerGas(options.useLowerNetworkFee));
    let gasLimit = web3.utils.toBN(options.isConsolidate ? 21000 : 150000); // Maximum gas allow for Ethereum transaction
    if (options.explicitGasLimit) {
      gasLimit = web3.utils.toBN(options.explicitGasLimit);
    }
    const fee = gasLimit.mul(maxFeePerGas);

    if (options.isConsolidate) {
      amount = amount.sub(fee);
    }

    // Check whether the balance of hot wallet is enough to send
    const balance = web3.utils.toBN((await web3.eth.getBalance(fromAddress)).toString());
    if (amount.lt(web3.utils.toBN(0))) {
      throw new Error(
        `PolygonGateway::constructRawTransaction could not construct tx because of insufficient amount: \
         address=${fromAddress}, balance=${balance}, amount=${amount}, fee=${fee}`
      );
    }
    if (balance.lt(amount.add(fee))) {
      throw new Error(
        `PolygonGateway::constructRawTransaction could not construct tx because of insufficient balance: \
         address=${fromAddress}, balance=${balance}, amount=${amount}, fee=${fee}`
      );
    }

    const txParams = {
      chainId: web3.utils.toHex(this.getChainId()),
      data: '',
      gasLimit: web3.utils.toHex(options.isConsolidate ? 21000 : 150000),
      maxPriorityFeePerGas: web3.utils.toHex(maxPriorityFeePerGas),
      maxFeePerGas: web3.utils.toHex(maxFeePerGas),
      nonce: web3.utils.toHex(nonce),
      to: toAddress,
      value: web3.utils.toHex(amount),
      type: '0x02',
    };
    const common = this.checkChainId();
    const tx = FeeMarketEIP1559Transaction.fromTxData(txParams, { common });
    const unsignedTx = tx.getMessageToSign(false);
    return {
      txid: `0x${Buffer.from(keccak256(tx.serialize())).toString('hex')}`,
      unsignedRaw: unsignedTx.toString('hex'),
    };
  }

  /**
   * Re-construct raw transaction from hex string data
   * @param rawTx
   */
  public reconstructRawTx(rawTx: string): IRawTransaction {
    const common = this.checkChainId();
    const tx = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(rawTx, 'hex'), { common });
    const unsignedTx = tx.getMessageToSign(false);
    return {
      txid: `0x${Buffer.from(keccak256(tx.serialize())).toString('hex')}`,
      unsignedRaw: unsignedTx.toString('hex'),
    };
  }

  public checkChainId() {
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    let common;
    if (config.chainId === '80001') {
      common = Common.custom(CustomChain.PolygonMumbai);
    } else {
      common = Common.custom(CustomChain.PolygonMainnet);
    }
    return common;
  }

  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    if (secret.startsWith('0x')) {
      secret = secret.substr(2);
    }
    const common = await this.checkChainId();
    const privateKey = Buffer.from(secret, 'hex');
    const ethTx = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(unsignedRaw, 'hex'), { common });
    const signedTx = ethTx.sign(privateKey);

    return {
      txid: `0x${signedTx.hash().toString('hex')}`,
      signedRaw: signedTx.serialize().toString('hex'),
      unsignedRaw,
    };
  }

  public async sendRawTransaction(rawTx: string, retryCount?: number): Promise<ISubmittedTransaction> {
    const common = await this.checkChainId();
    const ethTx = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(rawTx, 'hex'), { common });
    let txid = ethTx.hash().toString('hex');
    if (!txid.startsWith('0x')) {
      txid = '0x' + txid;
    }
    if (!retryCount || isNaN(retryCount)) {
      retryCount = 0;
    }

    try {
      const receipt = await web3.eth.sendSignedTransaction(`0x${rawTx}`);
      logger.info(`PolygonGateway::sendRawTransaction infura_txid=${receipt.transactionHash}`);
      return { txid: receipt.transactionHash };
    } catch (e) {
      // Former format of error message when sending duplicate transaction
      if (e.toString().indexOf('known transaction') > -1) {
        logger.warn(e.toString());
        return { txid };
      }

      // New format of error message when sending duplicate transaction
      if (e.toString().indexOf('already known') > -1) {
        logger.warn(e.toString());
        return { txid };
      }

      // The receipt status is failed, but transaction is actually submitted to network successfully
      if (e.toString().indexOf('Transaction has been reverted by the EVM') > -1) {
        logger.warn(e.toString());
        return { txid };
      }

      // If `nonce too low` error is returned. Need to double check whether the transaction is confirmed
      if (e.toString().indexOf('nonce too low') > -1) {
        const tx = await this.getOneTransaction(txid);

        // If transaction is confirmed, it means the broadcast was successful before
        if (tx && tx.confirmations) {
          return { txid };
        }

        throw e;
      }

      if (retryCount + 1 > 5) {
        logger.error(`Too many fails sending txid=${txid} tx=${JSON.stringify(ethTx.toJSON())} err=${e.toString()}`);
        throw e;
      }

      return this.sendRawTransaction(rawTx, retryCount + 1);
    }
  }

  public async getPolygonErc20TokenInfo(contractAddress: string): Promise<IErc20Token> {
    contractAddress = this.normalizeAddress(contractAddress);
    try {
      const contract = new web3.eth.Contract(ERC20ABI as AbiItem[], contractAddress);
      const [networkSymbol, name, decimals] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.name().call(),
        contract.methods.decimals().call(),
      ]);

      const symbol = [TokenType.PolygonERC20, contractAddress].join('.');

      return {
        symbol,
        networkSymbol: networkSymbol.toLowerCase(),
        tokenType: TokenType.PolygonERC20,
        name,
        platform: BlockchainPlatform.Polygon,
        isNative: false,
        isUTXOBased: false,
        contractAddress,
        decimals,
        humanReadableScale: decimals,
        nativeScale: 0,
        // hasMemo: false,
      };
    } catch (e) {
      logger.error(
        `PolygonGateway::getPolygonErc20TokenInfo could not get info contract=${contractAddress} due to error:`
      );
      logger.error(e);
      return null;
    }
  }

  public async createAccountAsync(): Promise<web3_core.Account> {
    return web3.eth.accounts.create();
  }

  public async getRawTransaction(txid: string): Promise<web3_types.Transaction> {
    const cachedTx = _cacheRawTxByHash.get(txid);
    if (cachedTx) {
      return cachedTx;
    }

    if (_isRequestingTx.get(txid)) {
      await Utils.timeout(500);
      return this.getRawTransaction(txid);
    }

    _isRequestingTx.set(txid, true);
    // @ts-ignore
    const tx = await web3.eth.getTransaction(txid);

    _isRequestingTx.delete(txid);

    if (!tx) {
      return null;
    }

    if (!tx.blockNumber) {
      const gwName = this.constructor.name;
      throw new Error(`${gwName}::getRawTransaction tx doesn't have block number txid=${txid}`);
    }

    _cacheRawTxByHash.set(txid, tx);
    return tx;
  }

  public async getRawTransactionReceipt(txid: string): Promise<web3_core.TransactionReceipt> {
    const cachedReceipt = _cacheRawTxReceipt.get(txid);
    if (cachedReceipt) {
      return cachedReceipt;
    }

    if (_isRequestingReceipt.get(txid)) {
      await Utils.timeout(500);
      return this.getRawTransactionReceipt(txid);
    }

    _isRequestingReceipt.set(txid, true);
    const receipt = await web3.eth.getTransactionReceipt(txid);
    _isRequestingReceipt.delete(txid);
    if (!receipt) {
      const gwName = this.constructor.name;
      throw new Error(`${gwName}::getRawTransactionReceipt could not get receipt txid=${txid}`);
    }

    _cacheRawTxReceipt.set(txid, receipt);
    return receipt;
  }

  public async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    if (!txid.startsWith('0x')) {
      txid = '0x' + txid;
    }

    const tx = (await this.getOneTransaction(txid)) as PolygonTransaction;
    if (!tx || !tx.confirmations) {
      return TransactionStatus.UNKNOWN;
    }

    if (tx.confirmations < CurrencyRegistry.getCurrencyConfig(this._currency).requiredConfirmations) {
      return TransactionStatus.CONFIRMING;
    }

    if (!tx.receiptStatus) {
      return TransactionStatus.FAILED;
    }

    return TransactionStatus.COMPLETED;
  }

  /**
   * No param
   * Returns the number of blocks in the local best block chain.
   * @returns {number}: the height of latest block on the block chain
   */
  public async getBlockCount(): Promise<number> {
    const now = Utils.nowInMillis();
    const CACHE_TIME = 10000;
    if (_cacheBlockNumber.value > 0 && now - _cacheBlockNumber.updatedAt < CACHE_TIME) {
      return _cacheBlockNumber.value;
    }

    if (_cacheBlockNumber.isRequesting) {
      await Utils.timeout(500);
      return this.getBlockCount();
    }

    _cacheBlockNumber.isRequesting = true;
    // Since there're some cases that newest block is not fully broadcasted to the network
    // We decrease latest block number by 1 for safety
    const blockNum = (await web3.eth.getBlockNumber()) - 1;
    const newUpdatedAt = Utils.nowInMillis();
    _cacheBlockNumber.value = blockNum;
    _cacheBlockNumber.updatedAt = newUpdatedAt;
    _cacheBlockNumber.isRequesting = false;
    logger.debug(`PolygonGateway::getBlockCount value=${blockNum} updatedAt=${newUpdatedAt}`);
    return blockNum;
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    const gasPrice = web3.utils.toBN(await this.getMaxFeePerGas(true));
    const gasLimit = web3.utils.toBN(150000); // For ETH transaction 21000 gas is fixed
    const result = gasPrice.mul(gasLimit);
    return new BigNumber(result.toString());
  }

  /**
   * Get balance of an address
   *
   * @param {String} address: address that want to query balance
   * @returns {Number}: the current balance of address
   */
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const balance = await web3.eth.getBalance(address);
    return new BigNumber(balance.toString());
  }
  public async getAccountFromPrivateKey(privateKey: string): Promise<web3_core.Account> {
    if (privateKey.indexOf('0x') < 0) {
      privateKey = '0x' + privateKey;
    }

    if (privateKey.length !== 66) {
      throw new Error(`Invalid private key. Should be 64-byte length.`);
    }

    return web3.eth.accounts.privateKeyToAccount(privateKey);
  }
  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    const block = await web3.eth.getBlock(PolygonTypeConverter.toBlockType(blockNumber), true);
    if (!block) {
      return null;
    }

    const txids = block.transactions.map((tx: any) => (tx.hash ? tx.hash : tx.toString()));
    return new Block(Object.assign({}, block), txids);
  }
  /**
   * Get one transaction object
   *
   * @param {String} txid: the transaction hash
   * @returns {EthTransaction}: the transaction details
   */
  protected async _getOneTransaction(txid: string): Promise<PolygonTransaction> {
    let tx;
    // try {
    tx = await this.getRawTransaction(txid);
    // } catch (e) {
    //   console.log(e);
    // }
    if (!tx) {
      return null;
    }

    const [receipt, block, lastNetworkBlockNumber] = await Promise.all([
      this.getRawTransactionReceipt(txid),
      this.getOneBlock(tx.blockNumber),
      this.getBlockCount(),
    ]);

    return new PolygonTransaction(tx, block, receipt, lastNetworkBlockNumber);
  }
}
