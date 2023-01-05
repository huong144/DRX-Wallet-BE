import { Entity, BeforeInsert, BeforeUpdate, Column, PrimaryColumn, BaseEntity } from 'typeorm';
import { Utils } from 'sota-common';

@Entity('currency_config')
export class CurrencyConfig extends BaseEntity {
  @PrimaryColumn({ name: 'currency', nullable: false })
  public currency: string;

  @Column({ name: 'network', nullable: false })
  public network: string;

  @Column({ name: 'chain_id', nullable: false })
  public chainId: string;

  @Column({ name: 'chain_name', nullable: false })
  public chainName: string;

  @Column({ name: 'average_block_time', nullable: false })
  public averageBlockTime: number;

  @Column({ name: 'required_confirmations', nullable: false })
  public requiredConfirmations: number;

  @Column({ name: 'internal_endpoint', nullable: false })
  public internalEndpoint: string;

  @Column({ name: 'rpc_endpoint', nullable: false })
  public rpcEndpoint: string;

  @Column({ name: 'rest_endpoint', nullable: false })
  public restEndpoint: string;

  @Column({ name: 'explorer_endpoint', nullable: false })
  public explorerEndpoint: string;

  @Column({
    name: 'hd_path',
    type: 'varchar',
    nullable: true,
  })
  public hdPath: string;

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
