import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class RallyWallet1557195002005 implements MigrationInterface {
  private tableName = 'rally_wallet';
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
            name: 'currency',
            type: 'varchar',
            isNullable: false,
            length: '200',
          },
          {
            name: 'address',
            type: 'varchar',
            isNullable: false,
            length: '200',
            isPrimary: true,
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
    await queryRunner.dropTable(this.fullTableName);
  }
}
