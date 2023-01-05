import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { getTableName } from '../service/getTable';

export class CurrencyConfig1557194001002 implements MigrationInterface {
  private tableName = 'currency_config';
  private fullTableName = getTableName(this.tableName);

  public async up(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.createTable(
      new Table({
        name: tableName,
        columns: [
          {
            name: 'currency',
            type: 'varchar',
            length: '190',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'network',
            type: 'varchar',
          },
          {
            name: 'chain_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'chain_name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'average_block_time',
            type: 'int',
          },
          {
            name: 'required_confirmations',
            type: 'int',
          },
          {
            name: 'internal_endpoint',
            type: 'varchar',
          },
          {
            name: 'rpc_endpoint',
            type: 'varchar',
          },
          {
            name: 'rest_endpoint',
            type: 'varchar',
          },
          {
            name: 'explorer_endpoint',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'hd_path',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'updated_at',
            type: 'bigint',
            isNullable: true,
          },
        ],
      }),
      true
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_id`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `created_at`, `updated_at`, `hd_path`)' +
        ' VALUES ' +
        `('btc', 'testnet', '', 'Testnet', 30000, 1, 'http://0.0.0.0:47001', '{\"protocol\":\"https\",\"host\":\"bitcorenodetest:local321@bitcoin-testnet-rpc-228.sotatek.works\"}', 'https://bitcore-node-testnet-228.sotatek.works/api/BTC/testnet', '', 1557636432024, 1557636432024, "m/44'/0'/0'/0/")`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_id`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `created_at`, `updated_at` ,`hd_path`)' +
        ' VALUES ' +
        `('ltc', 'testnet', '', 'Testnet', 30000, 1, 'http://0.0.0.0:47003', '{"protocol":"https","host":"ltc.sotatek.works","user":"root","pass":"sota1234"}', 'http://ltc-api.sotatek.works/api/LTC/testnet', '', 1557636432024, 1557636432024, "m/44'/2'/0'/0/")`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_id`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `created_at`, `updated_at`, `hd_path`)' +
        ' VALUES ' +
        `('eth', 'testnet', '5', 'Goerli', '6000', '6', 'http://0.0.0.0:47002', '', 'https://goerli.infura.io/v3/cbc0dce4b2174caabf7ed0c4865920ff', 'https://goerli.etherscan.io', '1557636432024', '1557636432024', "m/44'/60'/0'/0/")`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_id`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `created_at`, `updated_at`, `hd_path`)' +
        ' VALUES ' +
        `('bnb', 'testnet', '97', 'BSCTestnet', '3000', '1', 'http://0.0.0.0:47005', '', 'https://data-seed-prebsc-1-s1.binance.org:8545', 'https://testnet.bscscan.com', '1557636432024', '1557636432024', "m/44'/60'/0'/0/")`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('xrp', 'testnet', 'Testnet', '3500', '10', 'http://0.0.0.0:47004', 'https://s.devnet.rippletest.net:51234', '', 'https://test.bithomp.com/explorer/', '1557636432024', '1557636432024')`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_id`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('matic', 'testnet', '80001', 'Testnet', '6000', '9', 'http://0.0.0.0:47006', '', 'https://polygon-mumbai.infura.io/v3/0ea818485b9e4657bb394749ecb305d7', 'https://mumbai.polygonscan.com/', '1557636432024', '1557636432024')`
    );
    const obj = { trongrid_url: 'https://api.shasta.trongrid.io', api_key: process.env.API_KEY };

    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `hd_path`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('trx', 'testnet', 'Shasta', '3000', '20', 'http://0.0.0.0:47007', '', '${JSON.stringify(
          obj
        )}', 'https://shasta.tronscan.org', "m/44'/195'/0'/0/0", '1557636432024', '1557636432024')`
    );
    await queryRunner.query(
      `INSERT INTO ${tableName} ` +
        '(`currency`, `network`, `chain_name`, `average_block_time`, `required_confirmations`, `internal_endpoint`, `rpc_endpoint`, `rest_endpoint`, `explorer_endpoint`, `hd_path`, `created_at`, `updated_at`)' +
        ' VALUES ' +
        `('sol', 'testnet', 'Testnet', '1000', '8', 'http://0.0.0.0:47017', '{"protocol":"https","host":"api.testnet.solana.com"}', 'https://api.testnet.solana.com', 'https://solscan.io/', "m/44'/501'/0'/0'", '1557636432024', '1557636432024')`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    const tableName = this.fullTableName;
    await queryRunner.dropTable(tableName);
  }
}
