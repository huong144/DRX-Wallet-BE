import { EnvConfig } from '../entities';
import { EntityManager, In } from 'typeorm';

export async function findInfoSendEmail(manager: EntityManager): Promise<string> {
  const email = await manager.findOne(EnvConfig, {
    where: {
      key: 'MAIL_HOLDER_COLD_WALLET',
    },
  });
  if (!email) {
    return null;
  }
  return email.value;
}
