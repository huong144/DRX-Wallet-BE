import * as rawdb from '../../rawdb';
import { getConnection } from 'typeorm';
import { BaseCrawler } from 'sota-common';
export async function getAddressesDepositCrawler(crawler: BaseCrawler): Promise<string[]> {
  let addresses: string[] = [];
  await getConnection().transaction(async manager => {
    addresses = await rawdb.getAddressesDepositCrawler(manager, crawler.getNativeCurrency().symbol);
  });
  return addresses;
}
