import { Utils } from 'sota-common';
import { Entity, PrimaryGeneratedColumn, Column, BeforeUpdate, BeforeInsert, BaseEntity } from 'typeorm';

@Entity('kms_data_key')
export class KmsDataKey extends BaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  public id: number;

  @Column({ name: 'cmk_id', nullable: false })
  public cmkId: string;

  @Column({ name: 'encrypted_data_key', nullable: false })
  public encryptedDataKey: string;

  @Column({ type: 'tinyint', name: 'is_enabled', nullable: false })
  public isEnabled: number;

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
