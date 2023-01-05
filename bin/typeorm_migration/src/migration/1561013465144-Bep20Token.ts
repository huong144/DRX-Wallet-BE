import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { getTableName } from '../service/getTable';

export class Bep20Token1561013465144 implements MigrationInterface {
  private tableName = 'bep20_token';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const table = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: table,
        columns: [
          {
            name: 'symbol',
            type: 'varchar',
            isNullable: false,
            length: '100',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
            length: '100',
            isUnique: true,
          },
          {
            name: 'contract_address',
            type: 'varchar',
            isNullable: false,
            isPrimary: true,
          },
          {
            name: 'decimal',
            type: 'tinyint',
            isNullable: false,
            unsigned: true,
          },
          {
            name: 'total_supply',
            type: 'decimal',
            isNullable: true,
            default: 0,
            scale: 32,
          },
          {
            name: 'network',
            type: 'varchar',
            length: '20',
            isNullable: false,
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
