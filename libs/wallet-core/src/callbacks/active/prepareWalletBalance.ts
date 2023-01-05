import { Wallet, WalletBalance } from '../../entities';
import { getConnection } from 'typeorm';
import { ICurrency, Utils } from 'sota-common';

export async function prepareWalletBalanceAll(currencies: ICurrency[]): Promise<void> {
  const connection = getConnection();

  const platform = currencies[0].platform;
  const [wallets] = await Promise.all([connection.getRepository(Wallet).find({ currency: platform })]);

  const values: any[] = [];

  wallets.map(wallet => {
    values.push(
      ...currencies.map(currency => ({
        walletId: wallet.id,
        currency: currency.symbol,
        balance: 0,
        withdrawalPending: 0,
        withdrawalTotal: 0,
        depositTotal: 0,
        createdAt: Utils.nowInSeconds(),
        updatedAt: Utils.nowInSeconds(),
      }))
    );
  });

  await connection
    .createQueryBuilder()
    .insert()
    .into(WalletBalance)
    .values(values)
    .orIgnore()
    .execute();

  return;
}
