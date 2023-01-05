import { EntityManager } from 'typeorm';
import { WebhookLog } from '../entities';
import { Utils } from 'sota-common';

export async function insertWebhookLog(
  manager: EntityManager,
  progressId: number,
  url: string,
  params: string,
  status: number,
  msg: string
): Promise<void> {
  await manager
    .getRepository(WebhookLog)
    .insert({ progressId, url, params, status, msg, createdAt: Utils.nowInMillis() });
  return;
}
