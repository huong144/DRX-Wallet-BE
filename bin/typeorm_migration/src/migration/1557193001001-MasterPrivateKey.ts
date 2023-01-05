import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class MasterPrivateKey1557193001001 implements MigrationInterface {
  private tableName = 'master_private_key';
  private fullTableName = getTableName(this.tableName);
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.createTable(
      new Table({
        name: this.fullTableName,
        columns: [
          {
            name: 'id',
            type: 'bigint',
            unsigned: true,
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'currency',
            type: 'varchar',
            isNullable: false,
            length: '10',
          },
          {
            name: 'wallet_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'encrypted',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'password_hash',
            type: 'text',
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
        name: 'wallet_master_private_key_currency',
        columnNames: ['currency'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'wallet_master_private_key_currency');
    await queryRunner.dropTable(this.fullTableName);
  }
}
