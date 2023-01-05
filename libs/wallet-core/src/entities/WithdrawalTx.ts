import { Index, Entity, Column, PrimaryGeneratedColumn, BeforeInsert, BeforeUpdate, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('withdrawal_tx')
@Index('withdrawal_raw_unsigned_txid_unique', ['unsignedTxid'], {
  unique: true,
})
@Index('withdrawal_raw_txid_unique', ['txid'], { unique: true })
@Index('withdrawal_raw_created_at_index', ['createdAt'])
@Index('withdrawal_raw_updated_at_index', ['updatedAt'])
export class WithdrawalTx extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column('varchar', { name: 'hot_wallet_address', nullable: false })
  public hotWalletAddress: string;

  @Column('varchar', { name: 'txid', nullable: true, unique: true })
  public txid: string | null;

  @Column('varchar', { length: 20, name: 'status', nullable: false })
  public status: string;

  @Column('varchar', { length: 10, name: 'currency', nullable: false })
  public currency: string;

  @Column('varchar', { name: 'unsigned_txid', nullable: false, unique: true })
  public unsignedTxid: string;

  @Column('text', { name: 'unsigned_raw', nullable: true })
  public unsignedRaw: string | null;

  @Column('text', { name: 'signed_raw', nullable: true })
  public signedRaw: string | null;

  @Column({ name: 'block_number', nullable: true })
  public blockNumber: number;

  @Column({ name: 'block_hash', nullable: true })
  public blockHash: string;

  @Column({ name: 'block_timestamp', nullable: true })
  public blockTimestamp: number;

  @Column({ name: 'fee_amount', nullable: true })
  public feeAmount: string;

  @Column({ name: 'fee_currency', nullable: true })
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
