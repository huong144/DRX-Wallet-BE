import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, BeforeUpdate, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('internal_transfer')
export class InternalTransfer extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'wallet_id', nullable: false })
  public walletId: number;

  @Column({ nullable: false })
  public currency: string;

  @Column({ name: 'type', nullable: false })
  public type: string;

  @Column({ name: 'from_address', nullable: false })
  public fromAddress: string;

  @Column({ name: 'to_address', nullable: false })
  public toAddress: string;

  @Column({ nullable: false })
  public txid: string;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: false })
  public amount: string;

  @Column({ type: 'decimal', precision: 40, scale: 8, nullable: false })
  public fee: string;

  @Column('varchar', { length: 20, name: 'status', nullable: false })
  public status: string;

  @Column('varchar', { length: 200, name: 'fee_currency', nullable: true })
  public feeCurrency: string;

  @Column({ name: 'created_at', type: 'bigint' })
  public createdAt: number;

  @Column({ name: 'updated_at', type: 'bigint' })
  public updatedAt: number;

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
