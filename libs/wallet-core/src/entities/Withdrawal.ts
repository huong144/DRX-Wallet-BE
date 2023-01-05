import { Entity, PrimaryGeneratedColumn, Column, BeforeInsert, BeforeUpdate, BaseEntity } from 'typeorm';
import { Utils, BigNumber } from 'sota-common';

@Entity('withdrawal')
export class Withdrawal extends BaseEntity {
  @PrimaryGeneratedColumn({ name: 'id', type: 'bigint' })
  public id: number;

  @Column('int', { name: 'user_id', nullable: false })
  public userId: number;

  @Column('int', { name: 'wallet_id', nullable: false })
  public walletId: number;

  @Column('varchar', { name: 'currency', nullable: false })
  public currency: string;

  @Column('int', { name: 'withdrawal_tx_id', nullable: false })
  public withdrawalTxId: number;

  @Column('varchar', { length: 100, name: 'txid', nullable: false })
  public txid: string;

  @Column('varchar', { length: 100, name: 'from_address', nullable: false })
  public fromAddress: string;

  @Column('varchar', { length: 100, name: 'to_address', nullable: false })
  public toAddress: string;

  @Column('decimal', { name: 'amount', nullable: false })
  public amount: string;

  @Column('varchar', { length: 20, name: 'status', nullable: false })
  public status: string;

  @Column('varchar', { length: 100, name: 'note', nullable: false })
  public note: string;

  @Column('varchar', { length: 255, name: 'hash_check', nullable: false })
  public hashCheck: string;

  @Column('int', { name: 'kms_data_key_id', nullable: true })
  public kmsDataKeyId: number | null;

  @Column({ name: 'created_at', type: 'bigint' })
  public createdAt: number;

  @Column({ name: 'updated_at', type: 'bigint' })
  public updatedAt: number;

  public getAmount(): BigNumber {
    return new BigNumber(this.amount);
  }

  public getTag(): string {
    if (this.note === 'cold_wallet') {
      return null;
    }

    try {
      const note = JSON.parse(this.note);
      return note.tag.toString();
    } catch (e) {
      return null;
    }
  }

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
