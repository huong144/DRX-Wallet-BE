import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class WithdrawalLog1557195004003 implements MigrationInterface {
  private tableName = 'withdrawal_log';
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
            name: 'withdrawal_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'event',
            type: 'varchar',
            isNullable: false,
            length: '20',
          },
          {
            name: 'ref_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'bigint',
          },
        ],
      }),
      true
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_log_ref_id',
        columnNames: ['ref_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_log_ref_id');
    await queryRunner.dropTable(this.fullTableName);
  }
}
