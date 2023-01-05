import {
  getLogger,
  Utils,
  BlockchainPlatform,
  BasePlatformWorker,
  CurrencyRegistry,
  IRawTransaction,
  GatewayRegistry,
  BitcoinBasedGateway,
  BitcoinCashBasedGateway,
  AccountBasedGateway,
  BigNumber,
  IBoiledVOut,
  IBCHBoiledVOut,
  IBitcoreUtxoInput,
  ICurrency,
  ISignedRawTransaction,
  IBCHBitcoreUtxoInput,
  IRawVOut,
  IRawVOutAda,
} from 'sota-common';
import { EntityManager, getConnection } from 'typeorm';
import _ from 'lodash';
import * as rawdb from '../../rawdb';
import { CollectStatus, InternalTransferType, WithdrawalStatus } from '../../Enums';
import { Deposit, Address, InternalTransfer } from '../../entities';
import { getWalletId } from '../../rawdb/findAddress';

const logger = getLogger('collectorDoProcess');

export async function collectorDoProcess(collector: BasePlatformWorker): Promise<void> {
  await getConnection().transaction(async manager => {
    await _collectorDoProcess(manager, collector);
  });
}

/**
 * Tasks of collector:
 * - Find uncollected deposits
 *   + If the deposit currency is account-based, just take 1 record
 *   + If the deposit currency is utxo-based, take multiple records
 * - If the deposit amount is too small, just skip. We'll wait until the funds is big enough
 * - Find an internal hot wallet
 * - Send fee to deposit address if needed to collect tokens (ERC20, USDT, ...)
 * - Make transaction that transfer funds from deposit addresses to the hot wallet
 *
 * @param manager
 * @param picker
 * @private
 */
async function _collectorDoProcess(manager: EntityManager, collector: BasePlatformWorker): Promise<void> {
  const platformCurrency = collector.getCurrency();
  const platformCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(platformCurrency.platform);
  const allSymbols = platformCurrencies.map(c => c.symbol);

  const { walletId, currency, records, amount } = await rawdb.findOneGroupOfCollectableDeposits(manager, allSymbols);

  if (!walletId || !currency || !records.length || amount.isZero()) {
    logger.info(`There're no uncollected deposit right now. Will try to process later...`);
    return;
  }

  const rallyWallet = await rawdb.findAnyInternalHotWallet(manager, walletId, currency.platform);
  if (!rallyWallet) {
    throw new Error(`Hot wallet for symbol=${currency.platform} not found`);
  }
  let rawTx: IRawTransaction;
  try {
    // check balance in network to prevent mis-seeding error
    if (!currency.isNative) {
      const gateway = GatewayRegistry.getGatewayInstance(currency.platform);
      let minAmount;
      const walletBalance = await rawdb.findWalletBalance(manager, currency.platform, walletId);
      if (walletBalance && walletBalance.minimumCollectAmount) {
        minAmount = new BigNumber(walletBalance.minimumCollectAmount);
      } else {
        minAmount = (await gateway.getAverageSeedingFee()).multipliedBy(new BigNumber(3));
      }
      // if (records.length > 1) {
      //   throw new Error('multiple tx seeding is not supported now');
      // }
      const record = records[0];
      const balance = await gateway.getAddressBalance(record.toAddress);
      if (balance.gte(minAmount)) {
        logger.warn(`deposit id=${record.id} is pending, if it last for long, collect manually`);
        manager.update(Deposit, record.id, {
          updatedAt: Utils.nowInMillis() + 3 * 60 * 1000, // 3 minutes
        });
        return;
      }
    }
    if (!currency.isUTXOBased) {
      rawTx = await _constructAccountBasedCollectTx(records, rallyWallet.address);
    } else {
      rawTx = await _constructUtxoBasedCollectTx(records, rallyWallet.address);
    }
  } catch (err) {
    logger.warn(`Cannot create raw transaction, may need fee seeder err=${err}`);
    await rawdb.updateRecordsTimestamp(manager, Deposit, records.map(r => r.id));
    if (!currency.isNative) {
      const record = records[0];
      record.collectStatus = CollectStatus.SEED_REQUESTED;
      await manager.save(record);
    }
    return;
  }
  if (!rawTx) {
    throw new Error('rawTx is undefined because of unknown problem');
  }

  const signedTx = await _collectorSignDoProcess(manager, currency, records, rawTx);
  try {
    const txidAda = await _collectorSubmitDoProcess(manager, currency, walletId, signedTx, rallyWallet.address, amount);
    if (currency.symbol === BlockchainPlatform.Cardano) {
      signedTx.txid = txidAda;
    }
  } catch (e) {
    await manager.update(Deposit, records.map(r => r.id), {
      updatedAt: Utils.nowInMillis(),
      collectedTxid: 'SUBMIT_FAILED_CHECK_ME_PLEASE',
      collectStatus: CollectStatus.NOTCOLLECT,
    });
    throw e;
  }

  const now = Utils.nowInMillis();
  await manager.update(Deposit, records.map(r => r.id), {
    updatedAt: now,
    collectedTxid: signedTx.txid,
    collectStatus: CollectStatus.COLLECTING,
  });

  logger.info(`Collect tx sent: address=${rallyWallet.address}, txid=${signedTx.txid}`);
}

