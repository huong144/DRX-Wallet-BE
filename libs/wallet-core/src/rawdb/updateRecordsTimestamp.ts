import { EntityManager, ObjectType } from 'typeorm';
import { Utils } from 'sota-common';

interface IEntity {
  updatedAt: number;
}

export async function updateRecordsTimestamp(manager: EntityManager, entityClass: ObjectType<IEntity>, ids: number[]) {
  await manager.update(entityClass, ids, { updatedAt: Utils.nowInMillis() });
}

export default updateRecordsTimestamp;
