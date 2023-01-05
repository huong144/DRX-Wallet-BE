import { PrimaryColumn, Column } from 'typeorm';

export abstract class XDeposit {
  @PrimaryColumn({ name: 'deposit_id', nullable: false })
  public depositId: number;

  @Column({ name: 'block_hash', nullable: false })
  public blockHash: string;

  @Column({ name: 'block_number', nullable: false })
  public blockNumber: number;

  @Column({ name: 'block_timestamp', nullable: false })
  public blockTimestamp: number;
}
