import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from 'typeorm';

@Entity('webhook')
export class Webhook extends BaseEntity {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'user_id', nullable: false })
  public userId: number;

  @Column({ name: 'type', nullable: false })
  public type: string;

  @Column({ name: 'url', nullable: false })
  public url: string;
}
