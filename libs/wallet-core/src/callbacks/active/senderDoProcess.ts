import {
  getLogger,
  ISubmittedTransaction,
  TransactionStatus,
  Utils,
  BasePlatformWorker,
  CurrencyRegistry,
  GatewayRegistry,
} from 'sota-common';
import * as rawdb from '../../rawdb';
import { EntityManager, getConnection } from 'typeorm';
import { WithdrawalEvent, WithdrawalStatus } from '../../Enums';
import { WithdrawalTx, Withdrawal } from '../../entities';
import util from 'util';

const logger = getLogger('senderDoProcess');

export async function senderDoProcess(sender: BasePlatformWorker): Promise<void> {
  await getConnection().transaction(async manager => {
    await _senderDoProcess(manager, sender);
  });
}

/**
 * Tasks of sender:
 * - Find 1 withdrawal_tx record that `status` = `signed`
 * - Try to submit its rawtx data to the network
 * - Update real txid back into corresponding withdrawal_tx and withdrawal records
 *
 * Now the tx should be submitted to the network, and wait for the verifying phase
 *
 * @param manager
 * @param sender
 */
async function _senderDoProcess(manager: EntityManager, sender: BasePlatformWorker): Promise<void> {
  const platformCurrency = sender.getCurrency();
  const allCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(platformCurrency.platform);
  const allSymbols = allCurrencies.map(c => c.symbol);
  const signedRecord = await rawdb.findOneWithdrawalTx(manager, allSymbols, [WithdrawalStatus.SIGNED]);

  if (!signedRecord) {
    logger.info(`There are not signed withdrawals to be sent: platform=${platformCurrency.platform}`);
    return;
  }

  const currency = CurrencyRegistry.getOneCurrency(signedRecord.currency);
  const gateway = GatewayRegistry.getGatewayInstance(currency);

  let sentResultObj: ISubmittedTransaction = null;
  const prefix: string = 'TMP_';
  const txid = signedRecord.txid;

  // If transaction has valid is, not the temporary one
  // We'll check whether its status is determined or not on the network
  if (signedRecord.txid.indexOf(prefix) === -1) {
    try {
      const status = await gateway.getTransactionStatus(txid);
      if (status === TransactionStatus.COMPLETED || status === TransactionStatus.CONFIRMING) {
        await updateWithdrawalAndWithdrawalTx(manager, signedRecord, txid, WithdrawalStatus.SENT);
        return;
      }

      // If transaction is determined as failed, the withdrawal is failed as well
      if (status === TransactionStatus.FAILED) {
        await updateWithdrawalAndWithdrawalTx(manager, signedRecord, txid, WithdrawalStatus.FAILED);
        return;
      }
    } catch (e) {
      const status = TransactionStatus.UNKNOWN;
      // await updateWithdrawalAndWithdrawalTx(manager, signedRecord, txid, WithdrawalStatus.FAILED);
    }
    // If transaction status is completed or confirming, both mean the withdrawal was submitted to network successfully
  }

  // for unknown transaction or temporary transaction
  // send transaction directly
  try {
    sentResultObj = await gateway.sendRawTransaction(signedRecord.signedRaw);
  } catch (e) {
    let errInfo = e;
    let extraInfo = null;

    // Axios error
    if (e.isAxiosError) {
      extraInfo = {
        url: e.config.url,
        method: e.config.method,
        data: e.config.data,
        headers: e.config.headers,
        auth: e.config.auth,
        timeout: e.config.timeout,
        status: e.response.status,
      };
      errInfo = JSON.stringify(e.response.data);
    }

    logger.error(
      `Cannot broadcast withdrawlTxId=${signedRecord.id} due to error\
        errInfo=${util.inspect(errInfo)} \
        extraInfo=${util.inspect(extraInfo)}`
    );

    // The withdrawal record is created wrongly. It must be reconstructed
    if ((errInfo.toString() as string).includes('nonce too low')) {
      logger.error(`The withdrawal record is created wrongly. It must be reconstructed`);
      // await reconstructWithdrawal(manager, signedRecord);
    }

    return;
  }

  if (sentResultObj) {
    await updateWithdrawalAndWithdrawalTx(manager, signedRecord, sentResultObj.txid, WithdrawalStatus.SENT);
    return;
  } else {
    logger.error(`Could not send raw transaction withdrawalTxId=${signedRecord.id}. Result is empty, please check...`);
  }

  return;
}

async function updateWithdrawalAndWithdrawalTx(
  manager: EntityManager,
  signedRecord: WithdrawalTx,
  txid: string,
  status: WithdrawalStatus.SENT | WithdrawalStatus.FAILED
): Promise<void> {
  let event: WithdrawalEvent;
  let newStatus: WithdrawalStatus;
  if (status === WithdrawalStatus.SENT) {
    // keep withdrawal status and fire sent withdrawal event
    newStatus = WithdrawalStatus.SENT;
    event = WithdrawalEvent.SENT;
  } else if (status === WithdrawalStatus.FAILED) {
    // changed withdrawal status to unsigned and fire txid_changed withdrawal event
    newStatus = WithdrawalStatus.UNSIGNED;
    event = WithdrawalEvent.TXID_CHANGED;
  }

  logger.info(`senderDoProcess: broadcast tx to network successfully: ${txid}`);

  await Utils.PromiseAll([
    rawdb.updateWithdrawalTxStatus(manager, signedRecord.id, newStatus, { txid }),
    rawdb.updateWithdrawalsStatus(manager, signedRecord.id, newStatus, event, { txid }),
  ]);

  return;
}

/**
 * The withdrawal record is constructed wrongly
 * This correction will:
 * - Remove the pending withdrawal_tx
 * - Mark the withdrawal status to `unsigned`
 * And the picker and signer will do the signing flow again
 */
async function reconstructWithdrawal(manager: EntityManager, withdrawalTx: WithdrawalTx): Promise<void> {
  await Promise.all([
    manager.update(WithdrawalTx, withdrawalTx.id, { status: WithdrawalStatus.FAILED }),
    rawdb.updateWithdrawalsStatus(manager, withdrawalTx.id, WithdrawalStatus.UNSIGNED, WithdrawalEvent.TXID_CHANGED),
  ]);
}
