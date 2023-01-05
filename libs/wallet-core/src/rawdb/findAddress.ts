import { Address } from '../entities';
import { EntityManager } from 'typeorm';
import { BlockchainPlatform } from '../../../sota-common';
import Kms from '../encrypt/Kms';

export async function findAddress(manager: EntityManager, currency: string, walletId: number): Promise<Address> {
  return manager.findOne(Address, {
    where: {
      currency,
      walletId,
    },
  });
}
export async function getWalletId(address: string, walletId: number, manager: EntityManager): Promise<string> {
  const record = await manager.findOne(Address, {
    where: {
      address,
      walletId,
    },
  });
  if (record.currency !== BlockchainPlatform.Cardano) {
    throw new Error('Cannot find address');
  }
  let seed;
  const secret = JSON.parse(record.secret);
  if (secret.private_key) {
    seed = secret.private_key;
    if (secret.kms_data_key_id > 0) {
      seed = await Kms.getInstance().decrypt(secret.private_key, secret.kms_data_key_id);
    }
  }
  const result: string = JSON.parse(seed).walletId;
  return result;
}
