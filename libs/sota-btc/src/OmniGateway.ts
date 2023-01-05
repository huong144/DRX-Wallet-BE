import _ from 'lodash';
import {
  Account,
  Block,
  getLogger,
  IRawTransaction,
  ISignedRawTransaction,
  IUtxoBlockInfo,
  Transaction,
  BigNumber,
  IOmniAsset,
  AccountBasedGateway,
  BitcoinBasedTransaction,
  implement,
  ISubmittedTransaction,
  TransactionStatus,
  GatewayRegistry,
  CurrencyRegistry,
  EnvConfigRegistry,
} from 'sota-common';
import bitcore from 'bitcore-lib';
import { IOmniBalanceInfo, IOmniTxInfo, IOmniSignedTxInfo } from './OmniTypes';
import { BtcGateway } from './BtcGateway';
import { OmniTransaction } from './OmniTransaction';

const logger = getLogger('OmniGateway');

CurrencyRegistry.onOmniAssetRegistered((asset: IOmniAsset) => {
  GatewayRegistry.registerLazyCreateMethod(asset, () => new OmniGateway(asset));
});

export class OmniGateway extends AccountBasedGateway {
  protected readonly _currency: IOmniAsset;
  protected readonly _btcGateway: BtcGateway;

  public constructor(currency: IOmniAsset) {
    super(currency);
    this._btcGateway = GatewayRegistry.getGatewayInstance(CurrencyRegistry.Bitcoin) as BtcGateway;
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get balance of an address
   *
   * @param {String} address: address that want to query balance
   * @returns {Number}: the current balance of address
   */
  @implement
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const params = [address, this._currency.propertyId];
    const result = await this._rpcClient.call<IOmniBalanceInfo>('omni_getbalance', params);
    return new BigNumber(result.balance);
  }

  /**
   * constructRawTransaction construct raw transaction data without signature
   */
  @implement
  public async constructRawTransaction(
    fromAddress: string,
    toAddress: string,
    amount: BigNumber
  ): Promise<IRawTransaction> {
    const params = [this._currency.propertyId, amount.toString()];
    const [payloadSend, listUnspent, balance] = await Promise.all([
      this._rpcClient.call<string>('omni_createpayload_simplesend', params),
      this._btcGateway.getOneAddressUtxos(fromAddress),
      this.getAddressBalance(fromAddress),
    ]);

    const satoshiPerByte = 10;
    const OmniBtcDust = 546;
    let estimatedFee: number;
    let isSufficientBalance = false;
    let estimatedTxSize = 181 + 10; // one vin plus 10
    let totalInputAmount = 0;
    const pickedUtxos = [];
    for (const utxo of listUnspent) {
      pickedUtxos.push(utxo);
      totalInputAmount += utxo.satoshis;
      estimatedTxSize += 34;
      estimatedFee = estimatedTxSize * satoshiPerByte;
      if (totalInputAmount >= estimatedFee + OmniBtcDust) {
        isSufficientBalance = true;
        break;
      }
    }

    if (new BigNumber(balance).lt(amount) || !isSufficientBalance) {
      throw new Error(
        `Could not construct tx because of insufficient balance: address=${fromAddress}, amount=${amount}, fee=${totalInputAmount}`
      );
    }

    const rawTx = await this._rpcClient.call<string>('createrawtransaction', [pickedUtxos, {}]);
    const rawtxOpreturn = await this._rpcClient.call<string>('omni_createrawtx_opreturn', [rawTx, payloadSend]);
    const rawtxReference = await this._rpcClient.call<string>('omni_createrawtx_reference', [rawtxOpreturn, toAddress]);

    const length = rawtxReference.length;
    const SatoshiFactor = 1e8;
    const fee = Math.ceil((10000 * length) / 1024) / SatoshiFactor;
    const rawtxChange = await this._rpcClient.call<string>('omni_createrawtx_change', [
      rawtxReference,
      pickedUtxos,
      fromAddress,
      fee,
    ]);
    const decodeTx = await this._rpcClient.call<IOmniTxInfo>('omni_decodetransaction', [rawtxChange]);

    return {
      txid: decodeTx.txid,
      unsignedRaw: rawtxChange,
    };
  }

