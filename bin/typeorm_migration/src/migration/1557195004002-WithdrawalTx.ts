import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';
import { getTableName } from '../service/getTable';

export class WithdrawalTx1557195004002 implements MigrationInterface {
  private tableName = 'withdrawal_tx';
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
            name: 'hot_wallet_address',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'txid',
            type: 'varchar',
            length: '100',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'currency',
            type: 'varchar',
            isNullable: false,
            length: '200',
          },
          {
            name: 'status',
            type: 'varchar',
            isNullable: false,
            length: '20',
          },
          {
            name: 'unsigned_txid',
            type: 'varchar',
            isNullable: false,
            isUnique: true,
            length: '100',
          },
          {
            name: 'block_number',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'block_hash',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'block_timestamp',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'fee_amount',
            type: 'decimal',
            precision: 40,
            scale: 8,
            isNullable: true,
          },
          {
            name: 'fee_currency',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'unsigned_raw',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'signed_raw',
            type: 'text',
            isNullable: true,
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
        name: 'withdrawal_tx_hot_wallet_address',
        columnNames: ['hot_wallet_address'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_tx_created_at',
        columnNames: ['created_at'],
      })
    );
    await queryRunner.createIndex(
      this.fullTableName,
      new TableIndex({
        name: 'withdrawal_tx_updated_at',
        columnNames: ['updated_at'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_tx_hot_wallet_address');
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_tx_created_at');
    await queryRunner.dropIndex(this.fullTableName, 'withdrawal_tx_updated_at');
    await queryRunner.dropTable(this.fullTableName);
  }
}
