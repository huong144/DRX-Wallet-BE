import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class ColdWallet1560164592514 implements MigrationInterface {
  private tableName = 'cold_wallet';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          {
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'wallet_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'address',
            type: 'varchar',
            isNullable: false,
            length: '200',
          },
          {
            name: 'currency',
            type: 'varchar',
            isNullable: false,
            length: '200',
            isUnique: true,
            isPrimary: true,
          },
          {
            name: 'type',
            type: 'varchar',
          },
          {
            name: 'created_at',
            type: 'bigint',
          },
          {
            name: 'updated_at',
            type: 'bigint',
          },
        ],
      }),
      true
    );
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: 'wallet_cold_wallet_currency',
        columnNames: ['currency'],
      })
    );
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: 'wallet_cold_wallet_user_id',
        columnNames: ['user_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable(this.fullTableName);
  }
}
