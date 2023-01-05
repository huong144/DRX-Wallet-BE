import { Entity, PrimaryGeneratedColumn, BeforeInsert, Column } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('withdrawal_log')
export class WithdrawalLog {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'withdrawal_id', nullable: false })
  public withdrawalId: number;

  @Column({ name: 'ref_id', nullable: false })
  public refId: number;

  @Column({ name: 'event', nullable: false })
  public event: string;

  @Column({ name: 'data' })
  public data: string;

  @Column({ name: 'created_at', type: 'bigint' })
  public createdAt: number;

  @BeforeInsert()
  public updateCreateDates() {
    this.createdAt = Utils.nowInMillis();
  }
}
