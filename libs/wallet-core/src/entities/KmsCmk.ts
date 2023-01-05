import { Utils } from 'sota-common';
import { Entity, PrimaryColumn, Column, BeforeUpdate, BeforeInsert, BaseEntity } from 'typeorm';

@Entity('kms_cmk')
export class KmsCmk extends BaseEntity {
  @PrimaryColumn({ nullable: false })
  public id: string;

  @Column({ name: 'region', nullable: false })
  public region: string;

  @Column({ name: 'alias', nullable: false })
  public alias: string;

  @Column({ name: 'arn', nullable: false })
  public arn: string;

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
