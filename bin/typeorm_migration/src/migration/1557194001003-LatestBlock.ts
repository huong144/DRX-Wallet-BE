import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { getTableName } from '../service/getTable';

export class LatestBlock1557194001003 implements MigrationInterface {
  private tableName = 'latest_block';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          {
            name: 'currency',
            type: 'varchar',
            length: '200',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
          },
          {
            name: 'block_number',
            type: 'int',
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
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const tableName = process.env.TYPEORM_PREFIX + 'currency_config';
    await queryRunner.dropTable(tableName);
  }
}
