import { BasePlatformWorker } from 'sota-common';

export class BaseCoinCollector extends BasePlatformWorker {
  protected _nextTickTimer: number = 60000;
}
