import _ from 'lodash';
import { EntityManager, getConnection } from 'typeorm';
import {
  getLogger,
  BaseCurrencyWorker,
  UTXOBasedGateway,
  GatewayRegistry,
  CurrencyRegistry,
  BigNumber,
  IRawVOut,
  IRawVIn,
  IRawTransaction,
  AccountBasedGateway,
} from 'sota-common';
import { Withdrawal } from '../../entities';
import { inspect } from 'util';
import * as rawdb from '../../rawdb';
import { TMP_ADDRESS } from '../../hd_wallet/Const';
import { BlockchainPlatform, SolanaBasedGateway } from 'sota-common';

const logger = getLogger('pickerDoProcess');
let failedCounter = 0;

export async function pickerDoProcess(picker: BaseCurrencyWorker): Promise<void> {
  await getConnection().transaction(async manager => {
    await _pickerDoProcess(manager, picker);
  });
}

/**
 * Tasks of picker:
 * - Find withdrawals that can be picked next round (see how records will be chosen in `getNextPickedWithdrawals` method)
 * - Find a hot wallet, which is free (no pending transaction) and sufficient for requesting amount
 * - Create a withdrawal_tx record, which will cover for the withdrawals above:
 *   + For utxo-based currencies, we can process many withdrawals in one tx
 *   + For account-based currencies, we can only process 1 withdrawal in one tx
 * - Update `withdrawal_tx_id` and change `status` to `signing` for all selected withdrawal records
 * - The tx is ready to be signed now
 *
 * Then the transaction should be ready to send to the network
 *
 * @param manager
 * @param picker
 * @private
 */
async function _pickerDoProcess(manager: EntityManager, picker: BaseCurrencyWorker): Promise<void> {
  // Pick a bunch of withdrawals and create a raw transaction for them
  const iCurrency = picker.getCurrency();
  const candidateWithdrawals = await rawdb.getNextPickedWithdrawals(manager, iCurrency.platform);
  if (!candidateWithdrawals.length) {
    logger.info(`No more withdrawal need to be picked up. Will check upperthreshold hot wallet the next tick...`);
    await rawdb.checkUpperThreshold(manager, iCurrency.platform);
    return;
  }

  let withdrawalIds = candidateWithdrawals.map(w => w.id);
  const walletId = candidateWithdrawals[0].walletId;
  const symbol = candidateWithdrawals[0].currency;
  const currency = CurrencyRegistry.getOneCurrency(symbol);
  const finalPickedWithdrawals: Withdrawal[] = [];
  if (currency.isUTXOBased) {
    finalPickedWithdrawals.push(...candidateWithdrawals.filter(w => w.fromAddress === TMP_ADDRESS));
  } else {
    finalPickedWithdrawals.push(candidateWithdrawals[0]);
  }
  withdrawalIds = finalPickedWithdrawals.map(w => w.id);
  const vouts: IRawVOut[] = [];
  let amount = new BigNumber(0);
  finalPickedWithdrawals.forEach(withdrawal => {
    const _amount = new BigNumber(withdrawal.amount);
    // Safety check. This case should never happen. But we handle it just in case
    if (_amount.eq(0)) {
      return;
    }

    amount = amount.plus(_amount);
    vouts.push({
      toAddress: withdrawal.toAddress,
      amount: new BigNumber(withdrawal.amount),
    });
  });

  // Find an available internal hot wallet
  const hotWallet = await rawdb.findSufficientHotWallet(manager, walletId, currency, amount);
  if (!hotWallet) {
    failedCounter += 1;
    if (failedCounter % 50 === 0) {
      // Raise issue if the hot wallet is not available for too long...
      logger.warn(`No available hot wallet walletId=${walletId} currency=${currency} failedCounter=${failedCounter}`);
    } else {
      // Else just print info and continue to wait
      logger.info(`No available hot wallet at the moment: walletId=${walletId} currency=${currency.symbol}`);
    }

    await rawdb.updateRecordsTimestamp(manager, Withdrawal, withdrawalIds);

    return;
  }
  if (currency.isUTXOBased) {
    const coldWithdrawals = candidateWithdrawals.filter(w => w.fromAddress === hotWallet.address);
    finalPickedWithdrawals.push(...coldWithdrawals);
    withdrawalIds = finalPickedWithdrawals.map(w => w.id);
    coldWithdrawals.forEach(withdrawal => {
      const _amount = new BigNumber(withdrawal.amount);
      // Safety check. This case should never happen. But we handle it just in case
      if (_amount.eq(0)) {
        return;
      }
      amount = amount.plus(_amount);
      vouts.push({
        toAddress: withdrawal.toAddress,
        amount: new BigNumber(withdrawal.amount),
      });
    });
    if (!(await rawdb.checkHotWalletIsSufficient(hotWallet, amount))) {
      throw new Error(`Hot wallet is insufficient, check me please!`);
    }
  }
  // Reset failed counter when there's available hot wallet
  failedCounter = 0;

  const gateway = GatewayRegistry.getGatewayInstance(currency);

  let unsignedTx: IRawTransaction = null;
  try {
    if (currency.isUTXOBased) {
      unsignedTx = await (gateway as UTXOBasedGateway).constructRawTransaction(hotWallet.address, vouts);
    } else {
      const fromAddress = hotWallet.address;
      const toAddress = vouts[0].toAddress;
      const destinationTag = finalPickedWithdrawals[0].getTag();
      const gw = gateway;
      if (currency.symbol == BlockchainPlatform.Solana) unsignedTx = await (gw as SolanaBasedGateway).constructRawTransaction(fromAddress, toAddress, amount, {});
      else unsignedTx = await (gw as AccountBasedGateway).constructRawTransaction(fromAddress, toAddress, amount, { destinationTag });
    }
  } catch (err) {
    // Most likely the fail reason is insufficient balance from hot wallet
    // Or there was problem with connection to the full node
    logger.error(
      `Could not create raw tx address=${hotWallet.address}, vouts=${inspect(vouts)}, error=${inspect(err)}`
    );

    // update withdrawal record
    await rawdb.updateRecordsTimestamp(manager, Withdrawal, withdrawalIds);
    return;
  }

  if (!unsignedTx) {
    logger.error(`Could not construct unsigned tx. Just wait until the next tick...`);
    await rawdb.updateRecordsTimestamp(manager, Withdrawal, withdrawalIds);
    return;
  }

  // Create withdrawal tx record
  try {
    await rawdb.doPickingWithdrawals(manager, unsignedTx, hotWallet, currency.symbol, withdrawalIds);
  } catch (e) {
    logger.fatal(`Could not finish picking withdrawal ids=[${withdrawalIds}] err=${e.toString()}`);
    throw e;
  }

  return;
}

export default pickerDoProcess;
