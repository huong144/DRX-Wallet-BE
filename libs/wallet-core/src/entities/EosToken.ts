import { Entity, PrimaryColumn, Column, BaseEntity } from 'typeorm';

@Entity('eos_token')
export class EosToken extends BaseEntity {
  @PrimaryColumn({ name: 'symbol', nullable: false })
  public symbol: string;

  @Column({ name: 'code', nullable: false })
  public code: string;

  @Column({ name: 'scale', nullable: false })
  public scale: number;

  @Column({ name: 'network', nullable: false })
  public network: string;
}
