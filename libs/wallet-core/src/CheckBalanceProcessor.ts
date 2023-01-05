import fetch from 'node-fetch';
import { EntityManager, getConnection } from 'typeorm';
import { BaseIntervalWorker, getLogger, Utils, CurrencyRegistry, BlockchainPlatform, ICurrency } from 'sota-common';
import { WebhookType } from './Enums';
import { Webhook, WebhookProgress, Deposit, Withdrawal, UserCurrency, HotWallet } from './entities';
import * as rawdb from './rawdb';
import { v1 as uuid } from 'uuid';

const logger = getLogger('WebhookProcessor');

export class CheckBalanceProcessor extends BaseIntervalWorker {
  protected _nextTickTimer: number = 3600000;
  protected readonly _id: string;
  constructor() {
    super();
    this._id = uuid();
  }
  protected async prepare(): Promise<void> {
    // Nothing to do...
  }
  protected async doProcess(): Promise<void> {
    return getConnection().transaction(async manager => {
      try {
        await this._doProcess(manager);
      } catch (e) {
        logger.error(`CheckBalanceProcessor do process failed with error`);
        logger.error(e);
      }
    });
  }

  private async _doProcess(manager: EntityManager): Promise<void> {
    logger.info(`Get all currency registed in system`);
    const allCurrencies = await rawdb.getAllWalletBalance(manager);
    const nativeCurrencies = allCurrencies.filter(_currency => _currency.isNative);
    await Promise.all(
      nativeCurrencies.map(async nativeCurrency => {
        const _allCurrencies = CurrencyRegistry.getCurrenciesOfPlatform(nativeCurrency.platform);
        const hotWallets = await rawdb.findAllHotWallets(manager, nativeCurrency.platform);
        await Promise.all(
          _allCurrencies.map(async cur => {
            const tasks: Array<Promise<any>> = [];
            hotWallets.map(async hotWallet => {
              tasks.push(rawdb.lowerThresholdHandle(manager, cur, hotWallet));
            });
            tasks.push(rawdb.checkInsufficientBalance(cur, hotWallets, manager));
            return await Promise.all(tasks);
          })
        );
      })
    );
  }
}