async function _constructUtxoBCHBasedCollectTx(deposits: Deposit[], toAddress: string): Promise<IRawTransaction> {
  const currency = CurrencyRegistry.getOneCurrency(deposits[0].currency);
  const gateway = GatewayRegistry.getGatewayInstance(currency) as BitcoinCashBasedGateway;
  const utxos: IBCHBitcoreUtxoInput[] = [];
  const weirdVouts: IBCHBoiledVOut[] = [];
  const depositAddresses: string[] = [];

  await Utils.PromiseAll(
    deposits.map(async deposit => {
      const depositAddress = deposit.toAddress;
      const txid = deposit.txid;
      if (depositAddresses.indexOf(depositAddress) === -1) {
        depositAddresses.push(depositAddress);
      }

      const depositVouts = await gateway.getOneTxVouts(deposit.txid, depositAddress);
      const allAddressUtxos = await gateway.getOneAddressUtxos(depositAddress);
      depositVouts.forEach(vout => {
        // Something went wrong. This output has been spent.
        if (vout.spentTxid) {
          weirdVouts.push(vout);
          return;
        }

        const utxo = allAddressUtxos.find(u => {
          return u.txId === txid && u.vout === vout.mintIndex;
        });

        // Double check. Something went wrong here as well. The output has been spent.
        if (!utxo) {
          logger.error(`Output has been spent already: address=${depositAddress}, txid=${txid}, n=${vout.mintIndex}`);
          return;
        }

        utxos.push(utxo);
      });
    })
  );

  // Safety check, just in case
  if (weirdVouts.length > 0) {
    throw new Error(`Weird outputs were spent without collecting: ${JSON.stringify(weirdVouts)}`);
  }

  // Final check. Guarding one more time, whether total value from utxos is equal to deposits' value
  const depositAmount = deposits.reduce((memo, d) => memo.plus(new BigNumber(d.amount)), new BigNumber(0));
  const utxoAmount = utxos.reduce((memo, u) => memo.plus(new BigNumber(u.satoshis)), new BigNumber(0));

  if (!depositAmount.eq(utxoAmount)) {
    throw new Error(`Mismatch collecting values: depositAmount=${depositAmount}, utxoAmount=${utxoAmount}`);
  }

  return gateway.constructRawConsolidateTransaction(utxos, toAddress);
}

async function _constructUtxoBasedCollectTx(deposits: Deposit[], toAddress: string): Promise<IRawTransaction> {
  const currency = CurrencyRegistry.getOneCurrency(deposits[0].currency);
  if (currency.symbol === BlockchainPlatform.BitcoinCash) {
    return await _constructUtxoBCHBasedCollectTx(deposits, toAddress);
  }
  const gateway = GatewayRegistry.getGatewayInstance(currency) as BitcoinBasedGateway;
  const utxos: IBitcoreUtxoInput[] = [];
  const weirdVouts: IBoiledVOut[] = [];
  const depositAddresses: string[] = [];

  await Utils.PromiseAll(
    deposits.map(async deposit => {
      const depositAddress = deposit.toAddress;
      const txid = deposit.txid;
      if (depositAddresses.indexOf(depositAddress) === -1) {
        depositAddresses.push(depositAddress);
      }

      const depositVouts = await gateway.getOneTxVouts(deposit.txid, depositAddress);
      const allAddressUtxos = await gateway.getOneAddressUtxos(depositAddress);
      depositVouts.forEach(vout => {
        // Something went wrong. This output has been spent.
        if (vout.spentTxid) {
          weirdVouts.push(vout);
          return;
        }

        const utxo = allAddressUtxos.find(u => {
          return u.txId === txid && u.vout === vout.mintIndex;
        });

        // Double check. Something went wrong here as well. The output has been spent.
        if (!utxo) {
          logger.error(`Output has been spent already: address=${depositAddress}, txid=${txid}, n=${vout.mintIndex}`);
          return;
        }

        utxos.push(utxo);
      });
    })
  );

  // Safety check, just in case
  if (weirdVouts.length > 0) {
    throw new Error(`Weird outputs were spent without collecting: ${JSON.stringify(weirdVouts)}`);
  }

  // Final check. Guarding one more time, whether total value from utxos is equal to deposits' value
  const depositAmount = deposits.reduce((memo, d) => memo.plus(new BigNumber(d.amount)), new BigNumber(0));
  const utxoAmount = utxos.reduce((memo, u) => memo.plus(new BigNumber(u.satoshis)), new BigNumber(0));

  if (!depositAmount.eq(utxoAmount)) {
    throw new Error(`Mismatch collecting values: depositAmount=${depositAmount}, utxoAmount=${utxoAmount}`);
  }

  return gateway.constructRawConsolidateTransaction(utxos, toAddress);
}

