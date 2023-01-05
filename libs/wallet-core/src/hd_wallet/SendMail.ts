import * as DBUtils from './DBUtils';
import { ICurrency, BigNumber, getLogger, EnvConfigRegistry, Utils } from 'sota-common';
import { EntityManager } from 'typeorm';
import * as Locale from './Locale';
import * as rawdb from '../rawdb';
import { HotWallet } from '../entities';
import * as utilize from '../hd_wallet';
const logger = getLogger('Web Service');

export async function sendMailInsufficientBalance(
  hotWalletAddress: string,
  manager: EntityManager,
  currency: ICurrency,
  balance: string,
  amount: string,
  amountOfMoneyMissing: string
) {
  logger.info(`Hot wallet balance is insufficient address=${hotWalletAddress}`);
  const mailerReceiver = await rawdb.findInfoSendEmail(manager);

  const realBalance = utilize.convertHumanReadableScale(currency, new BigNumber(balance));
  const realAmount = utilize.convertHumanReadableScale(currency, new BigNumber(amount));
  const realAmountOfMoneyMissing = utilize.convertHumanReadableScale(currency, new BigNumber(amountOfMoneyMissing));
  const name = utilize.getNetworkName(currency);
  let text = Locale.contentEmailInsufficientBalanceEngLish(
    mailerReceiver,
    name,
    realAmount,
    realBalance,
    hotWalletAddress,
    realAmountOfMoneyMissing
  );
  text = utilize.convertHtml(text);
  await Utils.sendMail(mailerReceiver, Locale.subjectMailInsufficientBalance, text);
}

export async function sendMailSmallBalance(
  hotWallet: HotWallet,
  manager: EntityManager,
  currency: ICurrency,
  balance: BigNumber,
  lower: BigNumber,
  upper: BigNumber
) {
  logger.info(`Hot wallet balance is in lower threshold address=${hotWallet.address}`);
  const mailerReceiver = await rawdb.findInfoSendEmail(manager);
  const min = utilize.convertHumanReadableScale(currency, lower);
  const max = utilize.convertHumanReadableScale(currency, upper);
  const realBalance = balance.div(Math.pow(10, currency.humanReadableScale)).toString();
  const receiptAddress = await DBUtils.findRealReceiptAddress(
    hotWallet.address,
    currency.platform,
    hotWallet.walletId,
    manager
  );
  if (!receiptAddress) {
    logger.error(`Do not have hot wallet of ${currency.symbol}`);
    return;
  }
  const name = utilize.getNetworkName(currency);
  let text = Locale.contentEmailLowerBalanceEngLish(
    mailerReceiver,
    name.toUpperCase(),
    min,
    realBalance,
    receiptAddress,
    max
  );
  // convert text to html
  text = utilize.convertHtml(text);
  await Utils.sendMail(mailerReceiver, Locale.subjectMailLowerBalance, text);
}

export async function sendMailAlertPendingTooLong(
  pendingWithdrawal: number[],
  pendingInternalTransfer: number[],
  pendingCollect: number[]
) {
  const mailReceiver = EnvConfigRegistry.getCustomEnvConfig('MAIL_RECEIVER');
  let withdrawals: string = '';
  let internalTransfer: string = '';
  let deposits: string = '';
  pendingWithdrawal.forEach(_wi => {
    withdrawals = withdrawals + ' ' + _wi.toString();
  });
  pendingInternalTransfer.forEach(_wi => {
    internalTransfer = internalTransfer + ' ' + _wi.toString();
  });
  pendingCollect.forEach(_wi => {
    deposits = deposits + ' ' + _wi.toString();
  });
  let text = Locale.contentEmailAlertPendingTooLong(mailReceiver, withdrawals, internalTransfer, deposits);
  // convert text to html
  text = utilize.convertHtml(text);
  await Utils.sendMail(mailReceiver, Locale.subjectPendingTooLong, text);
}
