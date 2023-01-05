import { BaseGateway } from '..';
import { IRawVOut, IRawTransaction, IInsightUtxoInfo } from './interfaces';

export abstract class UTXOBasedGateway extends BaseGateway {
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
    fromAddresses: string | string[],
    vouts: IRawVOut[]
  ): Promise<IRawTransaction>;

  public abstract constructRawConsolidateTransaction(
    utxos: IInsightUtxoInfo[],
    toAddress: string
  ): Promise<IRawTransaction>;

  /**
   * Re-construct raw transaction from output of "constructRawTransaction" method
   * @param rawTx
   */
  public abstract reconstructRawTx(rawTx: string): IRawTransaction;

  /**
   * Usually use to make sure the raw transaction has been constructed correctly
   * The hex data from original construction and re-construction should be exactly same
   *
   * @param rawTx
   */
  protected validateRawTx(rawTx: IRawTransaction): boolean {
    const tx = this.reconstructRawTx(rawTx.unsignedRaw);
    return tx.txid === rawTx.txid && tx.unsignedRaw === rawTx.unsignedRaw;
  }
}
