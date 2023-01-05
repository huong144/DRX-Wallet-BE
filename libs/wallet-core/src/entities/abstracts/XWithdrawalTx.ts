import { PrimaryColumn, Column } from 'typeorm';

export abstract class XWithdrawalTx {
  @PrimaryColumn({ name: 'withdrawal_tx_id', nullable: false })
  public withdrawalTxId: number;
}
