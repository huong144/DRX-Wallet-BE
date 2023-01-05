import _ from 'lodash';
import { AbiItem } from 'web3-utils';
// import * as web3_accounts from 'web3/eth/accounts';
import * as web3_types from 'web3/eth/types';
// import * as web3_types2 from 'web3/types';
import * as web3_core from 'web3-core';
import { keccak256 } from 'ethereum-cryptography/keccak';
import { Chain, Common, Hardfork } from '@ethereumjs/common';
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
  IErc20Token,
  TokenType,
  BlockchainPlatform,
  Transactions,
  EnvConfigRegistry,
} from 'sota-common';
import LRU from 'lru-cache';
import { EthTransaction } from './EthTransaction';
import * as EthTypeConverter from './EthTypeConverter';
import { web3, infuraWeb3 } from './web3';
import ERC20ABI from '../config/abi/erc20.json';
import { FeeMarketEIP1559Transaction } from '@ethereumjs/tx';

const logger = getLogger('EthGateway');
const ethMaxGasPrice = EnvConfigRegistry.getCustomEnvConfig('ETH_MAX_GAS_PRICE');
const maxGasPrice = ethMaxGasPrice ? ethMaxGasPrice : 300000000000; // 300 gwei
const maxPriorityFeePerGas = 2000000000; // 2 gwei
const _cacheBlockNumber = {
  value: 0,
  updatedAt: 0,
  isRequesting: false,
};
const _cacheRawTxByHash: LRU<string, web3_types.Transaction> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _cacheRawTxReceipt: LRU<string, web3_core.TransactionReceipt> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});
const _isRequestingTx: Map<string, boolean> = new Map<string, boolean>();
const _isRequestingReceipt: Map<string, boolean> = new Map<string, boolean>();

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Ethereum, () => new EthGateway());

export class EthGateway extends AccountBasedGateway {
  public constructor() {
    super(CurrencyRegistry.Ethereum);
  }

