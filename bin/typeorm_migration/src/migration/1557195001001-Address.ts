import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class Address1557195001001 implements MigrationInterface {
  private tableName = 'address';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.createTable(
      new Table({
        name: this.fullTableName,
        columns: [
          {
            name: 'wallet_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'address',
            type: 'varchar',
            length: '190',
            isPrimary: true,
          },
          {
            name: 'is_external',
            type: 'tinyint',
          },
          {
            name: 'is_hd',
            type: 'tinyint',
          },
          {
            name: 'hd_path',
            type: 'varchar',
          },
          {
            name: 'secret',
            type: 'text',
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
        name: 'address_address',
        columnNames: ['address'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'address_address');
    await queryRunner.dropTable(this.fullTableName);
  }
}
