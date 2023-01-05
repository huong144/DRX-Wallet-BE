# Wallet module for DR-CEX

# How to setup & deploy wallet?

## Install dependencies
- Node v14
```
// Go https://nodejs.org/en/
```
- Typescript: 4.8.4
```
npm i -g typescript@4.8.4
```
- PM2: 5.2.2
```
npm i -g pm2@5.2.2
```
- Redis any version (latest one is recommended though)
```
// Google for instruction
```
- Database: MySQL Server

## Setup
- Install module packages:
```
make all
```
- Copy environments:
```
cp .env.example .env
cp dist/.env.example dist/.env
```

Notes: here is example env config
- in _dist/.env.example_
```
# GENERAL CONFIGURATION
NODE_ENV=development
LOG_LEVEL=DEBUG

# DATABASE CONFIGURATION
TYPEORM_HOST=<db_host, default: localhost>
TYPEORM_USERNAME=<db_username>
TYPEORM_PASSWORD=<db_password>
TYPEORM_DATABASE=<db_name>
TYPEORM_PORT=<db_port, default: 3306>
TYPEORM_ENTITIES=libs/wallet-core/src/entities/**/*,libs/sota-btc/src/entities/**/*,bin/typeorm_migration/src/entity/**/*
TYPEORM_MIGRATION=bin/typeorm_migration/src/migration/**/*
TYPEORM_MIGRATION_TABLE=migrations
#TYPEORM_PREFIX=

REDIS_HOST=<redis_host, default: localhost>
REDIS_PORT=<redis_port, default: 6379>
INTERNAL_HOST_IP=<internal_hot_ip>
```

- in .env.example_
```
# GENERAL CONFIGURATION
NODE_ENV=development
LOG_LEVEL=DEBUG

# DATABASE CONFIGURATION
TYPEORM_HOST=<db_host, default: localhost>
TYPEORM_USERNAME=<db_username>
TYPEORM_PASSWORD=<db_password>
TYPEORM_DATABASE=<db_name>
TYPEORM_PORT=<db_port, default: 3306>
TYPEORM_ENTITIES=libs/wallet-core/src/entities/**/*,libs/sota-btc/src/entities/**/*,bin/typeorm_migration/src/entity/**/*
TYPEORM_MIGRATION=bin/typeorm_migration/src/migration/**/*
TYPEORM_MIGRATION_TABLE=migrations
#TYPEORM_PREFIX=

REDIS_HOST=<redis_host, default: localhost>
REDIS_PORT=<redis_port, default: 6379>
INTERNAL_HOST_IP=<internal_hot_ip>
```

- Run migration & seed data:
```
make migrations
```

## Database configures:
- `kms_cmk`
```
INSERT INTO `kms_cmk` (`id`, `region`, `alias`, `arn`, `is_enabled`, `created_at`, `updated_at`)
VALUES
	('<cmk id>', '<cmk region>', '<cmk alias>', '<cmk arn>', 1, now(), now());

```
- `currency_config`
```
UPDATE `currency_config` SET `rpc_endpoint` = '<fullnode IP address BTC>' WHERE `currency` = 'btc';
UPDATE `currency_config` SET `rest_endpoint` = '<fullnode REST API BTC>' WHERE `currency` = 'btc';
UPDATE `currency_config` SET `rpc_endpoint` = '<fullnode IP address LTC>' WHERE `currency` = 'ltc';
UPDATE `currency_config` SET `rest_endpoint` = '<fullnode REST API LTC>' WHERE `currency` = 'ltc';
UPDATE `currency_config` SET `rest_endpoint` = '<fullnode REST API ETH>' WHERE `currency` = 'eth';
UPDATE `currency_config` SET `chain_id` = '1' WHERE `currency` = 'eth';
UPDATE `currency_config` SET `rest_endpoint` = '<fullnode REST API>' WHERE `currency` = 'xrp';

```
- `env_config`

| Key | Value |
| --- | ----- |
| MAIL_DRIVER | smtp |
| MAIL_ENCRYPTION | tls |
| MAIL_USERNAME	| mailer.username |
| MAIL_PASSWORD | SuperSecretPassword |
| MAIL_HOST | mail_host |
| MAIL_PORT | 587 |
| MAIL_FROM_NAME | DR-CEX |
| MAIL_FROM_ADDRESS | <mail-here> |
| MAILER_RECEIVER | <mail-here> |
| WEBHOOK_REQUEST_PASSWORD | SecretExchangePassword |
| WEBHOOK_REQUEST_USER | ExchangeUser |
| NETWORK | mainnet |


- `erc20_token`: Make sure that you have created a record that register USDT token

| symbol | origin_symbol | contract_address | decimal | total_supply | network |
| ------ | ------------- | ---------------- | ------- | ------------ | ------- |
| erc20.<contract-address> | USDC | <contract-address> | 6 | <total-supply> | mainnet |

- `webhook`: Make sure that you have created a records in the webhook table to alert the events concerning the exchange's addresses to your exchange

| id | user_id | type | url |
| -- | ------- | ---- | --- |
| 1 | 1 | common | <exchange_webhook_url> |

## Start process:
```
cd dist
pm2 start app_web.json
pm2 start app_btc.json
pm2 start app_eth.json
pm2 start app_ltc.json
pm2 start app_xrp.json
pm2 start app_bnb.json
pm2 start app_trx.json
```
## Insert hot wallet address Xrp,Trx

For Xrp, you have to generate the address manually. Then, you insert to the system by calling API (POST)
```
{{HOST}}:{{PORT}}/api/:currency/add_address
```
Example body request inserting Xrp hot wallet:
```
{
	"address": "xrp_account",
	"private_key": "private_key"
}
```
