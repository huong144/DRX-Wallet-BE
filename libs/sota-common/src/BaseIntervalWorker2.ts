import BaseIntervalWorker from './BaseIntervalWorker';
import { IIntervalWorkerOptions } from './interfaces';

/**
 * The basic differences from BaseIntervalWorker is
 * logic of prepare and doProcess method are decoupled from the worker class
 */
export class BaseIntervalWorker2 extends BaseIntervalWorker {
  protected _options: IIntervalWorkerOptions;

  public CurrencyIntervalWorker2(options: IIntervalWorkerOptions) {
    this._options = options;
  }

  protected async prepare() {
    await this._options.prepare(this);
  }

  protected async doProcess() {
    await this._options.doProcess(this);
  }
}

export default BaseIntervalWorker2;
