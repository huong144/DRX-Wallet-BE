import { Utils } from 'sota-common';
import { Entity, PrimaryColumn, Column, BeforeUpdate, BeforeInsert, BaseEntity } from 'typeorm';

@Entity('latest_block')
export class LatestBlock extends BaseEntity {
  @PrimaryColumn()
  public currency: string;

  @PrimaryColumn()
  public type: string;

  @Column({ name: 'block_number', nullable: false })
  public blockNumber: number;

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
