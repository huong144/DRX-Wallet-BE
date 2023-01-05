import { EntityManager, In, LessThan } from 'typeorm';
import { Deposit, CurrencyConfig, WalletBalance } from '../entities';
import { CollectStatus } from '../Enums';
import {
  ICurrency,
  CurrencyRegistry,
  Utils,
  getLogger,
  GatewayRegistry,
  BigNumber,
  BlockchainPlatform,
} from 'sota-common';
import * as rawdb from './';
import _ from 'lodash';

const logger = getLogger('rawdb::findDeposits');

/**
 * Return the first bunch of deposit records, which are collectable:
 * - Is still uncollected
 * - Total amount is greater than the collect threshold
 *
 * @param manager
 * @param currencies
 */
export async function findOneGroupOfCollectableDeposits(
  manager: EntityManager,
  currencies: string[]
): Promise<{ walletId: number; currency: ICurrency; records: Deposit[]; amount: BigNumber }> {
  const uncollectedStatuses = [CollectStatus.UNCOLLECTED];
  const deltaTime = 1 * 60 * 1000; // 1 minutes
  const { walletId, currency, records } = await findOneGroupOfDeposits(
    manager,
    currencies,
    uncollectedStatuses,
    deltaTime
  );

  if (!currency || !records.length) {
    return { walletId: 0, currency: null, records: [], amount: new BigNumber(0) };
  }

  const finalRecords: Deposit[] = [];
  if (currency.isUTXOBased && currency.symbol !== BlockchainPlatform.Cardano) {
    finalRecords.push(...records);
  } else {
    const chosenAddress = records[0].toAddress;
    finalRecords.push(...records.filter(deposit => deposit.toAddress === chosenAddress));
  }

  // TODO: Check whether the total value is greater than the threshold here...
  // If the value does not satisfy the condition, update their timestamp and leave as it is
  // We'll check it again next time, hopefully the deposit is enough at that time
  let totalAmount = new BigNumber(0);
  finalRecords.map(record => {
    totalAmount = totalAmount.plus(new BigNumber(record.amount));
  });

  const walletBalance = await manager.findOne(WalletBalance, {
    where: {
      currency: currency.symbol,
    },
  });

  if (!walletBalance) {
    logger.info(`${currency.symbol} does not have any wallet config, so collect`);
    return { walletId, currency, records: finalRecords, amount: totalAmount };
  }

  if (!walletBalance.minimumCollectAmount) {
    logger.info(`${currency.symbol} does not have a minimum collect amount, so collect`);
    return { walletId, currency, records: finalRecords, amount: totalAmount };
  }

  if (totalAmount.lt(new BigNumber(walletBalance.minimumCollectAmount))) {
    logger.info(
      `${currency.symbol} does not have a enough collect amount: ${totalAmount}, minimum collect amount: ${
        walletBalance.minimumCollectAmount
      }, next time`
    );
    rawdb.updateRecordsTimestamp(manager, Deposit, finalRecords.map(r => r.id));
    return {
      walletId: 0,
      currency: null,
      records: [],
      amount: new BigNumber(0),
    };
  }

  return { walletId, currency, records: finalRecords, amount: totalAmount };
}

/**
 * Return the first bunch of deposit records, which are thirsty:
 * - Firstly they're all collectable
 * - The deposit consist tokens not native assets, and require fee seeding
 *
 * @param manager
 * @param currencies
 */
export async function findOneGroupOfDepositsNeedSeedingFee(
  manager: EntityManager,
  currencies: string[]
): Promise<{ walletId: number; currency: ICurrency; records: Deposit[] }> {
  // Filter out the native currency
  currencies = currencies.filter(c => !CurrencyRegistry.hasOneNativeCurrency(c));

  if (!currencies.length) {
    return { walletId: 0, currency: null, records: [] };
  }

  // Select only deposit of tokens
  const { walletId, currency, records } = await findOneGroupOfCollectableDeposits(manager, currencies);
  if (!walletId || !currency || !records.length) {
    return { walletId: 0, currency: null, records: [] };
  }

  // Assume no utxo-based currency needs fee seeding.
  // Only account-based ones have to perform this mechanism
  if (currency.isUTXOBased) {
    logger.info(`Will not seed fee for utxo-based currency=${currency.symbol} depositIds=[${records.map(r => r.id)}]`);
    rawdb.updateRecordsTimestamp(manager, Deposit, records.map(r => r.id));
    return { walletId: 0, currency: null, records: [] };
  }

  const chosenAddress = records[0].toAddress;
  const nativeGateway = GatewayRegistry.getGatewayInstance(currency.platform);
  const nativeBalance = await nativeGateway.getAddressBalance(chosenAddress);

  // Minimum balance to be able to send tokens out
  // TODO: Load this kind of data from config/db
  let requiredBalance = new BigNumber(0);
  switch (currency.platform) {
    case BlockchainPlatform.Ethereum:
      requiredBalance = new BigNumber(0.001 * 1e18);
      break;

    case BlockchainPlatform.Bitcoin:
      requiredBalance = new BigNumber(0.0001 * 1e18);
      break;

    default:
      throw new Error(`Unsupported platform: ${currency.platform}, TODO: Implement me...`);
  }

  if (nativeBalance.gte(requiredBalance)) {
    rawdb.updateRecordsTimestamp(manager, Deposit, records.map(r => r.id));
    return { walletId: 0, currency: null, records: [] };
  }

  return { walletId, currency, records };
}

/**
 * Find all deposit with similar toAddress, walletId and currency property
 * that can be group amount
 * @param manager
 * @param currencies
 * @param statuses
 * @param transferType
 */
export async function findOneGroupOfDeposits(
  manager: EntityManager,
  currencies: string[],
  collectStatuses: CollectStatus[],
  deltaTime?: number
): Promise<{ walletId: number; currency: ICurrency; records: Deposit[] }> {
  // find and filter first group
  const now = Utils.nowInMillis();
  const uncollectedDeposits = await manager.getRepository(Deposit).find({
    order: {
      updatedAt: 'ASC',
    },
    where: {
      currency: In(currencies),
      collectStatus: In(collectStatuses),
      updatedAt: deltaTime ? LessThan(now - deltaTime) : undefined,
    },
  });

  if (!uncollectedDeposits.length) {
    return { walletId: 0, currency: null, records: [] };
  }

  // prefer collect platform deposit
  let selected = uncollectedDeposits[0];
  const currencyInfo = CurrencyRegistry.getOneCurrency(selected.currency);
  if (!currencyInfo.isNative) {
    const platformSelected = _.find(uncollectedDeposits, {
      toAddress: selected.toAddress,
      currency: currencyInfo.platform,
    });
    if (platformSelected) {
      selected = platformSelected;
    }
  }

  const selectedWalletId = uncollectedDeposits[0].walletId;
  const selectedCurrency = uncollectedDeposits[0].currency;
  const currency = CurrencyRegistry.getOneCurrency(selectedCurrency);

  const records = uncollectedDeposits.filter(deposit => {
    return deposit.walletId === selectedWalletId && deposit.currency === selectedCurrency;
  });

  // if (!currency.isUTXOBased) {
  //   records = [records[0]];
  // }

  return { walletId: selectedWalletId, currency, records };
}
