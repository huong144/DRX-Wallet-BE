import _ from 'lodash';
import * as web3_types from 'web3-core/types';
import { AbiItem } from 'web3-utils/types';
import {
  Block,
  AccountBasedGateway,
  getLogger,
  IRawTransaction,
  ISignedRawTransaction,
  ISubmittedTransaction,
  TransactionStatus,
  override,
  Utils,
  Address,
  BigNumber,
  implement,
  CurrencyRegistry,
  GatewayRegistry,
  IBep20Token,
  TokenType,
  BlockchainPlatform,
  Transactions,
  EnvConfigRegistry,
  getRedisClient,
} from 'sota-common';
import LRU from 'lru-cache';
import { BscTransaction } from './BscTransaction';
import * as BscTypeConverter from './BscTypeConverter';
import { web3 } from './web3';
import BEP20ABI from '../config/abi/bep20.json';
import EthereumTx from 'ethereumjs-tx';

const logger = getLogger('BscGateway');
const plusNumber = 20000000000; // 20 gwei
const maxGasPrice = 120000000000; // 120 gwei
const _cacheBlockNumber = {
  value: 0,
  updatedAt: 0,
  isRequesting: false,
};
const _cacheRawTxByHash: LRU<string, web3_types.Transaction> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _cacheRawTxReceipt: LRU<string, web3_types.TransactionReceipt> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _cacheRawTxsOnBlock: LRU<string, web3_types.Transaction[]> = new LRU({
  max: 10,
  maxAge: 1000 * 60 * 5,
});
const _cacheRawTxReceiptsOnBlock: LRU<string, web3_types.TransactionReceipt[]> = new LRU({
  max: 10,
  maxAge: 1000 * 60 * 5,
});
const _isRequestingTx: Set<string> = new Set<string>();
const _isRequestingReceipt: Set<string> = new Set<string>();
const _isRequestingBlock: Set<string> = new Set<string>();

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Bsc, () => new BscGateway());

export class BscGateway extends AccountBasedGateway {
  public constructor() {
    super(CurrencyRegistry.Bsc);
  }

  /**
   * We want to set gas price is a bit higher than the network's average
   * Start with base price which is parse from web3 lib, we choose the smallest one among:
   * - basePrice * 5
   * - basePrice + 20 (gwei)
   * - absolute 120 gwei
   * - if basePrice > 120 gwei, just use the base price (it's crazy if going this far though...)
   */
  public async getGasPrice(useLowerNetworkFee?: boolean): Promise<string> {
    const baseGasPrice = new BigNumber(await web3.eth.getGasPrice());
    let finalGasPrice: BigNumber = new BigNumber(maxGasPrice);

    if (baseGasPrice.gt(finalGasPrice)) {
      finalGasPrice = baseGasPrice;
    } else {
      let mulNumber = 5;
      if (!!useLowerNetworkFee) {
        mulNumber = 2;
      }

      const multiplyGasPrice = baseGasPrice.multipliedBy(mulNumber);
      if (finalGasPrice.gt(multiplyGasPrice)) {
        finalGasPrice = multiplyGasPrice;
      }

      const plusGasPrice = baseGasPrice.plus(plusNumber);
      if (finalGasPrice.gt(plusGasPrice)) {
        finalGasPrice = plusGasPrice;
      }
    }

    return finalGasPrice.toString();
  }

  public getParallelNetworkRequestLimit() {
    return 100;
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    const gasPrice = web3.utils.toBN(await this.getGasPrice());
    const gasLimit = web3.utils.toBN(70000); // For ETH transaction 21000 gas is fixed
    const result = gasPrice.mul(gasLimit);
    return new BigNumber(result.toString());
  }

  /**
   * Handle more at extended classes
   * @param address
   */
  @override
  public normalizeAddress(address: string) {
    if (!web3.utils.isAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }

    return web3.utils.toChecksumAddress(address);
  }

