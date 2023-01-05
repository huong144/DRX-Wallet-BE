import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class DepositLog1557195003002 implements MigrationInterface {
  private tableName = 'deposit_log';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    try {
      await queryRunner.createTable(
        new Table({
          name: this.fullTableName,
          columns: [
            {
              name: 'id',
              type: 'bigint',
              isPrimary: true,
              unsigned: true,
              generationStrategy: 'increment',
              isGenerated: true,
            },
            {
              name: 'deposit_id',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'event',
              type: 'varchar',
              length: '20',
              isNullable: false,
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
          name: 'deposit_log_ref_id',
          columnNames: ['ref_id'],
        })
      );
      await queryRunner.createIndex(
        this.fullTableName,
        new TableIndex({
          name: 'deposit_log_created_at',
          columnNames: ['created_at'],
        })
      );
    } catch (e) {
      console.error(e);
      // TODO: ??
    }
  }
  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'deposit_log_ref_id');
    await queryRunner.dropIndex(this.fullTableName, 'deposit_log_created_at');
    await queryRunner.dropTable(this.fullTableName);
  }
}
