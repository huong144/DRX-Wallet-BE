import {
  getLogger,
  CurrencyRegistry,
  GatewayRegistry,
  BigNumber,
  EnvConfigRegistry,
  ICurrency,
  TokenType,
} from 'sota-common';
import * as Locale from '../hd_wallet/Locale';
import * as rawdb from '../rawdb';
import { EntityManager, getConnection, In } from 'typeorm';
import { WithdrawalStatus, WithdrawalNote } from '../Enums';
import { WalletBalance, Withdrawal, HotWallet, Wallet } from '../entities';
import { userId, kmsId } from '../hd_wallet/Const';
import { hd } from '../..';
import { BlockchainPlatform } from 'sota-common';
import axios from 'axios';

const nodemailer = require('nodemailer');
const logger = getLogger('checkBalance');

export async function checkUpperThreshold(manager: EntityManager, platform: BlockchainPlatform) {
  const allCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(platform);
  const wallet = await manager.getRepository(Wallet).findOneOrFail({
    where: {
      currency: platform,
    },
  });
  const hotWallets = await rawdb.findFreeHotWallets(manager, wallet.id, platform);
  await Promise.all(
    allCurrencies.map(cur =>
      Promise.all(hotWallets.map(curHotWallet => rawdb.upperThresholdHandle(manager, cur, curHotWallet)))
    )
  );
}

export async function upperThresholdHandle(
  manager: EntityManager,
  iCurrency: ICurrency,
  hotWallet: HotWallet
): Promise<void> {
  const pendingStatuses = [WithdrawalStatus.SENT, WithdrawalStatus.SIGNED, WithdrawalStatus.SIGNING];
  if (await rawdb.checkHotWalletIsBusy(manager, hotWallet, pendingStatuses)) {
    logger.info(`Hot wallet address=${hotWallet.address} is busy, ignore collecting`);
    return;
  }

  const platformCurrency = iCurrency.platform;
  const symbolCurrency = iCurrency.symbol;
  const walletId = hotWallet.walletId;

  //  do not throw Error in this function, this logic is optional
  const walletBalance = await manager.findOne(WalletBalance, {
    walletId,
    currency: symbolCurrency,
  });

  if (!walletBalance) {
    logger.error(`Wallet id=${walletId} currency=${symbolCurrency} is not found`);
    return;
  }

  let coldWallet = await rawdb.findAnyColdWallet(manager, walletId, platformCurrency);

  if (!coldWallet) {
    coldWallet = await rawdb.findAnyColdWallet(manager, walletId, symbolCurrency);
    if (!coldWallet) {
      logger.error(`Cold wallet symbol=${symbolCurrency} is not found`);
      return;
    }
  }

  if (!walletBalance.lowerThreshold || !walletBalance.upperThreshold) {
    logger.info(`Don't have upper threshold and lower threshold of ${walletBalance.currency}`);
    return;
  }

  const upper = new BigNumber(walletBalance.upperThreshold);
  const lower = new BigNumber(walletBalance.lowerThreshold);
  let middle;

  if (!walletBalance.middleThreshold) {
    middle = upper.plus(lower).div(new BigNumber(2));
  } else {
    middle = new BigNumber(walletBalance.middleThreshold);
  }

  const gateway = GatewayRegistry.getGatewayInstance(symbolCurrency);
  const [balance, withdrawalPending] = await Promise.all([
    gateway.getAddressBalance(hotWallet.address),
    rawdb.findTotalAmountWithdrawlPending(symbolCurrency, manager),
  ]);
  const realBalance = balance.minus(withdrawalPending);
  if (realBalance.lt(upper)) {
    logger.info(
      `Hot wallet symbol=${symbolCurrency} address=${
        hotWallet.address
      } with balance: ${balance}, total pending ${withdrawalPending}, realBalance = balance-pending= ${realBalance} is not in upper threshold: ${upper}, ignore collecting`
    );
    return;
  }

  logger.info(
    `Hot wallet symbol=${symbolCurrency} address=${
      hotWallet.address
    } with balance: ${balance}, total pending ${withdrawalPending}, realBalance = balance-pending= ${realBalance} is in upper threshold: ${upper}, will collect`
  );

  const withdrawal = new Withdrawal();
  const amount = new BigNumber(realBalance.minus(middle).toFixed(iCurrency.nativeScale));
  withdrawal.note = WithdrawalNote.COLD_WALLET;
  withdrawal.currency = symbolCurrency;
  withdrawal.fromAddress = hotWallet.address;
  withdrawal.amount = amount.toString();
  withdrawal.userId = userId;
  withdrawal.walletId = walletId;
  withdrawal.toAddress = coldWallet.address;
  withdrawal.status = WithdrawalStatus.UNSIGNED;
  withdrawal.hashCheck = 'TMP_HASHCHECK';
  withdrawal.kmsDataKeyId = kmsId;

  await manager.save(withdrawal);
  logger.info(
    `Withdrawal created from hot wallet address=${hotWallet.address} to cold wallet address=${
      coldWallet.address
    } amount=${amount}`
  );
}

