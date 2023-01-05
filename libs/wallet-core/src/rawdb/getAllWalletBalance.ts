import { EntityManager } from 'typeorm';
import { WalletBalance } from '../entities';
import { CurrencyRegistry } from '../../../sota-common';

export async function getAllWalletBalance(manager: EntityManager) {
  const listCurrencies = await manager.getRepository(WalletBalance).find();
  return listCurrencies.map(currency => CurrencyRegistry.getOneCurrency(currency.currency));
}
