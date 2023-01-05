import { Utils, getLogger } from 'sota-common';
import { Entity, Column, PrimaryColumn, BeforeInsert, BeforeUpdate, BaseEntity } from 'typeorm';
import Kms from '../encrypt/Kms';

const logger = getLogger('HotWallet');

@Entity('hot_wallet')
export class HotWallet extends BaseEntity {
  @Column('int', { name: 'user_id', nullable: false })
  public userId: number;

  @Column('int', { name: 'wallet_id', nullable: false })
  public walletId: number;

  @PrimaryColumn({ name: 'address', nullable: false })
  public address: string;

  @Column({ name: 'currency', nullable: false })
  public currency: string;

  @Column({ name: 'type' })
  public type: string;

  @Column({ name: 'secret', nullable: false })
  public secret: string;

  @Column({ name: 'balance', nullable: false, precision: 40, scale: 8 })
  public balance: string;

  @Column({ type: 'tinyint', name: 'is_external', nullable: false })
  public isExternal: boolean;

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

  public async extractRawPrivateKey(): Promise<string> {
    let rawPrivateKey = this.secret;

    try {
      const secret = JSON.parse(rawPrivateKey);
      if (secret.private_key) {
        rawPrivateKey = secret.private_key;
        if (secret.kms_data_key_id > 0) {
          rawPrivateKey = await Kms.getInstance().decrypt(secret.private_key, secret.kms_data_key_id);
        }
      }

      if (secret.spending_password) {
        if (secret.kms_data_key_id > 0) {
          secret.spending_password = await Kms.getInstance().decrypt(secret.spending_password, secret.kms_data_key_id);
          rawPrivateKey = JSON.stringify(secret);
        }
      }
    } catch (e) {
      // If raw private key is not stored in JSON format, we'll just leave as it is
    }
    return rawPrivateKey;
  }
}
