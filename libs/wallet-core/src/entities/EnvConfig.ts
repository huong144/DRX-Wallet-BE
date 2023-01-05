import { Entity, PrimaryColumn, Column, BeforeInsert, BeforeUpdate, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('env_config')
export class EnvConfig extends BaseEntity {
  @PrimaryColumn({ name: 'key' })
  public key: string;

  @Column({ name: 'value' })
  public value: string;

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
