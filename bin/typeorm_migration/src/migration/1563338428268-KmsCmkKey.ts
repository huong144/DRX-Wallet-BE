import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class KmsCmkKey1563338428268 implements MigrationInterface {
  private tableName = 'kms_data_key';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.createTable(
      new Table({
        name: this.fullTableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            unsigned: true,
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'cmk_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'encrypted_data_key',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'is_enabled',
            type: 'int',
            isNullable: false,
            default: '1',
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
        name: 'kms_data_key_cmk_id',
        columnNames: ['cmk_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'kms_data_key_cmk_id');
    await queryRunner.dropTable(this.fullTableName);
  }
}