// async function _constructUtxoBasedCardanoCollectTx(
//   deposits: Deposit[],
//   toAddress: string,
//   manager: EntityManager
// ): Promise<IRawTransaction> {
//   const currency = CurrencyRegistry.getOneCurrency(deposits[0].currency);
//   const walletId = deposits[0].walletId;
//   if (currency.symbol !== BlockchainPlatform.Cardano) {
//     throw new Error('Currency must be ada');
//   }

//   let totalAmount = new BigNumber(0);
//   const fromAddress = deposits[0].toAddress;
//   // tslint:disable-next-line:prefer-for-of
//   for (let i = 0; i < deposits.length; ++i) {
//     const deposit = deposits[i];
//     totalAmount = totalAmount.plus(deposit.amount);
//   }
//   const gateway = GatewayRegistry.getGatewayInstance(currency); // as CardanoGateway;
//   const hotWalletAddress = await gateway.getFirstAddressInWallet(toAddress);
//   const vouts: IRawVOut = {
//     toAddress: hotWalletAddress,
//     amount: totalAmount,
//   };

//   const fromWallet = await getWalletId(fromAddress, deposits[0].walletId, manager);
//   const estimateFee = await gateway.estimateFeeV2(fromWallet, [vouts]);
//   const newVouts: IRawVOut = {
//     toAddress: vouts.toAddress,
//     amount: vouts.amount.minus(estimateFee),
//   };
//   return gateway.constructRawTransaction(fromWallet, [newVouts]);
// }

async function _constructAccountBasedCollectTx(deposits: Deposit[], toAddress: string): Promise<IRawTransaction> {
  const currency = CurrencyRegistry.getOneCurrency(deposits[0].currency);
  const gateway = GatewayRegistry.getGatewayInstance(currency) as AccountBasedGateway;
  const amount = deposits.reduce((memo, deposit) => {
    return memo.plus(new BigNumber(deposit.amount));
  }, new BigNumber(0));

  const opts = { isConsolidate: currency.isNative, useLowerNetworkFee: true };
  return gateway.constructRawTransaction(deposits[0].toAddress, toAddress, amount, opts);
}

async function _collectorSignDoProcess(
  manager: EntityManager,
  currency: ICurrency,
  deposits: Deposit[],
  rawTx: IRawTransaction
): Promise<ISignedRawTransaction> {
  const gateway = GatewayRegistry.getGatewayInstance(currency);
  let secrets = await Promise.all(
    deposits.map(async deposit => {
      const address = await manager.findOne(Address, {
        address: deposit.toAddress,
      });
      if (!address) {
        throw new Error(`${deposit.toAddress} is not in database`);
      }
      return await address.extractRawPrivateKey();
    })
  );

  secrets = _.uniq(secrets);

  if (currency.isUTXOBased && currency.symbol !== BlockchainPlatform.Cardano) {
    return gateway.signRawTransaction(rawTx.unsignedRaw, secrets);
  }

  if (secrets.length > 1 && currency.symbol !== BlockchainPlatform.Cardano) {
    throw new Error('Account-base tx is only use one secret');
  }

  if (currency.symbol === BlockchainPlatform.Cardano) {
    const secretFormat = JSON.parse(secrets[0]);
    secretFormat.wallet_address = secretFormat.walletId;
    secretFormat.spending_password = secretFormat.spendingPassword;
    secrets[0] = JSON.stringify(secretFormat);
  }
  return gateway.signRawTransaction(rawTx.unsignedRaw, secrets[0]);
}

async function _collectorSubmitDoProcess(
  manager: EntityManager,
  currency: ICurrency,
  walletId: number,
  signedTx: ISignedRawTransaction,
  toAddress: string,
  amount: BigNumber
): Promise<any> {
  const gateway = GatewayRegistry.getGatewayInstance(currency);

  try {
    const data = await gateway.sendRawTransaction(signedTx.signedRaw);
    if (currency.symbol === BlockchainPlatform.Cardano) {
      signedTx.txid = data.txid;
    }
  } catch (e) {
    logger.error(`Can not send transaction txid=${signedTx.txid}`);
    throw e;
  }

  const internalTransferRecord = new InternalTransfer();
  internalTransferRecord.currency = currency.symbol;
  internalTransferRecord.txid = signedTx.txid;
  internalTransferRecord.walletId = walletId;
  internalTransferRecord.type = InternalTransferType.COLLECT;
  internalTransferRecord.status = WithdrawalStatus.SENT;
  internalTransferRecord.fromAddress = 'will remove this field';
  internalTransferRecord.toAddress = toAddress;
  internalTransferRecord.amount = amount.toString();

  await Utils.PromiseAll([manager.save(internalTransferRecord)]);
  return internalTransferRecord.txid;
}
