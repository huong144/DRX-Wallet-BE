import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import * as encrypt from '../service/encypt';
import { getTableName } from '../service/getTable';
const passwordHash = require('password-hash');

export class HotWallet1557195002004 implements MigrationInterface {
  private tableName = 'hot_wallet';
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
          },
          {
            name: 'type',
            type: 'varchar',
          },
          {
            name: 'secret',
            type: 'text',
          },
          {
            name: 'balance',
            type: 'decimal',
            unsigned: true,
            precision: 40,
            scale: 8,
            default: 0,
          },
          {
            name: 'is_external',
            type: 'tinyint',
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
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: 'wallet_hot_wallet_user_id',
        columnNames: ['user_id'],
      })
    );
    await queryRunner.createIndex(
      tableName,
      new TableIndex({
        name: 'wallet_hot_wallet_wallet_id',
        columnNames: ['wallet_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropTable(this.fullTableName);
  }
}
