import { Transaction } from './Transaction';

export class GenericTransactions<T extends Transaction> extends Array<T> {
  constructor() {
    super();
    Object.setPrototypeOf(this, Object.create(GenericTransactions.prototype));
  }

  /**
   * Group GenericTransactions by recipient addresses
   * Result is a map that key is address and value is transaction array
   */
  public groupByRecipients(): Map<string, GenericTransactions<T>> {
    const result = new Map<string, GenericTransactions<T>>();
    this.forEach(tx => {
      const addresses = tx.extractRecipientAddresses();
      addresses.forEach(address => {
        if (!result.get(address)) {
          result.set(address, new GenericTransactions<T>());
        }
        result.get(address).push(tx);
      });
    });

    return result;
  }

  public mutableConcat(txs: T[]): void {
    this.push(...txs);
  }
}

export default GenericTransactions;