export async function lowerThresholdHandle(manager: EntityManager, currency: ICurrency, hotWallet: HotWallet) {
  // do not throw Error in this function, this logic is optional
  const walletBalance = await manager.findOne(WalletBalance, {
    currency: currency.symbol,
  });

  if (!walletBalance) {
    logger.error(`Wallet of currency=${currency.symbol} is not found`);
    return;
  }

  if (!walletBalance.lowerThreshold) {
    logger.info(`Currency threshold symbol=${currency.symbol} is not found or lower threshold is not setted`);
    return;
  }

  const lower = new BigNumber(walletBalance.lowerThreshold);
  const upper = new BigNumber(walletBalance.upperThreshold);
  const balance = await getAddressBalance(currency, hotWallet.address);
  if (balance.gte(lower)) {
    logger.info(
      `Hot wallet balance: ${balance.toString()} of currency ${
        currency.symbol
      } is greater than lower threshold: ${lower.toString()} address=${hotWallet.address}, ignore sending mail`
    );
    return;
  }

  // TBD: this code from Logger.ts, should move to Util or somewhere better
  logger.info(`Hot wallet balance is in lower threshold address=${hotWallet.address}`);
  await hd.sendMailSmallBalance(hotWallet, manager, currency, balance, lower, upper);
}

export async function checkInsufficientBalance(currency: ICurrency, hotWallets: HotWallet[], manager: EntityManager) {
  let totalBalance = new BigNumber(0);
  const [withdrawalPending] = await Promise.all([
    rawdb.findTotalAmountWithdrawlPending(currency.symbol, manager),
    Promise.all(
      hotWallets.map(async hotWallet => {
        const curBalance = await getAddressBalance(currency, hotWallet.address);
        totalBalance = totalBalance.plus(curBalance);
      })
    ),
  ]);
  if (new BigNumber(withdrawalPending).lte(totalBalance)) {
    logger.info(
      `Total balance: ${totalBalance} hot wallets of currency: ${
        currency.symbol
      } is sufficient to withdrawal total withdrawal pending: ${withdrawalPending}`
    );
    return;
  }
  logger.info(
    `Total balance: ${totalBalance} hot wallets of currency: ${
      currency.symbol
    } is insufficient to withdrawal total withdrawal pending: ${withdrawalPending}`
  );
  const amountOfMoneyMissing = new BigNumber(withdrawalPending).minus(totalBalance);
  const receiptAddress = await hd.findRealReceiptAddress(
    hotWallets[0].address,
    currency.symbol,
    hotWallets[0].walletId,
    manager
  );
  hd.sendMailInsufficientBalance(
    receiptAddress,
    manager,
    currency,
    totalBalance.toString(),
    withdrawalPending.toString(),
    amountOfMoneyMissing.toString()
  );
}

export async function getAddressBalance(currency: ICurrency, address: string) {
  const currencyConfig = CurrencyRegistry.getCurrencyConfig(currency);
  const url = `${currencyConfig.internalEndpoint}/api/${currency.symbol}/address/${address}/balance`;
  const data = (await axios.get(url)).data;
  return new BigNumber(data.balance);
}
