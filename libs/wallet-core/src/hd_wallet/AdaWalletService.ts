import * as DBUtils from './DBUtils';
import * as Utils from './Utils';
import * as _ from 'lodash';
import { EntityManager } from 'typeorm';
import axios from 'axios';
import { GatewayRegistry, BaseGateway } from '../../../sota-common';
import { getLogger, Account, CurrencyRegistry, BlockchainPlatform } from 'sota-common';
import Kms from '../encrypt/Kms';
import { getRandomKms, increaseAdaAccountId } from './DBUtils';
import { ADA_RECEIPT_ADDRESS_INDEX } from './Const';
import { KmsDataKey } from '../entities';

const logger = getLogger('AdaWalletService');
export async function createAdaAddresses(amount: number, currency: string, connection: EntityManager) {
  const wallet = await DBUtils.findOrCreateAdaWallet(currency, connection);
  const secret = JSON.parse(wallet.secret);
  if (!secret) {
    throw new Error('This currency do not have wallet');
  }
  let seed;
  if (secret.private_key) {
    seed = secret.private_key;
    if (secret.kms_data_key_id > 0) {
      seed = await Kms.getInstance().decrypt(secret.private_key, secret.kms_data_key_id);
    }
  }
  const kms = await getRandomKms(connection);
  const tasks: Array<Promise<any>> = [];
  for (let i = 0; i < amount; i++) {
    tasks.push(_generateOneAdaWalletAddress(currency, wallet.id, seed, wallet.secret, kms));
  }
  const accounts: Account[] = await Promise.all(tasks);
  await DBUtils.saveNotHDAddresses(wallet.id, currency, accounts, JSON.parse(seed).account_id, connection);
  return accounts.map(pair => pair.address);
}

export async function _generateAdaAccount(coin: string, params: any) {
  let account;
  try {
    account = await createAdaAccount(coin, params);
  } catch (e) {
    console.error(e);
    throw new Error(`Could not create Ada account params=${JSON.stringify(params)}`);
  }

  if (_.isNil(account)) {
    throw new Error(`Could not create wallet coin=${coin}`);
  }

  if (
    !account.wallet_address ||
    !account.account_id ||
    !account.backup_phrase ||
    !account.spending_password ||
    typeof account.account_id !== 'number'
  ) {
    throw new Error(`Could not create ADA wallet err=$`);
  }

  const private_key = JSON.stringify(account);
  return private_key;
}

export async function _generateOneAdaWalletAddress(
  coin: string,
  walletId: number,
  secret: string,
  walletSecret: string,
  dataKey: KmsDataKey
) {
  const iCurrency = CurrencyRegistry.getOneCurrency(BlockchainPlatform.Cardano);
  const gw = GatewayRegistry.getGatewayInstance(iCurrency);
  let newSecret;
  try {
    newSecret = JSON.parse(secret);
    newSecret.account_id = ADA_RECEIPT_ADDRESS_INDEX;
  } catch (e) {
    throw new Error(e);
  }
  if (!newSecret.wallet_address || !newSecret.account_id || !newSecret.backup_phrase || !newSecret.spending_password) {
    throw new Error('Fail');
  }
  const data = await (gw as any).createWalletAddress(
    newSecret.wallet_address,
    newSecret.account_id,
    newSecret.backup_phrase,
    newSecret.spending_password
  );
  if (_.isNil(data)) {
    throw new Error(`Get Address fail coin=${coin}, wallet_id=${walletId}`);
  }

  if (
    typeof data.address === 'undefined' ||
    typeof data.walletId === 'undefined' ||
    typeof data.accountId === 'undefined' ||
    typeof data.spendingPassword === 'undefined' ||
    typeof data.backupPhrase === 'undefined'
  ) {
    logger.error(`Get Address fail err`);
    throw new Error(`Get Address fail err`);
  }
  if (!dataKey || !dataKey.id) {
    throw new Error(`KMS data key is mandatory...`);
  }

  const kms_data_key_id = dataKey.id;
  const private_key = await Kms.getInstance().encrypt(JSON.stringify(data), kms_data_key_id);
  const newSecretForWallet = JSON.stringify({ private_key, kms_data_key_id });

  return new Account(newSecretForWallet, data.address);
}

export async function createAdaAccount(coin: string, params: any): Promise<any> {
  const iCurrency = CurrencyRegistry.getOneCurrency(BlockchainPlatform.Cardano);
  const gw = GatewayRegistry.getGatewayInstance(iCurrency);

  try {
    const walletName: string = params.wallet_name;
    console.log(`AdaWebService::createNewWallet begin params=${JSON.stringify(params)}`);
    const wallet = await (gw as any).createWallet(walletName);
    const walletInfo = wallet.wallet_address + '-' + wallet.account_id;
    console.log(`AdaWebService::createNewWallet done params=${JSON.stringify(params)} result=${walletInfo}`);
    return wallet;
  } catch (e) {
    throw new Error(e.toString() + `: Could not create ADA account params=${JSON.stringify(params)}`);
  }
}
