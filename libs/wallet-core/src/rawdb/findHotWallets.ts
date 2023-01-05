import _ from 'lodash';
import { EntityManager, In } from 'typeorm';
import { HotWallet, InternalTransfer, Withdrawal, CurrencyConfig } from '../entities';
import { InternalTransferType, WithdrawalStatus } from '../Enums';
import { getLogger, BigNumber, ICurrency, GatewayRegistry } from 'sota-common';
import { RallyWallet } from '../entities/RallyWallet';
import { ColdWallet } from '../entities/ColdWallet';
import { hd } from '../..';
import { findTotalAmountWithdrawlPending } from '.';

const logger = getLogger('rawdb::findHotWallets');

/**
 * Get a hot wallet that has no pending transaction
 *
 * @param manager
 * @param currency
 * @param isExternal
 */
export async function findSufficientHotWallet(
  manager: EntityManager,
  walletId: number,
  currency: ICurrency,
  amount: BigNumber
): Promise<HotWallet> {
  const hotWallets = await findFreeHotWallets(manager, walletId, currency.platform);
  if (!hotWallets.length) {
    return null;
  }

  let foundHotWallet: HotWallet = null;
  const gateway = GatewayRegistry.getGatewayInstance(currency);
  await Promise.all(
    hotWallets.map(async hotWallet => {
      const hotWalletBalance = await gateway.getAddressBalance(hotWallet.address);
      if (hotWalletBalance.gte(amount)) {
        foundHotWallet = hotWallet;
      }
    })
  );

  if (!foundHotWallet) {
    logger.warn(
      `No sufficient hot wallet walletId=${walletId} currency=${currency.symbol} amount=${amount
        .div(Math.pow(10, currency.humanReadableScale))
        .toString()}`
    );
  }

  return foundHotWallet;
}

/**
 * Find available hot wallet for each currency and its family (same walletId)
 * @param manager
 * @param walletId
 * @param isExternal
 * @private
 */
export async function findFreeHotWallets(
  manager: EntityManager,
  walletId: number,
  currency: string
): Promise<HotWallet[]> {
  // Hot wallet to transfer out money must be internal
  const isExternal = false;

  // Firstly find all hot wallet with given conditions
  const hotWallets = await manager.find(HotWallet, { walletId, currency, isExternal });

  if (!hotWallets.length) {
    return [];
  }

  // Then check whether there're any busy addresses
  const busyAddresses = await getAllBusyHotWallets(manager, walletId);

  // Pick hot wallets that are not busy at the moment
  return hotWallets.filter(hotWallet => !_.includes(busyAddresses, hotWallet.address));
}

export async function findOneCurrency(manager: EntityManager, symbol: string): Promise<CurrencyConfig> {
  const currency = await manager.findOne(CurrencyConfig, {
    where: {
      currency: symbol,
    },
  });
  return currency;
}
export async function findAnyColdWallet(
  manager: EntityManager,
  walletId: number,
  currency: string
): Promise<ColdWallet> {
  const wallet = await manager.findOne(ColdWallet, { walletId, currency });
  return wallet;
}

export async function findAnyRallyWallet(
  manager: EntityManager,
  walletId: number,
  currency: string
): Promise<RallyWallet> {
  const wallet = await manager.findOne(RallyWallet, { walletId, currency });
  return wallet;
}

/**
 * Get one any hot wallet
 *
 * @param manager
 * @param currency
 * @param isExternal
 */
export async function findAnyHotWallet(
  manager: EntityManager,
  walletId: number,
  currency: string,
  isExternal: boolean
): Promise<HotWallet> {
  const hotWallet = await manager.findOne(HotWallet, { walletId, currency, isExternal });
  return hotWallet;
}

export async function findAnyInternalHotWallet(manager: EntityManager, walletId: number, currency: string) {
  return findAnyHotWallet(manager, walletId, currency, false);
}

export async function findAnyExternalHotWallet(manager: EntityManager, walletId: number, currency: string) {
  return findAnyHotWallet(manager, walletId, currency, true);
}

