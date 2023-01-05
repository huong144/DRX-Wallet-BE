import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class WebhookProgress1557195005002 implements MigrationInterface {
  private tableName = 'webhook_progress';
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
            name: 'webhook_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'type',
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
            name: 'event',
            type: 'varchar',
            isNullable: false,
            length: '20',
          },
          {
            name: 'is_processed',
            type: 'tinyint',
            isNullable: false,
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
      this.fullTableName,
      new TableIndex({
        name: 'webhook_progress_webhook_id',
        columnNames: ['webhook_id'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'webhook_progress_ref_id',
        columnNames: ['ref_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'webhook_progress_webhook_id');
    await queryRunner.dropIndex(this.fullTableName, 'webhook_progress_ref_id');
    await queryRunner.dropTable(this.fullTableName);
  }
}
