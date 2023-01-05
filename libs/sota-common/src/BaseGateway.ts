import _ from 'lodash';
import LRU from 'lru-cache';
import util from 'util';
import {
  Account,
  Block,
  Transaction,
  Transactions,
  TransactionStatus,
  RPCClient,
  ICurrency,
  implement,
  Utils,
  BigNumber,
  getLogger,
  EnvConfigRegistry,
} from '..';
import { ICurrencyConfig, ISignedRawTransaction, ISubmittedTransaction } from './interfaces';
import CurrencyRegistry from './registries/CurrencyRegistry';
import GatewayRegistry from './registries/GatewayRegistry';
import pLimit from 'p-limit';
import { validate } from 'multicoin-address-validator';

CurrencyRegistry.onCurrencyConfigSet((currency: ICurrency, config: ICurrencyConfig) => {
  const gateway = GatewayRegistry.getGatewayInstance(currency);
  if (gateway) {
    process.nextTick(() => {
      gateway.loadCurrencyConfig();
    });
  }
});

const logger = getLogger('BaseGateway');
/**
 * The gateway provides methods/interfaces for our service
 * to connect to blockchain network
 * The method will be implemented in derived classes
 * They can be done via RPC calls, RESTful APIs, ...
 */
export abstract class BaseGateway {
  protected _cacheBlock: LRU<string | number, Block>;
  protected _cacheTxByHash: LRU<string, Transaction>;
  protected _rpcClient: RPCClient;
  protected readonly _currency: ICurrency;

  // Gateways are singletons
  // So we hide the constructor from outsiders
  protected constructor(currency: ICurrency) {
    // Initiate the caches
    this._cacheBlock = new LRU(this._getCacheOptions());
    this._cacheTxByHash = new LRU(this._getCacheOptions());
    this._currency = currency;
  }

  public getCurrency(): ICurrency {
    return this._currency;
  }

  public getCurrencyConfig(): ICurrencyConfig {
    let config = CurrencyRegistry.getCurrencyConfig(this._currency);
    if (!config) {
      const platformCurrency = CurrencyRegistry.getOneCurrency(this._currency.platform);
      config = CurrencyRegistry.getCurrencyConfig(platformCurrency);
    }

    return config;
  }

  public loadCurrencyConfig() {
    const rpcRawConfig = CurrencyRegistry.getCurrencyConfig(this._currency).rpcEndpoint;
    if (rpcRawConfig) {
      try {
        const rpcConfig = JSON.parse(rpcRawConfig);
        this._rpcClient = new RPCClient(rpcConfig);
      } catch (e) {
        logger.error(`BaseGateway::constructor could not construct RPC Client due to error: ${util.inspect(e)}`);
      }
    }
  }

  /**
   * Create a new random account/address
   * With some currencies we cannot create account with a synchronous method
   * Then now we always handle creating account by async function
   * @returns {Account} the account object
   */
  public abstract createAccountAsync(): Promise<Account>;

  public abstract getAccountFromPrivateKey(privateKey: string): Promise<Account>;

  /**
   * Check a given address is valid
   * Default just accept all value, need to be implemented on all derived classes
   *
   * @param address
   */
  public isValidAddressAsync(address: string, currency: string): boolean {
    const networkType = EnvConfigRegistry.isMainnet() ? 'prod' : 'testnet';
    const validAddress = validate(address, currency, { networkType });
    if (!validAddress) {
      return false;
    }
    return true;
  }

  /**
   * Check a given address is need tag
   * Default just accept all value, need to be implemented on all derived classes
   *
   * @param address
   */
  public async isNeedTagAsync(address: string): Promise<boolean> {
    return false;
  }

  /**
   * Handle more at extended classes
   * @param address
   */
  @implement
  public normalizeAddress(address: string): string {
    return address;
  }

  /**
   * Get one transaction object by tixd
   * Firstly looking for it from cache
   * If cache doesn't exist, then get it from blockchain network
   *
   * @param {String} txid: the transaction hash
   * @returns {Transaction}: the transaction details
   */
  @implement
  public async getOneTransaction(txid: string, block?: Block): Promise<Transaction> {
    let tx = this._cacheTxByHash.get(txid);
    if (!tx) {
      tx = await this._getOneTransaction(txid, block);
    }

    if (!tx) {
      return null;
    }

    const lastNetworkBlock = await this.getBlockCount();
    tx.confirmations = lastNetworkBlock - tx.block.number + 1;
    this._cacheTxByHash.set(txid, tx);
    return tx;
  }

  public getParallelNetworkRequestLimit() {
    return 5;
  }

