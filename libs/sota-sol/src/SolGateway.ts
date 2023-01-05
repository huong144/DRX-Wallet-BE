import _, { add } from 'lodash';
import os from 'os';
import {
  Transaction,
  Keypair,
  PublicKey,
  SystemProgram,
  ParsedInstruction,
  ParsedConfirmedTransaction,
  sendAndConfirmRawTransaction,
  BlockheightBasedTransactionConfirmationStrategy,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import { v4 as uuidv4 } from 'uuid';
import * as base64 from 'byte-base64';
import bs58 from 'bs58';

import {
  Block,
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
  BlockchainPlatform,
  Transactions,
  Account,
  IMultiEntriesTxEntry,
  SolTransaction,
  SolanaBasedGateway,
  GatewayRegistry,
  ISplToken,
  TokenType,
} from 'sota-common';
import LRU from 'lru-cache';
import pLimit from 'p-limit';

import { conn } from './SolanaWeb3';

import { addressToPublicKey, isSystemProgram, MS_PER_SLOT } from './utils';
import { TOKEN_PROGRAM_ID, getMint } from '@solana/spl-token';
interface IBlockhashInfo {
  readonly blockhash: string | null;
  readonly lastFetch: number;
  readonly fee: number;
}
export interface IGroupTransferEntries {
  readonly outEntries: IMultiEntriesTxEntry[];
  readonly inEntries: IMultiEntriesTxEntry[];
  fee: BigNumber;
}

const logger = getLogger('SolGateway');
const _cacheBlockNumber = {
  value: 0,
  updatedAt: 0,
  isRequesting: false,
};
const BLOCKHASH_CACHE_TIMEOUT_MS = 30 * 1000;

const _cacheRawParsedConfirmTxByHash: LRU<string, any> = new LRU({
  max: 1024,
  maxAge: 1000 * 60 * 5,
});

const _cacheRawTxOnBlock: LRU<string, ParsedConfirmedTransaction[]> = new LRU({
  max: 10,
  maxAge: 1000 * 60 * 5,
});

const _isRequesting: Set<string> = new Set<string>();

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Solana, () => new SolGateway());

export class SolGateway extends SolanaBasedGateway {
  protected _recentBlockHash: IBlockhashInfo;
  public constructor() {
    super(CurrencyRegistry.Solana);
    this._recentBlockHash = {
      blockhash: null,
      lastFetch: 0,
      fee: 0,
    };
  }

  public getParallelNetworkRequestLimit() {
    return os.cpus().length;
  }

  @implement
  public async getAverageSeedingFee(): Promise<BigNumber> {
    const recentBlock = await conn.getRecentBlockhash();
    return new BigNumber(recentBlock.feeCalculator.lamportsPerSignature);
  }

  @implement
  public async getMinimumBalanceForRentExemption(): Promise<BigNumber> {
    return new BigNumber(await conn.getMinimumBalanceForRentExemption(0));
  }

  /**
   * Create a new random account/address
   *
   * @returns {IAccount} the account object
   */
  public async createAccountAsync(): Promise<Account> {
    const keyPair = Keypair.generate();
    return {
      address: keyPair.publicKey.toBase58(),
      privateKey: bs58.encode(keyPair.secretKey),
    };
  }

