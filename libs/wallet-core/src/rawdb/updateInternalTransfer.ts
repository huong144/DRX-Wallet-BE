import { EntityManager } from 'typeorm';
import { CollectStatus, WithdrawalStatus } from '../Enums';
import { InternalTransfer } from '../entities/InternalTransfer';
import { BigNumber, CurrencyRegistry } from 'sota-common';

export async function updateInternalTransfer(
  manager: EntityManager,
  transfer: InternalTransfer,
  status: WithdrawalStatus,
  fee: BigNumber
): Promise<InternalTransfer> {
  const currencyInfo = CurrencyRegistry.getOneCurrency(transfer.currency);
  transfer.fee = fee.toString();
  transfer.status = status;
  transfer.feeCurrency = currencyInfo.platform;
  return manager.save(transfer);
}
