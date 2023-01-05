import BigNumber from 'bignumber.js';
import BaseGateway from './BaseGateway';
import { ICurrency, IRawTransaction } from './interfaces';
import { Address } from './types';

export abstract class SolanaBasedGateway extends BaseGateway {
  // to deploy transaction to network
  public constructor(currency: ICurrency) {
    super(currency);
  }

  /**
   * minimum fee for a transaction may include instruction for creating associated token account
   * @param {boolean} createAssociatedAccount
   */
  public abstract getAverageSeedingFee(createAssociatedAccount?: boolean): Promise<BigNumber>;

  /**
   * minimum cost to create associated token account
   */
  public abstract getMinimumBalanceForRentExemption(): Promise<BigNumber>;

  /**
   * Create a raw transaction that tranfers currencies
   * from an address (in most cast it's a hot wallet address)
   * to one or multiple addresses
   * This method is async because we need to check state of sender address
   * Errors can be throw if the sender's balance is not sufficient
   * @param {boolean} needFunding - true if the recipient needs funding to create a token account
   * @param {boolean} maintainRent - true if the sender needs to maintain a minimum balance to not pay rent
   * @returns {IRawTransaction}
   */
  public abstract constructRawTransaction(
    fromAddress: Address,
    toAddress: Address,
    amount: BigNumber,
    options: {
      isConsolidate?: boolean;
      needFunding?: boolean;
      maintainRent?: boolean;
    }
  ): Promise<IRawTransaction>;
}