  public async getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    const keyPair = this._getKeyPairFromPrivateKey(privateKey);
    return {
      address: keyPair.publicKey.toBase58(),
      privateKey: bs58.encode(keyPair.secretKey),
    };
  }

  public _getKeyPairFromPrivateKey(privateKey: string): Keypair {
    const buffer = base64.base64ToBytes(privateKey);
    if (buffer.length !== 64) {
      throw new Error(`SolGateway::_getKeyPairFromPrivateKey Invalid private key. Should be 64-byte length.`);
    }

    return Keypair.fromSecretKey(buffer);
  }

  /**
   * Check whether an address is valid
   * @param address
   */
  public isValidAddressAsync(address: string): boolean {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  }

  /**
   * Get balance of an address
   *
   * @param {String} address: address that want to query balance
   * @returns {Number}: the current balance of address
   */
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const publicKey = new PublicKey(address);
    const balance = await conn.getBalance(publicKey);
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
    const epochInfo = await conn.getEpochInfo();
    const absoluteSlot = epochInfo.absoluteSlot - 1;

    const newUpdatedAt = Utils.nowInMillis();
    _cacheBlockNumber.value = absoluteSlot;
    _cacheBlockNumber.updatedAt = newUpdatedAt;
    _cacheBlockNumber.isRequesting = false;
    logger.debug(`SolGateway::getBlockCount value=${absoluteSlot} updatedAt=${newUpdatedAt}`);
    return absoluteSlot;
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
      needFunding?: boolean;
      maintainRent?: boolean;
    }
  ): Promise<IRawTransaction> {
    let amount = new BigNumber(value);
    const { blockhash, fee } = await this.pollNewBlockhash();

    let balance = await this.getAddressBalance(fromAddress);
    if (!!options.maintainRent) {
      const minimumBalance = await this.getMinimumBalanceForRentExemption();
      balance = balance.minus(minimumBalance);
      if (balance.lte(0)) {
        throw new Error(
          `SolGateway::constructRawTransaction Could not construct tx because of account ${fromAddress} has insufficient funds spend ${amount} (SOL) + fee ${fee}, balance=${balance}`
        );
      }
      if (amount.gt(balance)) {
        amount = balance;
      }
    }

    if (!!options.isConsolidate) {
      amount = amount.minus(fee);
    }

    // Check whether the balance of hot wallet is enough to send
    if (balance.lt(amount.plus(fee))) {
      throw new Error(
        `SolGateway::constructRawTransaction Could not construct tx because of account ${fromAddress} has insufficient funds spend ${amount} (SOL) + fee ${fee}, balance=${balance}`
      );
    }

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: addressToPublicKey(fromAddress),
    });

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: addressToPublicKey(fromAddress),
        toPubkey: addressToPublicKey(toAddress),
        lamports: amount.toNumber(),
      })
    );

    return {
      txid: uuidv4(),
      unsignedRaw: transaction.serialize({ verifySignatures: false }).toString('base64'),
    };
  }

  /**
   * sign raw transaction
   * @param rawData
   * @param priateKey
   */
  public async signRawTransaction(unsignedRaw: string, secret: string): Promise<ISignedRawTransaction> {
    const transaction = Transaction.from(base64.base64ToBytes(unsignedRaw));

    // transaction may be rejected because blockhash is too old, need to poll for new blockhash
    const { blockhash } = await this.pollNewBlockhash();
    const { lastValidBlockHeight } = await conn.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;

    let decodedSecret = base64.bytesToBase64(bs58.decode(secret));
    const keyPair = this._getKeyPairFromPrivateKey(decodedSecret);

    transaction.sign(keyPair);
    if (!transaction.signature) {
      throw new Error(`SolGateway::signRawTransaction can not sign transaction.`); // should never happen
    }
    return {
      txid: transaction.signatures[0].signature.toString('base64'),
      signedRaw: transaction.serialize().toString('base64'),
      unsignedRaw,
    };
  }

  /**
   * Validate a transaction and broadcast it to the blockchain network
   *
   * @param {String} signedRawTx: the hex-encoded transaction data
   * @returns {String}: the transaction hash in hex
   */
  public async sendRawTransaction(signedRawTx: string, retryCount?: number): Promise<ISubmittedTransaction> {
    if (!retryCount || isNaN(retryCount)) {
      retryCount = 0;
    }

    try {
      const txSignature = await conn.sendEncodedTransaction(signedRawTx);
      logger.info(`SolGateway::sendRawTransaction sol_txid=${txSignature}`);
      return { txid: txSignature };
    } catch (e) {
      if (retryCount + 1 > 5) {
        logger.error(`SolGateway::sendRawTransaction Too many fails sending tx=${signedRawTx} err=${e.toString()}`);
        throw e;
      }

      return this.sendRawTransaction(signedRawTx, retryCount + 1);
    }
  }

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {string}: the tx status
   */
  public async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    const signatureStatus = await conn.getSignatureStatus(txid, {
      searchTransactionHistory: true,
    });

    if (!signatureStatus || !signatureStatus.value) {
      return TransactionStatus.UNKNOWN;
    }
    if (signatureStatus.value.err) {
      return TransactionStatus.FAILED;
    }

    if (
      signatureStatus.value.confirmationStatus === 'processed' ||
      signatureStatus.value.confirmationStatus === 'confirmed'
    ) {
      return TransactionStatus.CONFIRMING;
    }

    return TransactionStatus.COMPLETED;
  }

  public async getRawTransaction(txid: string): Promise<ParsedConfirmedTransaction | null> {
    const key = '_cacheRawTxByHash_' + this.getCurrency().symbol + txid;
    try {
      const cachedConfirmed = _cacheRawParsedConfirmTxByHash.get(key);
      if (cachedConfirmed) {
        return cachedConfirmed;
      }

      if (_isRequesting.has(txid)) {
        await Utils.timeout(500);
        return this.getRawTransaction(txid);
      }

      _isRequesting.add(txid);
      const rawTX = await conn.getParsedConfirmedTransaction(txid);
      _isRequesting.delete(txid);
      if (!rawTX) {
        return null;
      }
      _cacheRawParsedConfirmTxByHash.set(key, rawTX);
      return rawTX;
    } catch (error) {
      _isRequesting.delete(txid);
      throw new Error(
        `SolGateway::getRawTransaction Could not get transaction info by txid=${txid} due to error: ${error}`
      );
    }
  }

  public async getSplTokenInfo(currency: string): Promise<ISplToken | null> {
    let programId = currency;
    if (programId.includes('.')) {
      [, programId] = currency.split('.');
    }
    try {
      const { decimals } = await getMint(conn, addressToPublicKey(programId));
      const symbol = [TokenType.SPLToken, programId].join('.');

      return {
        symbol,
        networkSymbol: '',
        tokenType: TokenType.SPLToken,
        name: '',
        platform: BlockchainPlatform.Solana,
        isNative: false,
        isUTXOBased: false,
        programId,
        decimals,
        humanReadableScale: decimals,
        nativeScale: 0,
      };
    } catch (e) {
      logger.error(`SolGateway::getSplTokenInfo could not get info token=${programId} due to error:`);
      logger.error(e);
      return null;
    }
  }

  public async _getMultiTransactionsByIds(blockNumber: number, txids: string[]): Promise<ParsedConfirmedTransaction[]> {
    const key = '_cacheRawTxOnBlock_' + this.getCurrency().symbol + blockNumber.toString();
    const parsedTxs: ParsedConfirmedTransaction[] = [];
    try {
      const cacheTxs = _cacheRawTxOnBlock.get(key);
      if (cacheTxs) {
        return cacheTxs;
      }
      if (_isRequesting.has(key)) {
        await Utils.timeout(2000);
        return await this._getMultiTransactionsByIds(blockNumber, txids);
      }

      _isRequesting.add(key);
      const getMultiTxs = async (ids: string[]) => {
        const rawTxs = await conn.getParsedConfirmedTransactions(ids);
        parsedTxs.push(...rawTxs);
      };
      // Chunk transactions
      const tasks: Array<Promise<void>> = [];
      let numberOfParams = 0;
      const limit = pLimit(this.getParallelNetworkRequestLimit());
      const limitOfParams = process.env.LIMIT_OF_PARAMS ? parseInt(process.env.LIMIT_OF_PARAMS, 10) : txids.length;
      while (numberOfParams < txids.length) {
        const chunk = txids.slice(numberOfParams, numberOfParams + limitOfParams);
        numberOfParams += limitOfParams;
        tasks.push(limit(() => getMultiTxs(chunk)));
      }
      await Promise.all(tasks);
      _isRequesting.delete(key);
      _cacheRawTxOnBlock.set(key, parsedTxs);
      return parsedTxs;
    } catch (error) {
      _isRequesting.delete(key);
      throw new Error(
        `SolGateway::_getMultiTransactionsByIds Could not get multi transactions from block: ${blockNumber} due to error: ${error}`
      );
    }
  }

  /**
   * @override
   * Returns all transactions in givent block.
   *
   * @param {number} blockHash: height of the block
   * @returns {Transactions}: an array of transactions
   *
   */
  public async getBlockTransactions(blockNumber: number): Promise<Transactions> {
    const txs = new Transactions();
    const [block, lastNetworkBlockNumber] = await Promise.all([this.getOneBlock(blockNumber), this.getBlockCount()]);
    // get all raw_confirmed_transactions of blogetBlock
    if (!block) {
      return txs;
    }
    const rawTxs = await this._getMultiTransactionsByIds(blockNumber, block.txids);
    // initialize sol_transaction from raw_tx and receipt
    _.forEach(rawTxs, rawTx => {
      const groupEntries = this.groupTransferEntries(rawTx);
      // Cannot find any transfer
      // Just treat the transaction as failed
      if (groupEntries.outEntries.length === 0 || groupEntries.inEntries.length === 0) {
        return;
      }

      const rawSolTx = {
        txHash: rawTx.transaction.signatures[0],
        height: blockNumber,
        fee: groupEntries.fee,
        status: rawTx.meta.err ? false : true,
        outEntries: groupEntries.outEntries,
        inEntries: groupEntries.inEntries,
      };
      const solTx = new SolTransaction(
        CurrencyRegistry.Solana,
        rawSolTx,
        {
          hash: block.hash,
          number: blockNumber,
          timestamp: block.timestamp,
        },
        lastNetworkBlockNumber
      );
      txs.push(solTx);
    });
    return txs;
  }

  /**
   * group multiple transfers
   * @returns {IGroupTransferEntries} transactions: the bnb transactions detail
   */
  public groupTransferEntries(rawTx: ParsedConfirmedTransaction): IGroupTransferEntries {
    const group: IGroupTransferEntries = {
      outEntries: [],
      inEntries: [],
      fee: new BigNumber(rawTx.meta.fee),
    };
    const instructions = rawTx.transaction.message.instructions;
    _.forEach(instructions, (ins: any) => {
      // check programid
      if (!isSystemProgram(ins.programId)) {
        return;
      }

      const { info, type } = (ins as ParsedInstruction).parsed;

      let amount = new BigNumber(0);
      switch (type) {
        case 'transfer':
        case 'transferWithSeed': {
          amount = new BigNumber(info.lamports);
          break;
        }
        default: {
          return;
        }
      }
      if (!amount.isZero()) {
        const currency = this.getCurrency();
        const senderEntry = {
          currency,
          amount: amount.toFixed(),
          address: info.source,
        };

        group.inEntries.push(senderEntry);

        const receiverEntry = {
          currency,
          amount: amount.toFixed(),
          address: info.destination,
        };
        group.outEntries.push(receiverEntry);
      }
    });

    return group;
  }

  public async estimateFee(options: { isConsolidate: boolean }): Promise<BigNumber> {
    const { fee } = await this.pollNewBlockhash();
    return new BigNumber(fee);
  }

  public async pollNewBlockhash(): Promise<IBlockhashInfo> {
    const timeSinceFetch = Utils.nowInMillis() - this._recentBlockHash.lastFetch;
    const retryCount = 10;
    const expired = timeSinceFetch >= BLOCKHASH_CACHE_TIMEOUT_MS;
    if (this._recentBlockHash.blockhash !== null && !expired) {
      return this._recentBlockHash;
    }
    const startTime = Utils.nowInMillis();
    // poll new blockhash
    for (let i = 0; i < retryCount; i++) {
      const { blockhash, feeCalculator } = await conn.getRecentBlockhash();
      if (this._recentBlockHash.blockhash !== blockhash) {
        this._recentBlockHash = {
          blockhash,
          lastFetch: Utils.nowInMillis(),
          fee: feeCalculator.lamportsPerSignature,
        };
        return this._recentBlockHash;
      }
      // Sleep for approximately half a slot
      await Utils.timeout(MS_PER_SLOT / 2);
    }
    throw new Error(`SolGateway::pollNewBlockhash Unable to obtain a new blockhash after ${Date.now() - startTime}ms`);
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {Block} block: the block detail
   */
  protected async _getOneBlock(blockNumber: string | number): Promise<Block> {
    try {
      if (typeof blockNumber === 'string') {
        blockNumber = parseInt(blockNumber, 10);
      }
      const block = await conn.getBlock(blockNumber);
      if (!block) {
        return null;
      }
      const txids: string[] = [];
      _.forEach(block.transactions, (tx: any) => {
        if (!tx.meta.err) {
          txids.push(tx.transaction.signatures[0]);
        }
      });
      return {
        txids,
        hash: block.blockhash,
        number: blockNumber,
        timestamp: block.blockTime,
      };
    } catch (error) {
      if (!(error.toString() as string).includes('was skipped')) {
        throw new Error(`SolGateway::_getOneBlock could not get info block=${blockNumber} due to error: ${error}`);
      }
      logger.error(`SolGateway::_getOneBlock could not get info block=${blockNumber} due to error: ${error}`);
      return null;
    }
  }

  /**
   * Get one transaction object
   *
   * @param {String} txid: the transaction hash
   * @returns {BscTransaction}: the transaction details
   */
  protected async _getOneTransaction(txid: string): Promise<SolTransaction> {
    const rawTx = await this.getRawTransaction(txid);
    if (!rawTx) {
      return null;
    }

    const [block, lastNetworkBlockNumber] = await Promise.all([this.getOneBlock(rawTx.slot), this.getBlockCount()]);
    const groupEntries = this.groupTransferEntries(rawTx);
    const rawSolTx = {
      txHash: rawTx.transaction.signatures[0],
      height: rawTx.slot,
      fee: groupEntries.fee,
      status: rawTx.meta.err ? false : true,
      outEntries: groupEntries.outEntries,
      inEntries: groupEntries.inEntries,
    };
    return new SolTransaction(
      CurrencyRegistry.Solana,
      rawSolTx,
      {
        hash: block.hash,
        number: block.number,
        timestamp: block.timestamp,
      },
      lastNetworkBlockNumber
    );
  }
}

export default SolGateway;
