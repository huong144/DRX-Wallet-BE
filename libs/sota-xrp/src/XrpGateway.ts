import * as _ from 'lodash';
import util from 'util';
import sha256 from 'sha256';
import { getRpcClient } from './lib/RpcClient';
import {
  Transactions,
  BlockHeader,
  TransactionStatus,
  IRawTransaction,
  ISignedRawTransaction,
  Account,
  GatewayRegistry,
  CurrencyRegistry,
  AccountBasedGateway,
  BigNumber,
  getLogger,
  EnvConfigRegistry,
} from 'sota-common';
import { ResultStatus } from './enums/ResultStatus';
import XrpAccount from './XrpAccount';
import XrpKeyPair from './XrpKeyPair';
import XrpBlock from './XrpBlock';
import XrpTransaction from './XrpTransaction';
import { Outcome, FormattedTransactionType } from 'ripple-lib/dist/npm/transaction/types';
import { Payment } from 'ripple-lib/dist/npm/transaction/payment';
import { MaxAdjustment, Adjustment } from 'ripple-lib/dist/npm/common/types/objects';
import { hashesTx } from './lib/ts-ripple-hashes';
import { validate } from 'multicoin-address-validator';

const logger = getLogger('XrpGateway');

GatewayRegistry.registerLazyCreateMethod(CurrencyRegistry.Ripple, () => new XrpGateway());

class XrpGateway extends AccountBasedGateway {
  public constructor() {
    super(CurrencyRegistry.Ripple);
  }

  /**
   * Create new account
   *
   * @returns {XrpAccount}: the new account
   */
  public async createAccountAsync(): Promise<XrpAccount> {
    const client = await getRpcClient();
    const address = await client.generateAddress();
    const account = new XrpAccount(address);

    return account;
  }

  public getAccountFromPrivateKey(privateKey: string): Promise<Account> {
    throw new Error('Method not implemented.');
  }

  /**
   * Check a given address is valid
   *
   * @param address
   */
  public isValidAddressAsync(address: string): boolean {
    // Default just accept all value, need to be implemented on all derived classes
    // try {
    //   const client = await getRpcClient();
    //   const account = await client.getAccountInfo(address);
    //   return !!account;
    // } catch (e) {
    //   return false;
    // }

    // Validate offline, don't require account has been activated
    // return /^r[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
    const networkType = EnvConfigRegistry.isMainnet() ? 'prod' : 'testnet';
    const validAddress = validate(address, 'xrp', { networkType });
    if (!validAddress) {
      return false;
    }
    return true;
  }

  /**
   * Check a given address is need tag
   *
   * @param address
   */
  public async isNeedTagAsync(address: string): Promise<boolean> {
    // Default just accept all value, need to be implemented on all derived classes
    try {
      const client = await getRpcClient();
      const setting = await client.getSettings(address);
      return setting.requireDestinationTag;
    } catch (e) {
      return false;
    }
  }

  /**
   * derive Keypair
   *
   * @param {string} key: the secret of the wallet
   * @returns {XrpKeyPair}: the keypair of secret key
   */
  public async deriveKeyPair(key: string): Promise<XrpKeyPair> {
    const client = await getRpcClient();
    const response = await client.deriveKeypair(key);
    const keypair = new XrpKeyPair({
      privateKey: response.privateKey,
      publicKey: response.publicKey,
    });

    return keypair;
  }

  /**
   * No param
   * Returns the number of blocks in the local best block chain.
   * @returns {number}: the height of latest block on the block chain
   */
  public async getBlockCount(): Promise<number> {
    const client = await getRpcClient();
    const ledger = await client.getLedger();

    return ledger.ledgerVersion;
  }

  /**
   * Returns all transactions in givent block.
   *
   * @param {string|number} blockHash: header hash or height of the block
   * @returns {Transactions}: an array of transactions
   */
  public async getBlockTransactions(blockHash: string | number): Promise<Transactions> {
    throw new Error('getBlockTransactions(): XRP not support this method');
  }

  /**
   * Returns all transactions that matched with search condition.
   *
   * @param {Number} fromBlockNumber: number of begin block in search range
   * @param {Number} toBlockNumber: number of end block in search range
   * @returns {Transactions}: an array of transactions
   */
  public async getMultiBlocksTransactions(
    fromBlockNumber?: number,
    toBlockNumber?: number,
    addresss?: string | string[]
  ): Promise<Transactions> {
    throw new Error('getMultiBlocksTransactions(): XRP does not support this method');
  }

