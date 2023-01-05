import BigNumber from 'bignumber.js';
import { IRawTransaction } from './interfaces';
import { BaseGateway } from './BaseGateway';
import { Address } from './types';

export abstract class AccountBasedGateway extends BaseGateway {
  /**
   * Create a raw transaction that tranfers currencies
   * from an address (in most cast it's a hot wallet address)
   * to one or multiple addresses
   * This method is async because we need to check state of sender address
   * Errors can be throw if the sender's balance is not sufficient
   *
   * @returns {IRawTransaction}
   */
  public abstract constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    amount: BigNumber,
    options: {
      isConsolidate?: boolean;
      destinationTag?: string;
      useLowerNetworkFee?: boolean;
    }
  ): Promise<IRawTransaction>;
}
