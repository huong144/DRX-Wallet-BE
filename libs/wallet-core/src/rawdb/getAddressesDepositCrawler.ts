import { Address } from '../entities';
import { EntityManager, In } from 'typeorm';

export async function getAddressesDepositCrawler(manager: EntityManager, currency: string): Promise<string[]> {
  // Find address of currency
  return (await manager.find(Address, {
    currency,
  })).map(address => address.address);
}
