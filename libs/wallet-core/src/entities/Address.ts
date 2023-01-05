import { Entity, PrimaryColumn, Column, BeforeInsert, BeforeUpdate, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';
import Kms from '../encrypt/Kms';

@Entity('address')
export class Address extends BaseEntity {
  @Column({ name: 'wallet_id' })
  public walletId: number;

  @Column({ name: 'currency' })
  public currency: string;

  @PrimaryColumn({ name: 'address' })
  public address: string;

  @Column({ name: 'is_external' })
  public isExternal: boolean;

  @Column({ name: 'is_hd' })
  public isHd: boolean;

  @PrimaryColumn({ name: 'hd_path' })
  public hdPath: string;

  @PrimaryColumn({ name: 'secret' })
  public secret: string;

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
