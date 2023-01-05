import { Utils } from 'sota-common';
import { Entity, BeforeInsert, BeforeUpdate, PrimaryColumn, Column, BaseEntity } from 'typeorm';

@Entity('wallet_balance')
export class WalletBalance extends BaseEntity {
  @PrimaryColumn({ name: 'wallet_id', nullable: false })
  public walletId: number;

  @PrimaryColumn({ name: 'currency', nullable: false })
  public currency: string;

  @Column({ name: 'created_at', type: 'bigint' })
  public createdAt: number;

  @Column({ name: 'updated_at', type: 'bigint' })
  public updatedAt: number;

  @Column({ name: 'balance', nullable: false })
  public balance: string;

  @Column({ name: 'withdrawal_pending', nullable: false })
  public withdrawalPending: string;

  @Column({ name: 'withdrawal_total', nullable: false })
  public withdrawalTotal: string;

  @Column({
    name: 'lower_threshold',
    type: 'decimal',
    precision: 40,
    scale: 8,
    nullable: false,
  })
  public lowerThreshold: string;

  @Column({
    name: 'upper_threshold',
    type: 'decimal',
    precision: 40,
    scale: 8,
    nullable: false,
  })
  public upperThreshold: string;

  @Column({
    name: 'middle_threshold',
    type: 'decimal',
    precision: 40,
    scale: 8,
    nullable: true,
  })
  public middleThreshold: string;

  @Column({
    name: 'minimum_collect_amount',
    type: 'decimal',
    precision: 40,
    scale: 8,
    nullable: false,
  })
  public minimumCollectAmount: string;

  @BeforeInsert()
  public updateCreateDates() {
    this.createdAt = Utils.nowInMillis();
    this.updatedAt = Utils.nowInMillis();
  }

  @BeforeUpdate()
  public updateUpdateDates() {
    this.updatedAt = Utils.nowInMillis();
  }
}
