import { Entity, PrimaryGeneratedColumn, BeforeInsert, Column, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('deposit_log')
export class DepositLog extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'deposit_id', nullable: false })
  public depositId: number;

  @Column({ name: 'event', nullable: false })
  public event: string;

  @Column({ name: 'ref_id', nullable: false })
  public refId: number;

  @Column({ name: 'data' })
  public data: string;

  @Column({ name: 'created_at', type: 'bigint' })
  public createdAt: number;

  @BeforeInsert()
  public updateCreateDates() {
    this.createdAt = Utils.nowInMillis();
  }
}
