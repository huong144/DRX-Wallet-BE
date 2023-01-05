import { EntityManager } from 'typeorm';
import { InternalTransfer } from '../entities/InternalTransfer';

export async function insertInternalTransfer(manager: EntityManager, data: InternalTransfer): Promise<void> {
  await manager.getRepository(InternalTransfer).insert(data);
  return;
}