  /**
   * Create a new random account/address
   *
   * @returns {IAccount} the account object
   */
  public async createAccountAsync(): Promise<web3_types.Account> {
    return web3.eth.accounts.create();
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<web3_types.Account> {
    if (privateKey.indexOf('0x') < 0) {
      privateKey = '0x' + privateKey;
    }

    if (privateKey.length !== 66) {
      throw new Error(`Invalid private key. Should be 64-byte length.`);
    }

    return web3.eth.accounts.privateKeyToAccount(privateKey);
  }

  /**
   * Check whether an address is valid
   * @param address
   */
  public isValidAddressAsync(address: string): boolean {
    return web3.utils.isAddress(address);
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

  /**
   * No param
   * Returns the number of blocks in the local best block chain.
   * @returns {number}: the height of latest block on the block chain
   */
  public async getBlockCount(): Promise<number> {
    try {
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
      logger.debug(`BscGateway::getBlockCount value=${blockNum} updatedAt=${newUpdatedAt}`);
      return blockNum;
    } catch (error) {
      _cacheBlockNumber.isRequesting = false;
      throw new Error(`Could not get info block count due to error: ${error}`);
    }
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
      isConsolidate: false;
      destinationTag?: string;
      useLowerNetworkFee?: boolean;
    }
  ): Promise<IRawTransaction> {
    let amount = web3.utils.toBN(value.toString());
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const gasPrice = web3.utils.toBN(await this.getGasPrice(options.useLowerNetworkFee));
    const gasLimit = web3.utils.toBN(options.isConsolidate ? 21000 : 150000); // Maximum gas allow for Ethereum transaction
    const fee = gasLimit.mul(gasPrice);

    if (options.isConsolidate) {
      amount = amount.sub(fee);
    }

    // Check whether the balance of hot wallet is enough to send
    const balance = web3.utils.toBN((await web3.eth.getBalance(fromAddress)).toString());
    if (balance.lt(amount.add(fee))) {
      throw new Error(
        `BscGateway::constructRawTransaction could not construct tx because of insufficient balance: \
         address=${fromAddress}, balance=${balance}, amount=${amount}, fee=${fee}`
      );
    }

    const tx = new EthereumTx({
      chainId: this.getChainId(),
      data: '',
      gasLimit: web3.utils.toHex(options.isConsolidate ? 21000 : 150000),
      gasPrice: web3.utils.toHex(gasPrice.toString()),
      nonce: web3.utils.toHex(nonce),
      to: toAddress,
      value: web3.utils.toHex(amount),
    });

    return {
      txid: `0x${tx.hash().toString('hex')}`,
      unsignedRaw: tx.serialize().toString('hex'),
    };
  }

  /**
   * Re-construct raw transaction from hex string data
   * @param rawTx
   */
  public reconstructRawTx(rawTx: string): IRawTransaction {
    const tx = new EthereumTx(rawTx);
    return {
      txid: `0x${tx.hash().toString('hex')}`,
      unsignedRaw: tx.serialize().toString('hex'),
    };
  }

  /**
   * sign raw transaction
   * @param rawData
   * @param coinKeys
   */
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    if (secret.startsWith('0x')) {
      secret = secret.substr(2);
    }

    const tx = new EthereumTx(unsignedRaw);
    const privateKey = Buffer.from(secret, 'hex');
    tx.sign(privateKey);

    return {
      txid: `0x${tx.hash().toString('hex')}`,
      signedRaw: tx.serialize().toString('hex'),
      unsignedRaw,
    };
  }

