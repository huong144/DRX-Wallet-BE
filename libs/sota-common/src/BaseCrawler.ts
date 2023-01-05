import { v1 as uuid } from 'uuid';
import BaseGateway from './BaseGateway';
import BaseIntervalWorker from './BaseIntervalWorker';
import CurrencyRegistry from './registries/CurrencyRegistry';
import { Block, Transactions } from './types';
import { ICurrency } from './interfaces';
import { getLogger, implement } from '..';
import { BlockchainPlatform } from './enums';
import { GatewayRegistry } from './registries';

const logger = getLogger('BaseCrawler');

// Store in-progress block
const LATEST_PROCESSED_BLOCK = new Map<string, number>();

// Crawler options, usually are funtions to handle project-related logic
// Something like getting and updating data to database, ...
export interface ICrawlerOptions {
  readonly getLatestCrawledBlockNumber: (crawler: BaseCrawler) => Promise<number>;
  readonly onBlockCrawled: (crawler: BaseCrawler, block: Block) => Promise<void>;
  readonly onCrawlingTxs: (crawler: BaseCrawler, txs: Transactions) => Promise<void>;
}

export abstract class BaseCrawler extends BaseIntervalWorker {
  protected readonly _id: string;
  protected readonly _options: ICrawlerOptions;
  protected readonly _nativeCurrency: ICurrency;

  constructor(platform: BlockchainPlatform, options: ICrawlerOptions) {
    super();
    this._id = uuid();
    this._options = options;
    this._nativeCurrency = CurrencyRegistry.getOneNativeCurrency(platform);
  }

  public getInstanceId(): string {
    return this._id;
  }

  public getOptions(): ICrawlerOptions {
    return this._options;
  }

  public getNativeCurrency(): ICurrency {
    return this._nativeCurrency;
  }

  // Crawler is made for detecting deposits by default
  public getCrawlType(): string {
    return 'deposit';
  }

  /**
   * Decide number of blocks to get in one time based on
   * number of currency when crawling
   * and required confirmations
   */
  public getBlockNumInOneGo(): number {
    return this.getRequiredConfirmations() + 1;
  }

  public getAverageBlockTime(): number {
    return CurrencyRegistry.getCurrencyConfig(this._nativeCurrency).averageBlockTime;
  }

  public getRequiredConfirmations(): number {
    return CurrencyRegistry.getCurrencyConfig(this._nativeCurrency).requiredConfirmations;
  }

  public getPlatformGateway(): BaseGateway {
    return GatewayRegistry.getGatewayInstance(this._nativeCurrency);
  }

  @implement
  protected async prepare(): Promise<void> {
    // Do we need any preparation here yet?
  }

  @implement
  protected async doProcess(): Promise<void> {
    // Firstly try to get latest block number from network
    const latestNetworkBlock = await this.getPlatformGateway().getBlockCount();
    // And looking for the latest processed block in local
    let latestProcessedBlock = LATEST_PROCESSED_BLOCK.get(this._id);
    // If there's no data in-process, then try to find it from environment variable
    if (!latestProcessedBlock && process.env.FORCE_CRAWL_BLOCK) {
      latestProcessedBlock = parseInt(process.env.FORCE_CRAWL_BLOCK, 10);
    }

    // If still no data, use the callback in options to get the inital value for this process
    if (!latestProcessedBlock || isNaN(latestProcessedBlock)) {
      latestProcessedBlock = await this._options.getLatestCrawledBlockNumber(this);
    }

    // If there's no data, just process from the newest block on the network
    if (!latestProcessedBlock) {
      latestProcessedBlock = latestNetworkBlock - 1;
    }

    /**
     * Start with the next block of the latest processed one
     */
    const fromBlockNumber = latestProcessedBlock + 1;

    /**
     * If crawled the newest block already
     * Wait for a period that is equal to average block time
     * Then try crawl again (hopefully new block will be available then)
     */
    if (fromBlockNumber > latestNetworkBlock) {
      logger.info(
        `Block <${fromBlockNumber}> is the newest block can be processed (on network: ${latestNetworkBlock}). Wait for the next tick...`
      );
      return;
    }

    /**
     * Try to process several blocks at once, up to the newest one on the network
     */
    let toBlockNumber = latestProcessedBlock + this.getBlockNumInOneGo();
    if (toBlockNumber > latestNetworkBlock) {
      toBlockNumber = latestNetworkBlock;
    }

    /**
     * Actual crawl and process blocks
     * about 10 minutes timeout based on speed of gateway
     */
    await this.processBlocks(fromBlockNumber, toBlockNumber, latestNetworkBlock);

    /**
     * Safe block number is the highest crawled block that has enough confirmations
     */
    let safeBlockNumber = latestNetworkBlock - this.getRequiredConfirmations();
    if (safeBlockNumber > toBlockNumber) {
      safeBlockNumber = toBlockNumber;
    }
    const recentBlock = await this.getPlatformGateway().getOneBlock(safeBlockNumber);
    if (recentBlock) {
      await this.getOptions().onBlockCrawled(this, recentBlock);
    }

    /**
     * Cache the latest processed block number
     * Do the loop again in the next tick
     */
    LATEST_PROCESSED_BLOCK.set(this._id, safeBlockNumber);

    if (toBlockNumber >= latestNetworkBlock) {
      // If the newest block is processed already, will check the next tick after 1 block time duration
      logger.info(`Have processed newest block already. Will wait for a while until next check...`);
      this.setNextTickTimer(this.getAverageBlockTime());
    } else {
      // Otherwise try to continue processing immediately
      this.setNextTickTimer(1);
    }

    return;
  }

  protected abstract processBlocks(fromBlock: number, toBlock: number, latestBlock: number): Promise<void>;
}

export default BaseCrawler;
