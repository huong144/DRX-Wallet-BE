import { LatestBlock } from '../../entities';
import { BaseCrawler } from 'sota-common';
import { EntityManager, getConnection, In } from 'typeorm';

/**
 * This callback is invoked when a block is processed. We'll update latest_block table then
 * @param currency
 * @param type
 * @param blockNumber
 */
export async function getLatestCrawledBlockNumber(crawler: BaseCrawler): Promise<number> {
  const type = 'deposit';
  // Look up in database
  const connection = await getConnection();
  const result: number = await _updateLatestBlock(connection.manager, type, crawler);
  return result;
}

async function _updateLatestBlock(manager: EntityManager, type: string, crawler: BaseCrawler): Promise<number> {
  const crawlingCurrencyName: string = crawler.getNativeCurrency().symbol;
  const repository = manager.getRepository(LatestBlock);
  const latestBlock = await repository.findOne({ currency: crawlingCurrencyName, type });
  if (latestBlock) {
    return latestBlock.blockNumber;
  }

  // create new latest block record
  const record = new LatestBlock();
  record.type = type;
  record.currency = crawlingCurrencyName;
  record.blockNumber = await crawler.getPlatformGateway().getBlockCount();
  await repository.save(record);

  return record.blockNumber;
}

export default getLatestCrawledBlockNumber;