/**
 * get pending addresses from internal transfer and withdrawal tables
 * @param manager
 * @param walletId
 */
export async function getAllBusyHotWallets(manager: EntityManager, walletId: number): Promise<string[]> {
  const busyAddresses: string[] = [];
  const [busySeedingAddresses, busyWithdrawingAddresses] = await Promise.all([
    await getBusySeedingHotWallets(manager, walletId),
    await getBusyWithdrawingHotWallets(manager, walletId),
  ]);

  busyAddresses.push(...busySeedingAddresses);
  busyAddresses.push(...busyWithdrawingAddresses);

  return _.uniq(busyAddresses);
}

/**
 * get pending sender from internal transfer
 * @param manager
 * @param walletId
 */
export async function getBusySeedingHotWallets(manager: EntityManager, walletId: number): Promise<string[]> {
  const pendingStatuses = [WithdrawalStatus.SENT, WithdrawalStatus.SIGNED, WithdrawalStatus.SIGNING];
  const seedTransactions = await manager.find(InternalTransfer, {
    walletId,
    type: InternalTransferType.SEED,
    status: In(pendingStatuses),
  });

  if (!seedTransactions.length) {
    return [];
  }

  return seedTransactions.map(t => t.fromAddress);
}

/**
 * Get the busy hot wallets' address due to withdrawals
 *
 * @param manager
 * @param walletId
 */
export async function getBusyWithdrawingHotWallets(manager: EntityManager, walletId: number): Promise<string[]> {
  const pendingStatuses = [WithdrawalStatus.SENT, WithdrawalStatus.SIGNED, WithdrawalStatus.SIGNING];
  const allPendingWithdrawals = await manager.find(Withdrawal, {
    walletId,
    status: In(pendingStatuses),
  });

  if (!allPendingWithdrawals.length) {
    return [];
  }

  return allPendingWithdrawals.map(w => w.fromAddress);
}

/**
 * Get one hot wallet with very specific information: currency and address
 * When using this method, the hot wallet should exist in database
 * If there's no result, it means there's something wrong
 *
 * @param manager
 * @param currency
 * @param address
 */
export async function getOneHotWallet(manager: EntityManager, currency: string, address: string): Promise<HotWallet> {
  const hotWallet = await manager.findOne(HotWallet, { currency, address });
  if (!hotWallet) {
    throw new Error(`Could not get hot wallet with specific information: currency=${currency}, address=${address}`);
  }

  return hotWallet;
}

export async function findHotWalletByAddress(manager: EntityManager, address: string): Promise<HotWallet> {
  const hotWallet = await manager.findOne(HotWallet, {
    address,
  });
  return hotWallet;
}

export async function checkHotWalletIsBusy(
  manager: EntityManager,
  hotWallet: HotWallet,
  pendingStatuses: string[]
): Promise<boolean> {
  const [allPendingWithdrawals, seedTransactions] = await Promise.all([
    manager.find(Withdrawal, {
      fromAddress: hotWallet.address,
      status: In(pendingStatuses),
    }),
    manager.find(InternalTransfer, {
      type: InternalTransferType.SEED,
      status: In(pendingStatuses),
    }),
  ]);

  if (!allPendingWithdrawals.length && !seedTransactions.length) {
    return false;
  }

  return true;
}

export async function findAllHotWallets(manager: EntityManager, currency: string): Promise<HotWallet[]> {
  logger.info(`Get all hot wallet of native currency`);
  const hotWallets = await manager.find(HotWallet, { currency });
  if (!hotWallets.length) {
    logger.error(`Could not get hot wallet with specific information: currency=${currency}`);
  }
  return hotWallets;
}

export async function checkHotWalletIsSufficient(hotWallet: HotWallet, amount: BigNumber) {
  const gateway = GatewayRegistry.getGatewayInstance(hotWallet.currency);
  const hotWalletBalance = await gateway.getAddressBalance(hotWallet.address);
  if (hotWalletBalance.gte(amount)) {
    return true;
  }
  return false;
}
