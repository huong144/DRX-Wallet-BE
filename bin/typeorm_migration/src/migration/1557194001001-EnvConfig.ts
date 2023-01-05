import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class EnvConfig1557194001001 implements MigrationInterface {
  private tableName = 'env_config';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: this.fullTableName,
        columns: [
          {
            name: 'key',
            type: 'varchar',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'value',
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
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('NETWORK', 'testnet', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_HOST', 'email-smtp.us-east-1.amazonaws.com', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_PORT', '587', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_USERNAME', 'AKIAYCILN6RGA562KFKJ', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_PASSWORD', 'BAXOm0G4LnqjctO16SqMA6QJKBZaipiJjvj0D9iruEup', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_ENCRYPTION', 'tls', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_DRIVER', 'smtp', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_FROM_NAME', 'DR-CEX', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_FROM_ADDRESS', '', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('MAIL_RECEIVER', 'anh.dao@sotatek.com', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('WEBHOOK_REQUEST_USER', 'exchange-wh@exchange.com', 1557636432024, 1557636432024)`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`key`, `value`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('WEBHOOK_REQUEST_PASSWORD', 'Abc1234', 1557636432024, 1557636432024)`
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'env_config_key',
        columnNames: ['key'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'env_config_key');
    await queryRunner.dropTable(this.fullTableName);
  }
}
