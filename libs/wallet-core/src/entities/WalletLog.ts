import { Utils } from 'sota-common';
import { Entity, BeforeInsert, BeforeUpdate, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('wallet_log')
export class WalletLog {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'wallet_id', nullable: false })
  public walletId: number;

  @Column({ name: 'currency', nullable: false })
  public currency: string;

  @Column({ name: 'event', nullable: false })
  public event: string;

  @Column({ name: 'balance_change', type: 'decimal', precision: 40, scale: 8, nullable: false })
  public balanceChange: string;

  @Column({ name: 'data', type: 'text' })
  public data: string;

  @Column({ name: 'ref_id', nullable: false })
  public refId: number;

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
