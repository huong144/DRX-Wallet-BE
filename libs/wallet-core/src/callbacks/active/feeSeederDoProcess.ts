import {
  getLogger,
  Utils,
  BasePlatformWorker,
  CurrencyRegistry,
  IRawTransaction,
  GatewayRegistry,
  BitcoinBasedGateway,
  AccountBasedGateway,
} from 'sota-common';
import { EntityManager, getConnection, In, Not } from 'typeorm';
import _ from 'lodash';
import * as rawdb from '../../rawdb';
import { CollectStatus, InternalTransferType, WithdrawalStatus, DepositEvent } from '../../Enums';
import { Deposit, InternalTransfer, DepositLog } from '../../entities';

const logger = getLogger('feeSeederDoProcess');

export async function feeSeederDoProcess(seeder: BasePlatformWorker): Promise<void> {
  await getConnection().transaction(async manager => {
    await _feeSeederDoProcess(manager, seeder);
  });
}

async function _feeSeederDoProcess(manager: EntityManager, seeder: BasePlatformWorker): Promise<void> {
  const platformCurrency = seeder.getCurrency();
  const platformCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(platformCurrency.platform);
  const allSymbols = platformCurrencies.map(c => c.symbol);

  let seedingDepositAddresses = await manager
    .getRepository(Deposit)
    .createQueryBuilder('deposit')
    .innerJoin(DepositLog, 'deposit_log', 'deposit_log.deposit_id = deposit.id')
    .where('deposit.currency IN (:...symbols)', { symbols: allSymbols })
    .andWhere('deposit.collect_status = :status', {
      status: CollectStatus.SEED_REQUESTED,
    })
    .andWhere('deposit_log.event = :event', { event: DepositEvent.SEEDING })
    .select('deposit.to_address')
    .getRawMany();

  logger.info(`raw seeding deposit addresses: ${JSON.stringify(seedingDepositAddresses)}`);
  seedingDepositAddresses = _.compact(seedingDepositAddresses.map(s => s.to_address));
  logger.info(`(${seedingDepositAddresses.length}) seeding deposit addresses: [${seedingDepositAddresses}]`);
  logger.info(`allSymbols: [${allSymbols}]`);

  let seedDeposit;
  if (seedingDepositAddresses.length === 0) {
    seedDeposit = await manager.findOne(Deposit, {
      currency: In(allSymbols),
      collectStatus: CollectStatus.SEED_REQUESTED,
    });
  } else {
    seedDeposit = await manager.findOne(Deposit, {
      currency: In(allSymbols),
      toAddress: Not(In(seedingDepositAddresses)),
      collectStatus: CollectStatus.SEED_REQUESTED,
    });
  }

  if (!seedDeposit) {
    logger.info('No deposit need seeding');
    return;
  }

  const currency = platformCurrency;
  logger.info(`Found deposit need seeding id=${seedDeposit.id}`);

  const gateway = GatewayRegistry.getGatewayInstance(currency);
  const seedAmount = await gateway.getAverageSeedingFee();
  const hotWallet = await rawdb.findSufficientHotWallet(manager, seedDeposit.walletId, currency, seedAmount);

  if (!hotWallet) {
    // throw new Error(`Hot wallet for symbol=${currency.platform} not found`);
    logger.info(`No available hot wallet symbol=${currency.platform} at this moment. Will skip seeding this round.`);
    return;
  }

  let rawTx: IRawTransaction;
  try {
    rawTx = currency.isUTXOBased
      ? await (gateway as BitcoinBasedGateway).constructRawTransaction(hotWallet.address, [
          { toAddress: seedDeposit.toAddress, amount: seedAmount },
        ])
      : await (gateway as AccountBasedGateway).constructRawTransaction(
          hotWallet.address,
          seedDeposit.toAddress,
          seedAmount,
          {}
        );
  } catch (err) {
    logger.error(`Cannot create raw transaction, hot wallet balance may be not enough`);
    await rawdb.updateRecordsTimestamp(manager, Deposit, [seedDeposit.id]);
    throw err;
  }

  if (!rawTx) {
    throw new Error('rawTx is undefined because of unknown problem');
  }

  const signedTx = await gateway.signRawTransaction(rawTx.unsignedRaw, await hotWallet.extractRawPrivateKey());
  try {
    await gateway.sendRawTransaction(signedTx.signedRaw);
  } catch (e) {
    logger.error(`Can not send transaction txid=${signedTx.txid}`);
    throw e;
  }

  // create internal
  const internalTransferRecord = new InternalTransfer();
  internalTransferRecord.currency = seedDeposit.currency;
  internalTransferRecord.walletId = hotWallet.walletId;
  internalTransferRecord.fromAddress = 'will remove this field'; // remove
  internalTransferRecord.toAddress = seedDeposit.toAddress;
  internalTransferRecord.type = InternalTransferType.SEED;
  internalTransferRecord.txid = signedTx.txid;
  internalTransferRecord.status = WithdrawalStatus.SENT;
  internalTransferRecord.amount = seedAmount.toString();
  internalTransferRecord.feeCurrency = currency.platform;
  const depositLog = new DepositLog();
  depositLog.depositId = seedDeposit.id;
  depositLog.event = DepositEvent.SEEDING;
  depositLog.refId = seedDeposit.id;
  depositLog.data = signedTx.txid;
  await Utils.PromiseAll([
    rawdb.insertInternalTransfer(manager, internalTransferRecord),
    manager.getRepository(DepositLog).save(depositLog),
  ]);

  logger.info(`Seed Successfully address=${seedDeposit.toAddress}`);
}
