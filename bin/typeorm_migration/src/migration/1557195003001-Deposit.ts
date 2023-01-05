import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class Deposit1557195003001 implements MigrationInterface {
  private tableName = 'deposit';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.createTable(
      new Table({
        name: this.fullTableName,
        columns: [
          {
            name: 'id',
            type: 'bigint',
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
            name: 'to_address',
            type: 'varchar',
            isNullable: false,
            length: '150',
          },
          {
            name: 'txid',
            type: 'varchar',
            isNullable: false,
            length: '100',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 40,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'block_number',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'block_timestamp',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'collect_status',
            type: 'varchar',
            length: '20',
            isNullable: false,
            default: `'uncollected'`,
          },
          {
            name: 'collected_txid',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'collected_timestamp',
            type: 'bigint',
            default: 0,
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
    const table_name = this.fullTableName;
    await queryRunner.query(`ALTER TABLE ` + table_name + ` ALTER collect_status SET DEFAULT "uncollected"`);
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'deposit_wallet_id',
        columnNames: ['wallet_id'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'deposit_to_address',
        columnNames: ['to_address'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'deposit_collected_txid',
        columnNames: ['collected_txid'],
      })
    );
    const table = this.fullTableName;
    await queryRunner.query(`ALTER TABLE ` + table + ` ADD CONSTRAINT uniqueName UNIQUE (txid, to_address, currency)`);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable(this.fullTableName);
  }
}