  @implement
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    let signedTx: IOmniSignedTxInfo;
    let decodeTx: IOmniTxInfo;
    const network = EnvConfigRegistry.isMainnet() ? bitcore.Networks.livenet : bitcore.Networks.testnet;
    const privateKey = new bitcore.PrivateKey(secret, network);
    const address = privateKey.toAddress().toString();
    const wif = privateKey.toWIF();
    logger.info(`OmniGateway::signRawTransaction using privateKey of address=${address} network=${network}`);
    try {
      signedTx = await this._rpcClient.call<IOmniSignedTxInfo>('signrawtransaction', [unsignedRaw, null, [wif]]);
      decodeTx = await this._rpcClient.call<IOmniTxInfo>('omni_decodetransaction', [signedTx.hex]);
    } catch (err) {
      let errMsg = `Could not sign raw omni tx`;

      if (err.config) {
        let jsonrpc_method: string;
        let jsonrpc_params: string;
        try {
          const jsonrpc_data = JSON.parse(err.config.data);
          jsonrpc_method = jsonrpc_data.method;
          jsonrpc_params = jsonrpc_data.params;
        } catch (e) {
          logger.error(`OmniGateway::signRawTransaction invalid requested jsonrpc data`);
        }

        errMsg += ` url=${err.config.url} jsonrpc_method=${jsonrpc_method} params=${jsonrpc_params[0]}`;
      }

      if (err.response) {
        errMsg += ` response=${JSON.stringify(err.response.data)} status=${err.response.status}`;
      } else {
        errMsg += ` response=NULL`;
      }

      throw new Error(errMsg);
    }

    return {
      txid: decodeTx.txid,
      signedRaw: signedTx.hex,
      unsignedRaw,
    };
  }

  @implement
  public async sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction> {
    return this._btcGateway.sendRawTransaction(signedRawTx);
  }

  @implement
  public async createAccountAsync(): Promise<Account> {
    return this._btcGateway.createAccountAsync();
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    return this._btcGateway.getAccountFromPrivateKey(privateKey);
  }

  @implement
  public async getBlockCount(): Promise<number> {
    return this._btcGateway.getBlockCount();
  }

  @implement
  public getTransactionStatus(txid: string): Promise<TransactionStatus> {
    return this._btcGateway.getTransactionStatus(txid);
  }

  /**
   * Get one transaction object from blockchain network
   *
   * @param {String} txid: the transaction hash
   * @returns {Transaction}: the transaction details
   */
  @implement
  protected async _getOneTransaction(txid: string): Promise<Transaction> {
    const tx = await this._rpcClient.call<IOmniTxInfo>('omni_gettransaction', [txid]);
    if (!tx.blockhash) {
      logger.info(`TX ${txid} is still not included in any block yet...`);
      return null;
    }

    if (tx.type_int !== 0 && tx.type_int !== 4) {
      logger.info(`Type of transaction ${txid} is ${tx.type}. It is un-supported now`);
      return null;
    }

    // This transaction does not belong to the asset we want to check
    if (tx.propertyid !== this._currency.propertyId) {
      return null;
    }

    const [block, btcTx] = await Promise.all([
      this._rpcClient.call<IUtxoBlockInfo>('getblock', [tx.blockhash]),
      this._btcGateway.getOneTransaction(tx.txid),
    ]);

    return new OmniTransaction(this._currency, tx, btcTx as BitcoinBasedTransaction, block);
  }

  /**
   * Get block detailstxidstxids: string[]*
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  @implement
  protected async _getOneBlock(blockIdentifier: string | number): Promise<Block> {
    let blockHash: string;
    if (typeof blockIdentifier !== 'number') {
      blockHash = blockIdentifier;
    } else {
      blockHash = await this._rpcClient.call<string>('getblockhash', [blockIdentifier as number]);
    }
    const block = await this._rpcClient.call<IUtxoBlockInfo>('getblock', [blockHash]);
    const blockNumber = block.height;
    const txids = await this._rpcClient.call<string[]>('omni_listblocktransactions', [blockNumber]);
    const blockProps = {
      hash: block.hash,
      number: block.height,
      timestamp: block.time,
    };

    return new Block(blockProps, txids);
  }
}

export default OmniGateway;
