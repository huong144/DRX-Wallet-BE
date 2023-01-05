import _ from 'lodash';
import {
  Account,
  Block,
  AccountBasedGateway,
  getLogger,
  IRawTransaction,
  ISignedRawTransaction,
  ISubmittedTransaction,
  TransactionStatus,
  Utils,
  Address,
  BigNumber,
  implement,
  CurrencyRegistry,
  GatewayRegistry,
  ITrc20Token,
  TokenType,
  BlockchainPlatform,
  getRedisClient,
  EnvConfigRegistry,
} from 'sota-common';
import LRU from 'lru-cache';
import { TrxTransaction } from './TrxTransaction';
import { tronWeb } from './tronWeb';

const logger = getLogger('TrxGateway');
const _cacheBlockNumber = {
  value: 0,
  updatedAt: 0,
  isRequesting: false,
};

const _cacheTxInfoByHash: LRU<string, any> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _cacheTx: LRU<string, any> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _isRequestingTxInfo: Map<string, boolean> = new Map<string, boolean>();
const _isRequestingTx: Map<string, boolean> = new Map<string, boolean>();

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Tron, () => new TrxGateway());

export class TrxGateway extends AccountBasedGateway {
  public constructor() {
    super(CurrencyRegistry.Tron);
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    const energyLimit = 30_000;
    const energyPrice = 140; // unit: SUN
    return new BigNumber(energyLimit * energyPrice); // 4.2 TRX
  }

  /**
   * Create a new random account/address
   *
   * @returns {IAccount} the account object
   */
  public async createAccountAsync(): Promise<Account> {
    const accountInfo = await tronWeb.createAccount();
    return new Account(accountInfo.privateKey, accountInfo.address.base58);
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    const address = tronWeb.address.fromPrivateKey(privateKey);
    return { privateKey, address };
  }

  /**
   * Check whether an address is valid
   * @param address
   */
  public isValidAddressAsync(address: string): boolean {
    return tronWeb.isAddress(address);
  }

