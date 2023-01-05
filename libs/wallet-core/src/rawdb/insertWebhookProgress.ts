import { EntityManager } from 'typeorm';
import { Webhook, WebhookProgress } from '../entities';
import { getLogger, Utils } from 'sota-common';
import { WebhookType, WithdrawalEvent, DepositEvent } from '../Enums';

const logger = getLogger('rawdb::insertWebhookProgress');

/**
 * Everytime an event happens and need to notify to client, one or some webhook progresses are created
 * There will be a webhook processor, which picks the pending progress records and dispatch them to target urls later
 *
 * @param {EntityManager} manager
 * @param {number} userId
 * @param {string} type - can be "deposit" or "withdrawal"
 * @param {number} refId - the ID of deposit or withdrawal, corresponding to the type
 * @param {string} event -
 */
export async function insertWebhookProgress(
  manager: EntityManager,
  userId: number,
  type: WebhookType,
  refId: number,
  event: DepositEvent | WithdrawalEvent
): Promise<void> {
  // Find out all user webhooks first
  const webhooks = await manager.getRepository(Webhook).find({ userId });

  // Construct the records
  const progressRecords = webhooks.map(webhook => {
    const record = new WebhookProgress();
    record.webhookId = webhook.id;
    record.type = type;
    record.event = event;
    record.refId = refId;
    record.createdAt = Utils.nowInMillis();
    record.updatedAt = Utils.nowInMillis();
    return record;
  });

  // And persist them to database
  await manager.getRepository(WebhookProgress).save(progressRecords);

  logger.info(`Created webhook progress: userId=${userId}, type=${type}, refId=${refId}, event=${event}`);
  return;
}

export default insertWebhookProgress;
