import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class InternalTransfer1557195003003 implements MigrationInterface {
  private tableName = 'internal_transfer';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            unsigned: true,
            generationStrategy: 'increment',
            isGenerated: true,
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
            isNullable: false,
            length: '200',
          },
          {
            name: 'from_address',
            type: 'varchar',
            length: '150',
          },
          {
            name: 'to_address',
            type: 'varchar',
            isPrimary: true,
            length: '150',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'txid',
            type: 'varchar',
            length: '150',
          },
          {
            name: 'amount',
            type: 'decimal',
            unsigned: true,
            precision: 40,
            scale: 8,
            default: 0,
          },
          {
            name: 'fee',
            type: 'decimal',
            unsigned: true,
            precision: 40,
            scale: 8,
            default: 0,
          },
          {
            name: 'fee_currency',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
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
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.dropTable(tableName);
  }
}
