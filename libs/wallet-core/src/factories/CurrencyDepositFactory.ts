import { ICurrency } from 'sota-common';
import { XDeposit } from '../entities';

/**
 * To instantiate XxxDeposit entity
 */

const registry = new Map<string, () => XDeposit>();

export const CurrencyDepositFactory = {
  register(currency: ICurrency, callback: () => XDeposit) {
    registry.set(currency.symbol, callback);
  },

  create(currency: ICurrency): XDeposit {
    const callback = registry.get(currency.symbol);
    if (!callback) {
      throw new Error(`Callback for currency ${currency.symbol} wasn't set yet.`);
    }

    return callback();
  },
};

export default CurrencyDepositFactory;
