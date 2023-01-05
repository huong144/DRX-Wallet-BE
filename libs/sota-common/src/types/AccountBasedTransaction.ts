import BigNumber from 'bignumber.js';
import { ICurrency } from '../interfaces';
import { Address } from './Address';
import { Transaction } from './Transaction';
import { BlockHeader } from './BlockHeader';
import { TransferEntry } from './TransferEntry';

interface IAccountBasedTransactionProps {
  readonly txid: string;
  readonly height: number;
  readonly timestamp: string | number;
  confirmations: number;
  readonly fromAddress: Address;
  readonly toAddress: Address;
  readonly amount: BigNumber;
  readonly data?: string;
}

export abstract class AccountBasedTransaction extends Transaction {
  public readonly fromAddress: Address;
  public readonly toAddress: Address;
  public readonly amount: BigNumber;

  constructor(currency: ICurrency, tx: IAccountBasedTransactionProps, block: BlockHeader) {
    // Construct tx props
    const txProps = {
      confirmations: tx.confirmations,
      height: block.number,
      timestamp: new Date(block.timestamp).getTime(),
      txid: tx.txid,
    };

    // Construct base transaction
    super(currency, txProps, block);

    this.fromAddress = tx.fromAddress;
    this.toAddress = tx.toAddress;
    this.amount = tx.amount;
  }

  public _extractEntries(): TransferEntry[] {
    if (this.amount.isZero()) {
      return [];
    }

    const senderEntry = new TransferEntry({
      currency: this.currency,
      amount: this.amount.times(-1),
      address: this.fromAddress,
      tx: this,
      txid: this.txid,
    });

    const receiverEntry = new TransferEntry({
      currency: this.currency,
      amount: this.amount,
      address: this.toAddress,
      tx: this,
      txid: this.txid,
    });

    return [senderEntry, receiverEntry];
  }
}
