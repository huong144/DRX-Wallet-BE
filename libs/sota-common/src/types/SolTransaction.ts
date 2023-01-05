import BigNumber from 'bignumber.js';
import { ICurrency } from '../interfaces';
import BlockHeader from './BlockHeader';
import MultiEntriesTransaction, { IMultiEntriesTxEntry, IMultiEntriesTxProps } from './MultiEntriesTransaction';

export interface ISolanaRawTransaction {
  readonly txHash: string;
  readonly height: number;
  readonly fee: BigNumber;
  readonly status: boolean;
  readonly outEntries: IMultiEntriesTxEntry[];
  readonly inEntries: IMultiEntriesTxEntry[];
}

export class SolTransaction extends MultiEntriesTransaction {
  public readonly txStatus: boolean;
  public readonly block: BlockHeader;
  public readonly currency: ICurrency;
  public readonly fee: BigNumber;

  constructor(currency: ICurrency, tx: ISolanaRawTransaction, block: BlockHeader, lastNetworkBlockNumber: number) {
    const props: IMultiEntriesTxProps = {
      outputs: tx.outEntries,
      inputs: tx.inEntries,
      block,
      lastNetworkBlockNumber,
      txid: tx.txHash,
    };
    super(currency, props);

    this.currency = currency;
    this.txStatus = tx.status;
    this.block = block;
    this.fee = tx.fee;
    this.isFailed = !this.txStatus;
  }

  public getNetworkFee(): BigNumber {
    return new BigNumber(this.fee);
  }
}

export default SolTransaction;
