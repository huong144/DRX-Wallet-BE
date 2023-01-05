import { Entity, PrimaryGeneratedColumn, BeforeInsert, BeforeUpdate, Column, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('webhook_progress')
export class WebhookProgress extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'webhook_id', nullable: false })
  public webhookId: number;

  @Column({ name: 'type', nullable: false })
  public type: string;

  @Column({ name: 'ref_id', nullable: false })
  public refId: number;

  @Column({ name: 'event', nullable: false })
  public event: string;

  @Column({ name: 'is_processed' })
  public isProcessed: boolean;

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
