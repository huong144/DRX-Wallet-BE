import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class WebhookLog1557195005003 implements MigrationInterface {
  private tableName = 'webhook_log';
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
            name: 'webhook_progress_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            isNullable: false,
            length: '255',
          },
          {
            name: 'params',
            type: 'text',
          },
          {
            name: 'status',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'msg',
            type: 'text',
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
        name: 'webhook_log_webhook_progress_id',
        columnNames: ['webhook_progress_id'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'webhook_log_webhook_progress_id');
    await queryRunner.dropTable(this.fullTableName);
  }
}
