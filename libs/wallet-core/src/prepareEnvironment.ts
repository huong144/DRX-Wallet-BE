import { createConnection, getConnection } from 'typeorm';
import { getLogger, CurrencyRegistry, EnvConfigRegistry, getRedisSubscriber } from 'sota-common';
import { CurrencyConfig, EnvConfig, Erc20Token, KmsCmk, KmsDataKey, WalletBalance } from './entities';
import _ from 'lodash';
import { OmniToken } from './entities/OmniToken';
import { EosToken } from './entities/EosToken';
import { settleEnvironment } from '../../sota-common';
import Kms from '../../wallet-core/src/encrypt/Kms';
import { Bep20Token } from './entities/Bep20Token';

const logger = getLogger('prepareEnvironment');

export async function prepareEnvironment(): Promise<void> {
  logger.info(`Application has been started.`);
  logger.info(`Preparing DB connection...`);
  await createConnection({
    name: 'default',
    type: 'mysql',
    host: process.env.TYPEORM_HOST,
    port: process.env.TYPEORM_PORT ? parseInt(process.env.TYPEORM_PORT, 10) : 3306,
    username: process.env.TYPEORM_USERNAME,
    password: process.env.TYPEORM_PASSWORD,
    database: process.env.TYPEORM_DATABASE,
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING ? process.env.TYPEORM_LOGGING === 'true' : true,
    cache: process.env.TYPEORM_CACHE ? process.env.TYPEORM_CACHE === 'true' : true,
    entities: process.env.TYPEORM_ENTITIES.split(','),
    entityPrefix: process.env.TYPEORM_PREFIX,
    charset: 'utf8mb4',
    extra: {
      connectionLimit: 2,
    },
  });

  logger.info(`DB connected successfully...`);
  const connection = getConnection();
  logger.info(`Loading environment configurations from database...`);

  const [currencyConfigs, envConfigs, omniTokens, eosTokens, erc20Tokens, bep20Tokens, cmks] = await Promise.all([
    connection.getRepository(CurrencyConfig).find({}),
    connection.getRepository(EnvConfig).find({}),
    connection.getRepository(OmniToken).find({}),
    connection.getRepository(EosToken).find({}),
    connection.getRepository(Erc20Token).find({}),
    connection.getRepository(Bep20Token).find({}),
    connection.getRepository(KmsCmk).find({}),
  ]);

  if (!cmks.length) {
    throw new Error(`There's no CMK in database...`);
  }

  if (cmks.length > 1) {
    throw new Error(`There're multiple CMKs in database, currently support only one yet...`);
  }

  const cmk = cmks[0];
  const dataKeys = await connection.getRepository(KmsDataKey).find({ cmkId: cmk.id });
  if (!dataKeys.length) {
    logger.info(`There're no data key. Will create a new one...`);
    const rawDataKey = await Kms.getInstance().generateDataKey(cmk.id);
    const dataKeyRecord = new KmsDataKey();
    dataKeyRecord.cmkId = cmk.id;
    dataKeyRecord.encryptedDataKey = rawDataKey.cipher;
    dataKeyRecord.isEnabled = 1;
    const dataKey = await connection.getRepository(KmsDataKey).save(dataKeyRecord);
    logger.info(`Created data key: ${dataKey.encryptedDataKey} (id:${dataKey.id})`);
  }

  envConfigs.forEach(config => {
    EnvConfigRegistry.setCustomEnvConfig(config.key, config.value);
  });

  eosTokens.forEach(token => {
    CurrencyRegistry.registerEosToken(token.code, token.symbol, token.scale);
  });

  omniTokens.forEach(token => {
    CurrencyRegistry.registerOmniAsset(token.propertyId, token.symbol, token.name, token.scale);
  });

  erc20Tokens.forEach(token => {
    CurrencyRegistry.registerErc20Token(token.contractAddress, token.symbol, token.name, token.decimal);
  });

  bep20Tokens.forEach(token => {
    CurrencyRegistry.registerBEP20Token(token.contractAddress, token.symbol, token.name, token.decimal);
  });

  currencyConfigs.forEach(config => {
    if (!CurrencyRegistry.hasOneCurrency(config.currency)) {
      throw new Error(`There's config for unknown currency: ${config.currency}`);
    }

    const currency = CurrencyRegistry.getOneCurrency(config.currency);
    CurrencyRegistry.setCurrencyConfig(currency, config);
  });

  const redisSubscriber = getRedisSubscriber();
  redisSubscriber.on('message', onRedisMessage);

  await settleEnvironment();
  logger.info(`Environment has been setup successfully...`);
  return;
}

