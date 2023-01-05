import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('trc20_token')
export class Trc20Token {
  @PrimaryColumn({ name: 'symbol', nullable: false })
  public symbol: string;

  @Column({ name: 'name', nullable: false })
  public name: string;

  @Column({ name: 'contract_address', nullable: false })
  public contractAddress: string;

  @Column({ name: 'decimal', nullable: false })
  public decimal: number;

  @Column({ name: 'total_supply', nullable: false })
  public totalSupply: string;

  @Column({ name: 'network', nullable: false })
  public network: string;
}
