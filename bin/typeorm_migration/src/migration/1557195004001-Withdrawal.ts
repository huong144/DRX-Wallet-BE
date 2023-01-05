import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class Withdrawal1557195004001 implements MigrationInterface {
  private tableName = 'withdrawal';
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
            name: 'withdrawal_tx_id',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'txid',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'from_address',
            type: 'varchar',
            isNullable: false,
            length: '100',
          },
          {
            name: 'to_address',
            type: 'varchar',
            isNullable: false,
            length: '200',
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 40,
            scale: 8,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            length: '20',
          },
          {
            name: 'note',
            type: 'varchar',
            isNullable: true,
            length: '100',
          },
          {
            name: 'hash_check',
            type: 'varchar',
            isNullable: false,
            length: '255',
          },
          {
            name: 'kms_data_key_id',
            type: 'int',
            isNullable: false,
            length: '20',
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
    const table_name = this.fullTableName;
    await queryRunner.query(`ALTER TABLE ` + table_name + ` ALTER txid SET DEFAULT ""`);
    await queryRunner.query(`ALTER TABLE ` + table_name + ` ALTER from_address SET DEFAULT ""`);
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_user_id',
        columnNames: ['user_id'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_wallet_id',
        columnNames: ['wallet_id'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_withdrawal_tx_id',
        columnNames: ['withdrawal_tx_id'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_from_address',
        columnNames: ['from_address'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_to_address',
        columnNames: ['to_address'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_user_id');
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_wallet_id');
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_withdrawal_tx_id');
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_from_address');
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_to_address');
    await queryRunner.dropTable(this.fullTableName);
  }
}