function onRedisMessage(channel: any, message: any) {
  const appId = EnvConfigRegistry.getAppId();
  if (appId !== channel) {
    return;
  }

  // To reload data, just exit and let supervisor starts process again
  // This is deprecated now. Will be removed shortly, when all the publishers are updated
  if (message === 'EVENT_NEW_ERC20_TOKEN_ADDED' || message === 'EVENT_NEW_ERC20_TOKEN_REMOVED') {
    logger.warn(`RedisChannel::subscribeRedisChannel on message=${message}. Will exit to respawn...`);
    process.exit(0);
  }

  if (message === 'EVENT_NEW_BEP20_TOKEN_ADDED' || message === 'EVENT_NEW_BEP20_TOKEN_REMOVED') {
    logger.warn(`RedisChannel::subscribeRedisChannel on message=${message}. Will exit to respawn...`);
    process.exit(0);
  }

  let messageObj: any = null;
  try {
    messageObj = JSON.parse(message);
  } catch (e) {
    logger.warn(`Unexpected message from redis: ${message}`);
  }

  if (!messageObj) {
    return;
  }

  if (messageObj) {
    const contractAddress = messageObj.data.toString();
    switch (messageObj.event) {
      case 'EVENT_NEW_ERC20_TOKEN_ADDED':
        findAndRegisterNewErc20Token(contractAddress).catch(e => {
          logger.error(`Could not find and load new added ERC20 token [${contractAddress}] due to error:`);
          logger.error(e);
        });
        break;

      case 'EVENT_NEW_BEP20_TOKEN_ADDED':
        findAndRegisterNewBep20Token(contractAddress).catch(e => {
          logger.error(`Could not find and load new added ERC20 token [${contractAddress}] due to error:`);
          logger.error(e);
        });
        break;

      case 'EVENT_NEW_ERC20_TOKEN_REMOVED':
        findAndUnregisterErc20Token(contractAddress).catch(e => {
          logger.error(`Could not find and delete added ERC20 token [${contractAddress}] due to error:`);
          logger.error(e);
        });
        break;
      case 'EVENT_NEW_BEP20_TOKEN_REMOVED':
        findAndUnregisterBep20Token(contractAddress).catch(e => {
          logger.error(`Could not find and delete added ERC20 token [${contractAddress}] due to error:`);
          logger.error(e);
        });
        break;

      default:
        break;
    }
  }
}

async function findAndRegisterNewErc20Token(contractAddress: string) {
  const connection = getConnection();
  const token = await connection.getRepository(Erc20Token).findOne({ contractAddress });
  if (!token) {
    throw new Error(`Could not find ERC20 token in database: ${contractAddress}`);
  }

  CurrencyRegistry.registerErc20Token(token.contractAddress, token.symbol, token.name, token.decimal);
  logger.info(`Register new added ERC20 token: contract=${token.contractAddress} symbol=${token.symbol}`);
}

async function findAndRegisterNewBep20Token(contractAddress: string) {
  const connection = getConnection();
  const token = await connection.getRepository(Bep20Token).findOne({ contractAddress });
  if (!token) {
    throw new Error(`Could not find Bep20 token in database: ${contractAddress}`);
  }

  CurrencyRegistry.registerBEP20Token(token.contractAddress, token.symbol, token.name, token.decimal);
  logger.info(`Register new added Bep20 token: contract=${token.contractAddress} symbol=${token.symbol}`);
}

async function findAndUnregisterErc20Token(contractAddress: string) {
  CurrencyRegistry.unregisterErc20Token(contractAddress);
  logger.info(`Unregister new added ERC20 token: contract=${contractAddress}`);
}

async function findAndUnregisterBep20Token(contractAddress: string) {
  CurrencyRegistry.unregisterBep20Token(contractAddress);
  logger.info(`Unregister new added Bep20 token: contract=${contractAddress}`);
}
