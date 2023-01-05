import { Transaction } from './Transaction';
import { ICurrency } from '../interfaces';
import { BlockHeader } from './BlockHeader';
import TransferEntry from './TransferEntry';
import { BigNumber } from 'bignumber.js';

export interface IMultiEntriesTransactionProps {
  readonly txid: string;
  readonly fee: BigNumber;
}

export interface IMultiEntriesTxEntry {
  readonly address: string;
  readonly currency: ICurrency;
  readonly amount: string;
}
// All in v Ins
export interface IMultiEntriesTxProps {
  readonly txid: string;
  readonly inputs: IMultiEntriesTxEntry[];
  readonly outputs: IMultiEntriesTxEntry[];
  readonly block: BlockHeader;
  readonly lastNetworkBlockNumber: number;
}

export abstract class MultiEntriesTransaction extends Transaction {
  public readonly outputs: IMultiEntriesTxEntry[];
  public readonly inputs: IMultiEntriesTxEntry[];
  constructor(currency: ICurrency, props: IMultiEntriesTxProps) {
    super(
      currency,
      {
        confirmations: props.lastNetworkBlockNumber - props.block.number + 1,
        height: props.block.number,
        timestamp: new Date(props.block.timestamp).getTime(),
        txid: props.txid,
      },
      props.block
    );
    this.inputs = props.inputs;
    this.outputs = props.outputs;
  }

  public _extractEntries(): TransferEntry[] {
    const entries: TransferEntry[] = [];

    this.inputs.forEach(vIn => {
      const entry = this._convertVInToTransferEntry(vIn);
      if (entry) {
        entries.push(entry);
      }
    });

    // All in v Outs
    this.outputs.forEach(vOut => {
      const entry = this._convertVoutToTransferEntry(vOut);
      if (entry) {
        entries.push(entry);
      }
    });

    return TransferEntry.mergeEntries(entries);
  }
  public getExtraDepositData(): any {
    return Object.assign({}, super.getExtraDepositData(), {});
  }

  protected _convertVInToTransferEntry(vIn: IMultiEntriesTxEntry): TransferEntry {
    return {
      amount: new BigNumber(-vIn.amount),
      currency: vIn.currency,
      address: vIn.address,
      txid: this.txid,
      tx: this,
    };
  }

  protected _convertVoutToTransferEntry(vOut: IMultiEntriesTxEntry): TransferEntry {
    return {
      amount: new BigNumber(vOut.amount),
      currency: vOut.currency,
      address: vOut.address,
      txid: this.txid,
      tx: this,
    };
  }
}

export default MultiEntriesTransaction;