  /**
   * Validate a transaction and broadcast it to the blockchain network
   *
   * @param {String} rawTx: the hex-encoded transaction data
   * @returns {String}: the transaction hash in hex
   */
  public async sendRawTransaction(rawTx: string, retryCount?: number): Promise<ISubmittedTransaction> {
    if (!rawTx.startsWith('0x')) {
      rawTx = '0x' + rawTx;
    }

    const tx = new EthereumTx(rawTx);
    let txid = tx.hash().toString('hex');
    if (!txid.startsWith('0x')) {
      txid = '0x' + txid;
    }

    if (!retryCount || isNaN(retryCount)) {
      retryCount = 0;
    }

    try {
      const receipt = await web3.eth.sendSignedTransaction(rawTx);

      logger.info(`BscGateway::sendRawTransaction infura_txid=${receipt.transactionHash}`);
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
        const _tx = await this.getOneTransaction(txid);

        // If transaction is confirmed, it means the broadcast was successful before
        if (_tx && _tx.confirmations) {
          return { txid };
        }

        throw e;
      }

      if (retryCount + 1 > 5) {
        logger.error(`Too many fails sending txid=${txid} tx=${JSON.stringify(tx.toJSON())} err=${e.toString()}`);
        throw e;
      }

      return this.sendRawTransaction(rawTx, retryCount + 1);
    }
  }

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {string}: the tx status
   */
  public async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    if (!txid.startsWith('0x')) {
      txid = '0x' + txid;
    }

    const tx = (await this.getOneTransaction(txid)) as BscTransaction;
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

  public async getRawTransaction(txid: string): Promise<web3_types.Transaction> {
    const key = '_cacheRawTxByHash_' + this.getCurrency().symbol + txid;
    try {
      let redisClient;
      let cachedTx: web3_types.Transaction;
      if (!!EnvConfigRegistry.isUsingRedis()) {
        redisClient = getRedisClient();
        const cachedData = await redisClient.get(key);
        if (!!cachedData) {
          cachedTx = JSON.parse(cachedData);
        }
      } else {
        cachedTx = _cacheRawTxByHash.get(txid);
      }
      if (cachedTx) {
        return cachedTx;
      }

      if (_isRequestingTx.has(txid)) {
        await Utils.timeout(500);
        return this.getRawTransaction(txid);
      }

      _isRequestingTx.add(txid);
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
    } catch (error) {
      _isRequestingTx.delete(txid);
      throw new Error(`Could not get raw transaction receipt by txid:${txid} due to error:${error}`);
    }
  }

  public async getRawTransactionReceipt(txid: string): Promise<web3_types.TransactionReceipt> {
    const key = '_cacheRawTxReceipt_' + this.getCurrency().symbol + txid;
    try {
      let redisClient;
      let cachedReceipt: web3_types.TransactionReceipt;
      if (!!EnvConfigRegistry.isUsingRedis()) {
        redisClient = getRedisClient();
        const cachedData = await redisClient.get(key);
        cachedReceipt = JSON.parse(cachedData);
      } else {
        cachedReceipt = _cacheRawTxReceipt.get(key);
      }
      if (cachedReceipt) {
        return cachedReceipt;
      }

      if (_isRequestingReceipt.has(txid)) {
        await Utils.timeout(500);
        return this.getRawTransactionReceipt(txid);
      }

      _isRequestingReceipt.add(txid);
      const receipt = await web3.eth.getTransactionReceipt(txid);
      _isRequestingReceipt.delete(txid);
      if (!receipt) {
        const gwName = this.constructor.name;
        throw new Error(`${gwName}::getRawTransactionReceipt could not get receipt txid=${txid}`);
      }

      if (redisClient) {
        // redis cache receipt in 2mins
        redisClient.setex(key, 120, JSON.stringify(receipt));
      } else {
        _cacheRawTxReceipt.set(key, receipt);
      }
      return receipt;
    } catch (error) {
      _isRequestingReceipt.delete(txid);
      throw new Error(`Could not get raw transaction receipt by txid:${txid} due to error:${error}`);
    }
  }

  public async getBep20TokenInfo(currency: string): Promise<IBep20Token> {
    let contractAddress = currency;
    if (currency.includes('.')) {
      [, contractAddress] = currency.split('.');
    }
    contractAddress = this.normalizeAddress(contractAddress);
    try {
      const contract = new web3.eth.Contract(BEP20ABI as AbiItem[], contractAddress);
      const [networkSymbol, name, decimals] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.name().call(),
        contract.methods.decimals().call(),
      ]);

      const symbol = [TokenType.BEP20, contractAddress].join('.');

      return {
        symbol,
        networkSymbol: networkSymbol.toLowerCase(),
        tokenType: TokenType.BEP20,
        name,
        platform: BlockchainPlatform.BSC,
        isNative: false,
        isUTXOBased: false,
        contractAddress,
        decimals,
        humanReadableScale: decimals,
        nativeScale: 0,
      };
    } catch (e) {
      logger.error(`BscGateway::getBep20TokenInfo could not get info contract=${contractAddress} due to error:`);
      logger.error(e);
      return null;
    }
  }

  public getChainId(): number {
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    return Number(config.chainId);
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    const block = await web3.eth.getBlock(BscTypeConverter.toBlockType(blockNumber));
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
  protected async _getOneTransaction(txid: string): Promise<BscTransaction> {
    const tx = await this.getRawTransaction(txid);
    if (!tx) {
      return null;
    }

    const [receipt, block, lastNetworkBlockNumber] = await Promise.all([
      this.getRawTransactionReceipt(txid),
      this.getOneBlock(tx.blockNumber),
      this.getBlockCount(),
    ]);

    return new BscTransaction(tx, block, receipt, lastNetworkBlockNumber);
  }
}

export default BscGateway;
