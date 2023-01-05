import { Entity, PrimaryGeneratedColumn, BeforeInsert, Column } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('webhook_log')
export class WebhookLog {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'webhook_progress_id', nullable: false })
  public progressId: number;

  @Column({ name: 'url', nullable: false })
  public url: string;

  @Column({ name: 'params', nullable: false })
  public params: string;

  @Column({ name: 'status', nullable: false })
  public status: number;

  @Column({ name: 'msg' })
  public msg: string;

  @Column({ name: 'created_at', type: 'bigint' })
  public createdAt: number;

  @BeforeInsert()
  public updateCreateDates() {
    this.createdAt = Utils.nowInMillis();
  }
}
