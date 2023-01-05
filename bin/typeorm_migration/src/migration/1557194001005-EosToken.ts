import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { getTableName } from '../service/getTable';

export class EosToken1557194001005 implements MigrationInterface {
  private tableName = 'eos_token';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          {
            name: 'symbol',
            type: 'varchar',
            length: '20',
            isPrimary: true,
          },
          {
            name: 'code',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'scale',
            type: 'int',
            default: 0,
          },
          {
            name: 'network',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'created_at',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'bigint',
            isNullable: true,
          },
        ],
      }),
      true
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`symbol`, `code`, `scale`, `network`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('EOS', 'eosio.token', 4, 'testnet', 1557636432024, 1557636432024)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.dropTable(tableName);
  }
}