  /**
   * Returns all transactions that matched with search condition.
   *
   * @param {string} address: address of transactions
   * @param {Number} fromBlockNumber: number of begin block in search range
   * @param {Number} toBlockNumber: number of end block in search range
   * @returns {Transactions}: an array of transactions
   */
  public async getMultiBlocksTransactionsForAccount(
    address: string,
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<Transactions> {
    const client = await getRpcClient();

    const lastestBlock = await client.getLedger();
    const transactions = new Transactions();
    let txs: any;
    try {
      txs = await client.getTransactions(address, {
        minLedgerVersion: fromBlockNumber,
        maxLedgerVersion: toBlockNumber,
      });
    } catch (e) {
      if (e.name === 'MissingLedgerHistoryError') {
        logger.warn(`MissingLedgerHistoryError`);
        return transactions;
      }
      if (e.data && e.data.error_code === 55) {
        logger.warn(`${address} index is not found`);
        return transactions;
      }
      throw e;
    }

    const tasks = _.map(txs, async (txInfo: FormattedTransactionType) => {
      const outcome: Outcome = txInfo.outcome;
      const specification: Payment = txInfo.specification as Payment;
      const source: MaxAdjustment = specification.source as MaxAdjustment;
      const destination: Adjustment = specification.destination as Adjustment;

      const blockInfo = await client.getLedger({
        ledgerVersion: txInfo.outcome.ledgerVersion,
      });

      const block = new BlockHeader({
        hash: blockInfo.ledgerHash,
        number: blockInfo.ledgerVersion,
        timestamp: Date.parse(blockInfo.closeTime) / 1000,
      });

      const props = {
        txid: txInfo.id,
        from: source.address,
        to: destination.address,
        blockNumber: outcome.ledgerVersion,
        amount: parseFloat(source.maxAmount.value),
        timestamp: Date.parse(outcome.timestamp) / 1000,
        destinationTag: destination.tag || 0,
        resultStatus: outcome.result,
      };

      const tx = new XrpTransaction(props, block, lastestBlock.ledgerVersion);

      transactions.push(tx);
    });

    await Promise.all(tasks);
    return transactions;
  }

  /**
   * Returns all transactions that matched with search condition.
   *
   * @param {string[]} addresses: an array address of transactions
   * @param {Number} fromBlockNumber: number of begin block in search range
   * @param {Number} toBlockNumber: number of end block in search range
   * @returns {Transactions}: an array of transactions
   */
  public async getMultiBlocksTransactionsForAccounts(
    addresses: string[],
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<Transactions> {
    const transactions = new Transactions();
    const tasks = _.map(addresses, async (address: string) => {
      const txs = await this.getMultiBlocksTransactionsForAccount(address, fromBlockNumber, toBlockNumber);
      transactions.mutableConcat(txs);
    });

    await Promise.all(tasks);

    return transactions;
  }

  /**
   * Create a raw transaction that tranfers currencies
   * from an address (in most cast it's a hot wallet address)
   * to one or multiple addresses
   * This method is async because we need to check state of sender address
   * Errors can be throw if the sender's balance is not sufficient
   *
   */
  public async constructRawTransaction(
    fromAddress: string,
    toAddress: string,
    value: BigNumber,
    options: {
      isConsolidate?: boolean;
      destinationTag?: string;
    }
  ): Promise<IRawTransaction> {
    const payment: Payment = {
      source: {
        address: fromAddress,
        maxAmount: {
          value: value.toString(),
          currency: CurrencyRegistry.Ripple.symbol.toUpperCase(),
        },
      },
      destination: {
        address: toAddress,
        tag: options.destinationTag ? Number(options.destinationTag) : 0,
        amount: {
          value: value.toString(),
          currency: CurrencyRegistry.Ripple.symbol.toUpperCase(),
        },
      },
    };

    const client = await getRpcClient();
    const prepareTx = await client.preparePayment(fromAddress, payment, {
      maxLedgerVersionOffset: 100,
    });

    const result: IRawTransaction = {
      txid: sha256(prepareTx.txJSON),
      unsignedRaw: prepareTx.txJSON,
    };

    return result;
  }

  /**
   * Sign a raw transaction with single private key
   * Most likely is used to sign transaction sent from normal hot wallet
   *
   * @param {string} unsignedRaw is result of "createRawTransaction" method
   * @param {string} privateKey private key to sign, in string format
   *
   * @returns the signed transaction
   */
  public async signRawTransaction(unsignedRaw: string, privateKey: string): Promise<ISignedRawTransaction> {
    const client = await getRpcClient();
    const signedTx = await client.sign(unsignedRaw, privateKey);
    const result: ISignedRawTransaction = {
      txid: signedTx.id,
      unsignedRaw,
      signedRaw: signedTx.signedTransaction,
    };
    return result;
  }

  /**
   * Send raw transaction
   *
   * @param {string} rawTx: the hex-encoded transaction data
   * @returns {string}: the transaction hash in hex
   */
  public async sendRawTransaction(rawTx: string): Promise<any> {
    const client = await getRpcClient();
    try {
      await client.submit(rawTx);
      // generate transactions id from signed raw tx
      const txid = hashesTx(rawTx);
      return { txid };
    } catch (err) {
      logger.error(`XrpGateway::sendRawTransaction failed err=${util.inspect(err)}`);
      return null;
    }
  }

  /**
   * Get balance of an address
   *
   * @param {string} address: address that want to query balance
   * @returns {string}: the current balance of address
   */
  public async getAddressBalance(address: string): Promise<BigNumber> {
    const client = await getRpcClient();
    try {
      const account = await client.getAccountInfo(address);
      return new BigNumber(account.xrpBalance);
    } catch (err) {
      return new BigNumber(0);
    }
  }

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {boolean}: the confirmed status
   */
  public async isTransactionConfirmed(txid: string): Promise<boolean> {
    const tx = (await this.getOneTransaction(txid)) as XrpTransaction;
    const block = await this.getOneBlock(tx.height);
    const lastestBlock = await this.getBlockCount();
    const enoughConfirmed = lastestBlock - block.number >= this.getCurrencyConfig().requiredConfirmations;
    return enoughConfirmed;
  }

  /**
   * Check whether a transaction is finalized on blockchain network
   *
   * @param {string} txid: the hash/id of transaction need to be checked
   * @returns {string}: the tx status
   */
  public async getTransactionStatus(txid: string): Promise<TransactionStatus> {
    const tx = (await this.getOneTransaction(txid)) as XrpTransaction;
    if (!tx) {
      return TransactionStatus.UNKNOWN;
    }

    if (tx.confirmations < this.getCurrencyConfig().requiredConfirmations) {
      return TransactionStatus.CONFIRMING;
    }

    if (tx.resultStatus !== ResultStatus.SUCCESS) {
      return TransactionStatus.FAILED;
    }

    return TransactionStatus.COMPLETED;
  }

  /**
   * minimum fee for seeding in almost case
   */
  public async getAverageSeedingFee(): Promise<BigNumber> {
    throw new Error(`TODO: Implement me.`);
  }

  /**
   * Get one transaction object
   *
   * @param {string} txid: the transaction hash
   * @returns {XrpTransaction}: the transaction details
   */
  protected async _getOneTransaction(txid: string): Promise<XrpTransaction> {
    const client = await getRpcClient();

    let txInfo;
    try {
      txInfo = await client.getTransaction(txid);
    } catch (e) {
      if (e.name === 'MissingLedgerHistoryError') {
        logger.error(`${e.name} missing ${txid}`);
        return null;
      }
      throw e;
    }
    const outcome: Outcome = txInfo.outcome;
    const specification: Payment = txInfo.specification as Payment;
    const source: MaxAdjustment = specification.source as MaxAdjustment;
    const destination: Adjustment = specification.destination as Adjustment;

    const lastestBlock = await client.getLedger();
    const blockInfo = await client.getLedger({
      ledgerVersion: txInfo.outcome.ledgerVersion,
    });
    const block = new BlockHeader({
      hash: blockInfo.ledgerHash,
      number: blockInfo.ledgerVersion,
      timestamp: Date.parse(blockInfo.closeTime) / 1000,
    });

    const props = {
      txid: txInfo.id,
      from: source.address,
      to: destination.address,
      blockNumber: outcome.ledgerVersion,
      amount: parseFloat(source.maxAmount.value),
      timestamp: Date.parse(outcome.timestamp) / 1000,
      destinationTag: destination.tag || 0,
      resultStatus: outcome.result,
    };

    const tx = new XrpTransaction(props, block, lastestBlock.ledgerVersion);
    return tx;
  }

  /**
   * Get block details in application-specified format
   *
   * @param {string|number} blockHash: the block hash (or block number in case the parameter is Number)
   * @returns {XrpBlock} block: the block detail
   */
  protected async _getOneBlock(blockHash: number): Promise<XrpBlock> {
    const client = await getRpcClient();

    let blockInfo: any;
    try {
      blockInfo = await client.getLedger({
        ledgerVersion: blockHash,
      });
    } catch (e) {
      const emptyBlock = new XrpBlock({
        hash: null,
        number: blockHash,
        timestamp: null,
        txids: [], // block return transactions is undefined, so it should be set an empty array as default
      });
      if (e.name === 'MissingLedgerHistoryError') {
        logger.warn(`MissingLedgerHistoryError`);
        return emptyBlock;
      }
      if (e.data.error_code === 21) {
        logger.warn(`${blockHash} ledger is not found`);
        return emptyBlock;
      }
      throw e;
    }

    const block = new XrpBlock({
      hash: blockInfo.ledgerHash,
      number: blockInfo.ledgerVersion,
      timestamp: Date.parse(blockInfo.closeTime) / 1000,
      txids: [], // block return transactions is undefined, so it should be set an empty array as default
    });

    return block;
  }
}

export { XrpGateway };
