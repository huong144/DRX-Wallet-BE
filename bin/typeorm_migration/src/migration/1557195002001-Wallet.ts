import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class Wallet1557195002001 implements MigrationInterface {
  private tableName = 'wallet';
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
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'label',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'secret',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'meta',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_hd',
            type: 'tinyint',
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
        name: 'wallet_wallet_user_id',
        columnNames: ['user_id'],
      })
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1001', '1', 'BTC Wallet', 'btc', 1, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1002', '1', 'XRP Wallet', 'xrp', 0, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1003', '1', 'LTC Wallet', 'ltc', 1, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1004', '1', 'ETH Wallet', 'eth', 1, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1005', '1', 'BSC Wallet', 'bnb', 1, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1006', '1', 'MATIC Wallet', 'matic', 1, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1007', '1', 'TRX Wallet', 'trx', 1, 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`id`, `user_id`, `label`, `currency`, `is_hd`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('1008', '1', 'SOL Wallet', 'sol', 1, 1557636432024, 1557636432024)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable(this.fullTableName);
  }
}
