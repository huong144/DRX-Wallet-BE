import _ from 'lodash';
import { Address, Transaction, ICurrency } from '../..';
import BigNumber from 'bignumber.js';

interface ITransferEntryProps {
  readonly currency: ICurrency;
  readonly txid: string;
  readonly address: Address;
  readonly amount: BigNumber;
  tx: Transaction;
}

export class TransferEntry implements ITransferEntryProps {
  /**
   * There're many cases that an address is involved in various entries
   * This method help to calculate and unify them
   * In the final result, each address is only involved in one entry
   *
   * @param entries
   */
  public static mergeEntries(entries: TransferEntry[]): TransferEntry[] {
    const result: TransferEntry[] = [];
    entries = _.compact(entries);

    // Travesal all the entries
    entries.map(entry => {
      // Check whether the result includes entry's address already
      const item = result.find(i => i.address === entry.address);

      // If not, just put entry to the result
      if (!item) {
        result.push(entry);
        return;
      }

      // Otherwise find the result entry
      const itemIndex = result.findIndex(i => i.address === entry.address);

      // Since amount is readonly property, we have to remove old item and add the new one into result
      result.splice(itemIndex, 1);
      const amount = entry.amount.plus(item.amount);
      const newEntry: TransferEntry = Object.assign({}, entry, { amount });
      result.push(newEntry);
    });

    return result;
  }

  public readonly currency: ICurrency;
  public readonly txid: string;
  public readonly address: Address;
  public readonly amount: BigNumber;
  public readonly tx: Transaction;

  constructor(props: ITransferEntryProps) {
    Object.assign(this, props);
  }
}

export default TransferEntry;
