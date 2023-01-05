import { Entity, PrimaryColumn, Column, BeforeInsert, BeforeUpdate } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('address')
export class Address {
  @Column({ name: 'wallet_id' })
  public walletId: number;

  @Column({ name: 'currency' })
  public currency: string;

  @PrimaryColumn({ name: 'address' })
  public address: string;

  @PrimaryColumn({ name: 'secret' })
  public secret: string;

  @Column({ name: 'is_external' })
  public isExternal: number;

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
