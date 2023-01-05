import { Utils } from 'sota-common';
import { Entity, BeforeInsert, BeforeUpdate, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('user_currency')
export class UserCurrency {
  @PrimaryGeneratedColumn()
  public id: number;

  @Column({ name: 'user_id', nullable: false })
  public userId: number;

  @Column({ name: 'system_symbol', nullable: false })
  public systemSymbol: string;

  @Column({ name: 'custom_symbol', nullable: false })
  public customSymbol: string;

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