  /**
   * Returns transactions with given txids
   *
   * @param {Array} txids: the array of transaction hashes/ids
   * @returns {Array}: the array of detailed transactions
   */
  @implement
  public async getTransactionsByIds(txids: string[], block?: Block): Promise<Transactions> {
    const result = new Transactions();
    if (!txids || !txids.length) {
      return result;
    }

    const getOneTx = async (txid: string) => {
      const tx = await this.getOneTransaction(txid, block);
      if (tx) {
        result.push(tx);
      }
    };
    const limit = pLimit(this.getParallelNetworkRequestLimit());
    await Utils.PromiseAll(
      txids.map(async txid => {
        return limit(() => getOneTx(txid));
      })
    );

    return result;
  }

  /**
   * Get block by the number or hash
   * Firstly looking for it from cache
   * If cache doesn't exist, then get it from blockchain network
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  @implement
  public async getOneBlock(blockHash: string | number): Promise<Block> {
    const cachedBlock = this._cacheBlock.get(blockHash);
    if (cachedBlock) {
      return cachedBlock;
    }

    const block = await this._getOneBlock(blockHash);
    this._cacheBlock.set(blockHash, block);
    return block;
  }

  /**
   * Return blockHash: string | number.
   *
   * @param {Number} fromBlockNumber: number of begin block in search range
   * @param {Number} toBlockNumber: number of end block in search range
   * @returns {Transactions}: an array of transactions
   */
  @implement
  public async getMultiBlocksTransactions(fromBlockNumber: number, toBlockNumber: number): Promise<Transactions> {
    if (fromBlockNumber > toBlockNumber) {
      throw new Error(`fromBlockNumber must be less than toBlockNumber`);
    }

    const count = toBlockNumber - fromBlockNumber + 1;
    const blockNumbers = Array.from(new Array(count), (val, index) => index + fromBlockNumber);
    const result = new Transactions();
    await Promise.all(
      blockNumbers.map(async blockNumber => {
        const txs = await this.getBlockTransactions(blockNumber);
        const transactions = _.compact(txs);
        result.push(...transactions);
      })
    );
    return result;
  }

  /**
   * Returns all transactions in given block.
   *
   * @param {string|number} blockHash: header hash or height of the block
   * @returns {Transactions}: an array of transactions
   */
  @implement
  public async getBlockTransactions(blockNumber: string | number): Promise<Transactions> {
    const block = await this.getOneBlock(blockNumber);
    if (!block) {
      throw new Error(`Could not get information of block: ${blockNumber}`);
    }
    const txs = await this.getTransactionsByIds(_.compact(block.txids), block);
    return txs;
  }

  /**
   * No param
   * Returns the number of blocks in the local best block chain.
   * @returns {number}: the height of latest block on the block chain
   */
  public abstract getBlockCount(): Promise<number>;

  /**
   * Get balance of an address
   *
   * @param {String} address: address that want to query balance
   * @returns {string}: the current balance of address
   */
  public abstract getAddressBalance(address: string): Promise<BigNumber>;

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {string}: the tx status
   */
  public abstract getTransactionStatus(txid: string): Promise<TransactionStatus>;

  /**
   * Sign a raw transaction with single private key
   * Most likely is used to sign transaction sent from normal hot wallet
   *
   * @param {string} unsignedRaw is result of "constructRawTransaction" method
   * @param {string} privateKey private key to sign, in string format
   *
   * @returns the signed transaction
   */
  public abstract signRawTransaction(unsignedRaw: string, secret: string | string[]): Promise<ISignedRawTransaction>;

  /**
   * Validate a transaction and broadcast it to the blockchain network
   *
   * @param {String} signedRawTx: the hex-encoded transaction data
   * @returns {String}: the transaction hash in hex
   */
  public abstract sendRawTransaction(signedRawTx: string): Promise<ISubmittedTransaction>;

  /**
   * minimum fee for seeding in almost case
   */
  public abstract getAverageSeedingFee(): Promise<BigNumber>;

  /**
   * Get block detailstxidstxids: string[]*
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected abstract _getOneBlock(blockHash: string | number): Promise<Block>;

  /**
   * Get one transaction object from blockchain network
   *
   * @param {String} txid: the transaction hash
   * @returns {Transaction}: the transaction details
   */
  protected abstract _getOneTransaction(txid: string, block?: Block): Promise<Transaction>;

  /**
   * Get cache options. Override this in derived class if needed
   *
   * @returns {LRU.Options} options for cache storage
   */
  @implement
  protected _getCacheOptions() {
    return {
      max: 1024,
      maxAge: 1000 * 60 * 5, // 5 minutes
    };
  }
}

export default BaseGateway;