  public async getGasPrice(useLowerNetworkFee?: boolean): Promise<BigNumber> {
    const baseGasPrice = new BigNumber(await web3.eth.getGasPrice());
    // To prevent drain attack, set max gas price as 120 gwei
    // This value can be override via the config ETH_MAX_GAS_PRICE
    let finalGasPrice: BigNumber = new BigNumber(120000000000);
    const configMaxGasPrice = parseInt(EnvConfigRegistry.getCustomEnvConfig('ETH_MAX_GAS_PRICE'), 10);
    if (!isNaN(configMaxGasPrice)) {
      finalGasPrice = new BigNumber(configMaxGasPrice);
    }

    let multipler = 5;
    if (!!useLowerNetworkFee) {
      multipler = 2;
      const configMultiplerLow = parseInt(EnvConfigRegistry.getCustomEnvConfig('ETH_MAX_GAS_MULTIPLER_LOW'), 10);
      if (!isNaN(configMultiplerLow)) {
        multipler = configMultiplerLow;
      }
    } else {
      const configMultiplerHigh = parseInt(EnvConfigRegistry.getCustomEnvConfig('ETH_MAX_GAS_MULTIPLER_HIGH'), 10);
      if (!isNaN(configMultiplerHigh)) {
        multipler = configMultiplerHigh;
      }
    }

    const multiplyGasPrice = baseGasPrice.multipliedBy(multipler);
    if (finalGasPrice.gt(multiplyGasPrice)) {
      finalGasPrice = multiplyGasPrice;
    }

    // Buffer some gas to make sure transaction can be confirmed faster
    // The default value is 20gwei, and can be overrided via config ETH_MAX_GAS_PLUS
    let plusGas = 20000000000; // 20 gwei
    const configPlusGas = parseInt(EnvConfigRegistry.getCustomEnvConfig('ETH_MAX_GAS_PLUS'), 10);
    if (!isNaN(configPlusGas)) {
      plusGas = configPlusGas;
    }

    const plusGasPrice = baseGasPrice.plus(plusGas);
    if (finalGasPrice.gt(plusGasPrice)) {
      finalGasPrice = plusGasPrice;
    }

    if (baseGasPrice.gt(finalGasPrice)) {
      finalGasPrice = baseGasPrice;
    }

    return finalGasPrice;
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

  public getParallelNetworkRequestLimit() {
    return 100;
  }

  public async getAverageSeedingFee(): Promise<BigNumber> {
    const gasPrice = web3.utils.toBN(await this.getMaxFeePerGas(true));
    const gasLimit = web3.utils.toBN(80000); // For ETH transaction 21000 gas is fixed
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
  public async createAccountAsync(): Promise<web3_core.Account> {
    return web3.eth.accounts.create();
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
    logger.debug(`EthGateway::getBlockCount value=${blockNum} updatedAt=${newUpdatedAt}`);
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
      isConsolidate: false;
      destinationTag?: string;
      useLowerNetworkFee?: boolean;
    }
  ): Promise<IRawTransaction> {
    let amount = web3.utils.toBN(value.toString());
    const nonce = await web3.eth.getTransactionCount(fromAddress);
    const maxFeePerGas = web3.utils.toBN(await this.getMaxFeePerGas(options.useLowerNetworkFee));
    const gasLimit = web3.utils.toBN(options.isConsolidate ? 21000 : 150000); // Maximum gas allow for Ethereum transaction
    const fee = gasLimit.mul(maxFeePerGas);

    if (options.isConsolidate) {
      amount = amount.sub(fee);
    }

    // Check whether the balance of hot wallet is enough to send
    const balance = web3.utils.toBN((await web3.eth.getBalance(fromAddress)).toString());
    if (amount.lt(web3.utils.toBN(0))) {
      throw new Error(
        `EthGateway::constructRawTransaction could not construct tx because of insufficient amount: \
         address=${fromAddress}, balance=${balance}, amount=${amount}, fee=${fee}`
      );
    }
    if (balance.lt(amount.add(fee))) {
      throw new Error(
        `EthGateway::constructRawTransaction could not construct tx because of insufficient balance: \
         address=${fromAddress}, balance=${balance}, amount=${amount}, fee=${fee}`
      );
    }

    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    const common = new Common({ chain: Number(config.chainId), hardfork: Hardfork.London });
    const txData = {
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
    const tx = FeeMarketEIP1559Transaction.fromTxData(txData, { common });
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
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    const common = new Common({ chain: Number(config.chainId), hardfork: Hardfork.London });
    const tx = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(rawTx, 'hex'), { common });
    const unsignedTx = tx.getMessageToSign(false);
    return {
      txid: `0x${Buffer.from(keccak256(tx.serialize())).toString('hex')}`,
      unsignedRaw: unsignedTx.toString('hex'),
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

    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    const common = new Common({ chain: Number(config.chainId), hardfork: Hardfork.London });
    const privateKey = Buffer.from(secret, 'hex');
    const ethTx = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(unsignedRaw, 'hex'), { common });
    const signedTx = ethTx.sign(privateKey);
    return {
      txid: `0x${signedTx.hash().toString('hex')}`,
      signedRaw: signedTx.serialize().toString('hex'),
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
    const config = CurrencyRegistry.getCurrencyConfig(this._currency);
    const common = new Common({ chain: Number(config.chainId), hardfork: Hardfork.London });
    const ethTx = FeeMarketEIP1559Transaction.fromSerializedTx(Buffer.from(rawTx, 'hex'), { common });
    let txid = ethTx.hash().toString('hex');
    if (!txid.startsWith('0x')) {
      txid = '0x' + txid;
    }
    if (!rawTx.startsWith('0x')) {
      rawTx = '0x' + rawTx;
    }
    if (!retryCount || isNaN(retryCount)) {
      retryCount = 0;
    }

    try {
      const receipt = await web3.eth.sendSignedTransaction(rawTx);
      logger.info(`EthGateway::sendRawTransaction infura_txid=${receipt.transactionHash}`);
      return { txid: receipt.transactionHash };
    } catch (e) {
      if (e.toString().indexOf('already known') > -1) {
        logger.warn(e.toString());
        return { txid };
      }

      if (e.toString().indexOf('known transaction') > -1) {
        logger.warn(e.toString());
        return { txid };
      }

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
        logger.fatal(`Too many fails sending txid=${txid} tx=${JSON.stringify(ethTx.toJSON())} err=${e.toString()}`);
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
    try {
      const tx = (await this.getOneTransaction(txid)) as EthTransaction;
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
    } catch (e) {
      console.log(e);
      return TransactionStatus.FAILED;
    }
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

  public async getErc20TokenInfo(currency: string): Promise<IErc20Token> {
    let contractAddress = currency;
    if (contractAddress.includes('.')) {
      [, contractAddress] = contractAddress.split('.');
    }
    contractAddress = this.normalizeAddress(contractAddress);
    try {
      const contract = new web3.eth.Contract(ERC20ABI as AbiItem[], contractAddress);
      const [networkSymbol, name, decimals] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.name().call(),
        contract.methods.decimals().call(),
      ]);

      const symbol = [TokenType.ERC20, contractAddress].join('.');

      return {
        symbol,
        networkSymbol: networkSymbol.toLowerCase(),
        tokenType: TokenType.ERC20,
        name,
        platform: BlockchainPlatform.Ethereum,
        isNative: false,
        isUTXOBased: false,
        contractAddress,
        decimals,
        humanReadableScale: decimals,
        nativeScale: 0,
      };
    } catch (e) {
      logger.error(`EthGateway::getErc20TokenInfo could not get info contract=${contractAddress} due to error:`);
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
    const block = await web3.eth.getBlock(EthTypeConverter.toBlockType(blockNumber), true);
    if (!block) {
      return null;
    }

    const txids = block.transactions.map(tx => (tx.hash ? tx.hash : tx.toString()));
    return new Block(Object.assign({}, block), txids);
  }

  /**
   * Get one transaction object
   *
   * @param {String} txid: the transaction hash
   * @returns {EthTransaction}: the transaction details
   */
  protected async _getOneTransaction(txid: string): Promise<EthTransaction> {
    const tx = await this.getRawTransaction(txid);
    if (!tx) {
      return null;
    }

    const [receipt, block, lastNetworkBlockNumber] = await Promise.all([
      this.getRawTransactionReceipt(txid),
      this.getOneBlock(tx.blockNumber),
      this.getBlockCount(),
    ]);

    return new EthTransaction(tx, block, receipt, lastNetworkBlockNumber);
  }
}

export default EthGateway;
