import _ from 'lodash';
import { EntityManager, In } from 'typeorm';
import { Address } from '../entities';

/**
 * Filter and return only the addresses that we're watching (which are currently stored in address tables)
 *
 * @param {string[]} addresses - array of addresses that need to be filtered
 * @returns {string[]} filtered addresses
 */
export async function filterWatchingAddresses(
  manager: EntityManager,
  addresses: string[],
  currency: string
): Promise<string[]> {
  if (addresses.length === 0) {
    return [];
  }

  const watchingAddresses = await manager.getRepository(Address).find({ address: In(addresses), currency });
  const result = watchingAddresses.map(a => a.address);
  return _.compact(_.uniq(result));
}

export default filterWatchingAddresses;
