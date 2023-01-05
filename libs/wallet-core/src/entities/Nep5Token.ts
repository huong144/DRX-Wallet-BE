import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('nep5_token')
export class Nep5Token {
  @PrimaryColumn({ name: 'symbol', nullable: false })
  public symbol: string;

  @Column({ name: 'name', nullable: false })
  public name: string;

  @Column({ name: 'script_hash', nullable: false })
  public scriptHash: string;

  @Column({ name: 'decimal', nullable: false })
  public decimal: number;

  @Column({ name: 'network', nullable: false })
  public network: string;

  @Column({ name: 'total_supply', nullable: false })
  public totalSupply: string;
}
