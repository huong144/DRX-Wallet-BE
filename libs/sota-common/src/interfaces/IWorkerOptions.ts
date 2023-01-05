import { BaseIntervalWorker } from '../BaseIntervalWorker';
import { BaseCurrencyWorker } from '../BaseCurrencyWorker';

export interface IIntervalWorkerOptions {
  readonly prepare: (worker: BaseIntervalWorker) => Promise<void>;
  readonly doProcess: (worker: BaseIntervalWorker) => Promise<void>;
}

export interface ICurrencyWorkerOptions {
  readonly prepare: (worker: BaseCurrencyWorker) => Promise<void>;
  readonly doProcess: (worker: BaseCurrencyWorker) => Promise<void>;
}
