import { getLogger } from './Logger';

const logger = getLogger('BaseIntervalWorker');

export abstract class BaseIntervalWorker {
  // Guarding flag to prevent the worker from starting multiple times
  protected _isStarted: boolean = false;

  // Interval time betwen each doProcess calls
  protected _nextTickTimer: number = 30000;

  // Maximum running time for one processing
  // If `doProcess` takes longer than this value (in millis),
  // It means something went wrong and the worker will be exited/restarted
  protected _processingTimeout: number = 300000;

  /**
   * The worker begins
   */
  public start(): void {
    if (this._isStarted) {
      logger.warn(`Trying to start processor twice: ${this.constructor.name}`);
      return;
    }

    this._isStarted = true;

    this.prepare()
      .then(res => {
        logger.info(`${this.constructor.name} finished preparing. Will start the first tick shortly...`);
        this.onTick();
      })
      .catch(err => {
        throw err;
      });
  }

  public getNextTickTimer(): number {
    return this._nextTickTimer;
  }

  public getProcessingTimeout(): number {
    return this._processingTimeout;
  }

  protected setNextTickTimer(timeout: number): void {
    this._nextTickTimer = timeout;
  }

  protected setProcessingTimeout(timeout: number): void {
    this._processingTimeout = timeout;
  }

  protected onTick(): void {
    const duration = this.getProcessingTimeout();
    const classname = this.constructor.name;
    const timer = setTimeout(async () => {
      logger.fatal(`${classname}::onTick timeout (${duration} ms) is exceeded. Worker will be restarted shortly...`);
      await logger.notifyErrorsImmediately();
      process.exit(1);
    }, duration);

    this.doProcess()
      .then(() => {
        clearTimeout(timer);
        setTimeout(() => {
          this.onTick();
        }, this.getNextTickTimer());
      })
      .catch(err => {
        clearTimeout(timer);
        logger.error(`======================================================================================`);
        logger.error(err);
        logger.error(`${classname} something went wrong. The worker will be restarted shortly...`);
        logger.error(`======================================================================================`);
        setTimeout(() => {
          this.onTick();
        }, this.getNextTickTimer());
      });
  }

  protected getWorkerInfo(): string {
    return this.constructor.name;
  }

  // Should be overrided in derived classes
  // to setup connections, listeners, ... here
  protected abstract prepare(): Promise<void>;

  // Should be overrided in derived classes
  // Main logic will come to here
  protected abstract doProcess(): Promise<void>;
}

export default BaseIntervalWorker;
