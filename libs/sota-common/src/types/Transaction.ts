import util from 'util';
import BigNumber from 'bignumber.js';
import { Address, BlockHeader, TransferEntry } from '../..';
import { ICurrency } from '../interfaces';

interface ITransactionProps {
  readonly txid: string;
  readonly height: number;
  readonly timestamp: number;
  confirmations: number;
}

/**
 * This class is usually used when crawling and analyzing data from network
 * That means these kind of transactions were sent and processed already
 * We'll not use this class for constructing new transactions
 */
export abstract class Transaction implements ITransactionProps {
  public readonly currency: ICurrency;
  public readonly txid: string;
  public readonly height: number;
  public readonly timestamp: number;
  public readonly block: BlockHeader;
  public confirmations: number;
  public isFailed: boolean;

  protected _allEntries: TransferEntry[];

  constructor(currency: ICurrency, props: ITransactionProps, block: BlockHeader) {
    Object.assign(this, props);
    this.currency = currency;
    this.block = block;
    this.isFailed = false;
    this._allEntries = [];
  }

  /**
   * Calculate the network fee that was consumed in the transaction
   */
  public abstract getNetworkFee(): BigNumber;

  /**
   * Extract all changes from a transaction
   *
   * @returns {TransferEntry[]} array of transfer entries
   */
  public extractEntries(): TransferEntry[] {
    if (!this._allEntries.length) {
      this._allEntries = this._extractEntries();
    }

    return this._allEntries;
  }

  /**
   * Extract all positive entries
   * These are recipients' enties
   */
  public extractOutputEntries(): TransferEntry[] {
    const entries: TransferEntry[] = this.extractEntries();
    return entries.filter(e => e.amount.gte(0));
  }

  /**
   * Extract all negative entries
   * These are senders' enties
   */
  public extractInputEntries(): TransferEntry[] {
    const entries: TransferEntry[] = this.extractEntries();
    return entries.filter(e => e.amount.lt(0));
  }

  /**
   * Extract recipient addresses.
   *
   * @returns {string[]} array of addresses under string format
   */
  public extractRecipientAddresses(): Address[] {
    // Recipients are addresses from transfer outputs
    // which have positive amount
    return this.extractOutputEntries().map(t => t.address);
  }

  /**
   * Extract sender addresses
   */
  public extractSenderAddresses(): Address[] {
    // With entries that balance change avalue is negative,
    // that is balance changing of senders
    return this.extractInputEntries().map(t => t.address);
  }

  /**
   * Additional field for special field of some kind of transaction
   * This is sicked though
   * TODO: FIXME
   */
  public extractAdditionalField(): any {
    return {};
  }

  /**
   * Another pain...
   * TODO: FIXME
   */
  public getExtraDepositData(): any {
    return {
      blockHash: this.block.hash,
      blockNumber: this.height,
      blockTimestamp: this.timestamp,
    };
  }

  public abstract _extractEntries(): TransferEntry[];
}

export default Transaction;
