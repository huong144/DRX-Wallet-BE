import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class WalletLog1557195002003 implements MigrationInterface {
  private tableName = 'wallet_log';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.createTable(
      new Table({
        name: this.fullTableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            unsigned: true,
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'wallet_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'event',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'balance_change',
            type: 'decimal',
            precision: 40,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'data',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'ref_id',
            type: 'bigint',
            isNullable: false,
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
      this.fullTableName,
      new TableIndex({
        name: 'wallet_log_wallet_id',
        columnNames: ['wallet_id'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'wallet_log_ref_id',
        columnNames: ['ref_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable(this.fullTableName);
  }
}