  /**
   * Get balance of an address
   *
   * @param {String} address: address that want to query balance
   * @returns {Number}: the current balance of address
   */
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const balance = await tronWeb.trx.getBalance(address);
    return new BigNumber(balance);
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
    let blockNum = -1;
    const lastestBlock = await tronWeb.trx.getCurrentBlock();
    if (lastestBlock.hasOwnProperty('block_header') && lastestBlock.block_header.hasOwnProperty('raw_data')) {
      blockNum = lastestBlock.block_header.raw_data.number;
    }
    const newUpdatedAt = Utils.nowInMillis();
    _cacheBlockNumber.value = blockNum;
    _cacheBlockNumber.updatedAt = newUpdatedAt;
    _cacheBlockNumber.isRequesting = false;
    logger.debug(`TrxGateway::getBlockCount value=${blockNum} updatedAt=${newUpdatedAt}`);
    return blockNum;
  }

  /**
   * constructRawTransaction construct raw transaction data without signature
   */
  @implement
  public async constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    value: BigNumber,
    options: {
      isConsolidate?: boolean;
      destinationTag?: string;
    }
  ): Promise<IRawTransaction> {
    const tx = await tronWeb.transactionBuilder.sendTrx(toAddress, value, fromAddress);
    let nexTxn = tx;
    if (options.destinationTag) {
      nexTxn = await tronWeb.transactionBuilder.addUpdateData(tx, options.destinationTag);
    }
    if (!nexTxn.hasOwnProperty('txID')) {
      throw Error('Failed to construct raw transaction.');
    }

    return {
      txid: nexTxn.txID,
      unsignedRaw: JSON.stringify(nexTxn),
    };
  }

  /**
   * sign raw transaction
   * @param unsignedRaw
   * @param secret
   */
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    if (secret.startsWith('0x')) {
      secret = secret.substr(2);
    }
    const signedTx = await tronWeb.trx.sign(JSON.parse(unsignedRaw), secret); // secret is private key
    if (!signedTx.hasOwnProperty('txID')) {
      throw Error('Failed to sign raw transaction.');
    }

    return {
      txid: signedTx.txID,
      signedRaw: JSON.stringify(signedTx),
      unsignedRaw,
    };
  }

  /**
   * Validate a transaction and broadcast it to the blockchain network
   *
   * @param {String} rawTx: the hex-encoded transaction data
   * @returns {String}: the transaction hash in hex
   */
  public async sendRawTransaction(rawTx: string): Promise<ISubmittedTransaction> {
    const receipt = await tronWeb.trx.sendRawTransaction(JSON.parse(rawTx));
    if (receipt.hasOwnProperty('txid')) {
      return { txid: receipt.txid };
    }

    if (receipt.hasOwnProperty('transaction') && receipt.transaction.hasOwnProperty('txID')) {
      return { txid: receipt.transaction.txID };
    }

    throw Error('Failed to send raw transaction.');
  }

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {string}: the tx status
   */
  public async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    try {
      const tx = await tronWeb.trx.getTransaction(txid);
      if (tx.hasOwnProperty('ret') && tx.ret.length !== 0 && tx.ret[0].hasOwnProperty('contractRet')) {
        if (tx.ret[0].contractRet === 'SUCCESS') {
          return TransactionStatus.COMPLETED;
        }
        return TransactionStatus.FAILED;
      }
    } catch {
      // Transaction not found then status = UNKNOWN
    }
    return TransactionStatus.UNKNOWN;
  }

  // public async getTrc20TokenInfo(contractAddress: string): Promise<ITrc20Token> {
  //   try {
  //     const contract = await tronWeb.contract().at(contractAddress);
  //     const [networkSymbol, name, decimals] = await Promise.all([
  //       contract.symbol().call(),
  //       contract.name().call(),
  //       contract.decimals().call(),
  //     ]);

  //     const symbol = [TokenType.TRC20, contractAddress].join('.');

  //     return {
  //       symbol,
  //       networkSymbol: networkSymbol.toLowerCase(),
  //       tokenType: TokenType.TRC20,
  //       name,
  //       platform: BlockchainPlatform.Tron,
  //       isNative: false,
  //       isUTXOBased: false,
  //       contractAddress,
  //       decimals,
  //       humanReadableScale: decimals,
  //       nativeScale: 0,
  //       hasMemo: false,
  //     };
  //   } catch (e) {
  //     logger.error(`TrxGateway::getTrc20TokenInfo could not get info contract=${contractAddress} due to error:`);
  //     logger.error(e);
  //     return null;
  //   }
  // }

  public async getTransactionInfo(txid: string): Promise<any> {
    const key = '__cacheTxInfoByHash_' + this.getCurrency().symbol + txid;
    let redisClient;
    let cachedTxInfo;
    if (!!EnvConfigRegistry.isUsingRedis()) {
      redisClient = getRedisClient();
      const cachedData = await redisClient.get(key);
      if (!!cachedData) {
        cachedTxInfo = JSON.parse(cachedData);
      }
    } else {
      cachedTxInfo = _cacheTxInfoByHash.get(key);
    }
    if (cachedTxInfo) {
      return cachedTxInfo;
    }

    if (_isRequestingTxInfo.get(txid)) {
      await Utils.timeout(500);
      return this.getTransactionInfo(txid);
    }

    _isRequestingTxInfo.set(txid, true);
    const txInfo = await tronWeb.trx.getUnconfirmedTransactionInfo(txid);
    _isRequestingTxInfo.delete(txid);

    if (!txInfo) {
      return null;
    }

    if (!txInfo.blockNumber) {
      const gwName = this.constructor.name;
      throw new Error(`${gwName}::getTransactionInfo tx doesn't have block number txid=${txid}`);
    }

    if (redisClient) {
      // redis cache tx info in 2mins
      redisClient.setex(key, 120, JSON.stringify(txInfo));
    } else {
      _cacheTxInfoByHash.set(key, txInfo);
    }
    return txInfo;
  }

  public async getTransaction(txid: string): Promise<any> {
    const key = '_cacheTx_' + this.getCurrency().symbol + txid;
    let redisClient;
    let cachedTx;
    if (!!EnvConfigRegistry.isUsingRedis()) {
      redisClient = getRedisClient();
      const cachedData = await redisClient.get(key);
      cachedTx = JSON.parse(cachedData);
    } else {
      cachedTx = _cacheTx.get(key);
    }
    if (cachedTx) {
      return cachedTx;
    }

    if (_isRequestingTx.get(txid)) {
      await Utils.timeout(500);
      return this.getTransaction(txid);
    }

    _isRequestingTx.set(txid, true);
    const tx = await tronWeb.trx.getTransaction(txid);
    _isRequestingTx.delete(txid);
    if (!tx) {
      const gwName = this.constructor.name;
      throw new Error(`${gwName}::getTransaction could not get transaction txid=${txid}`);
    }

    if (redisClient) {
      // redis cache tx in 2mins
      redisClient.setex(key, 120, JSON.stringify(tx));
    } else {
      _cacheTx.set(key, tx);
    }
    return tx;
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    const block = await tronWeb.trx.getBlock(blockNumber);
    const { number, timestamp } = block.block_header.raw_data;
    let txids = [];
    if (block.hasOwnProperty('transactions')) {
      txids = block.transactions.map((tx: any) => tx.txID);
    }
    return new Block({ hash: block.blockID, number, timestamp }, txids);
  }

  /**
   * Get one transaction object
   *
   * @param {String} txid: the transaction hash
   * @returns {TrxTransaction}: the transaction details
   */
  protected async _getOneTransaction(txid: string): Promise<TrxTransaction> {
    const tx = await this.getTransaction(txid);
    const txParam = tx.raw_data.contract[0].parameter.value;
    if (!txParam.hasOwnProperty('to_address') || !txParam.hasOwnProperty('amount')) {
      // this transaction is not a TRX transfer
      return null;
    }

    const txInfo = await this.getTransactionInfo(txid);
    const [block, lastNetworkBlockNumber] = await Promise.all([
      this.getOneBlock(txInfo.blockNumber),
      this.getBlockCount(),
    ]);
    const fee = new BigNumber(txInfo.fee ? txInfo.fee : 0);
    return new TrxTransaction(block, lastNetworkBlockNumber, fee, tx);
  }
}

export default TrxGateway;
