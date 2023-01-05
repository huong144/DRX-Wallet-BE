import { EnvConfigRegistry, getLogger, getRedisSubscriber } from 'sota-common';
import { createClient, RedisClient } from 'redis';

export function publishRedis(message: any) {
  const appId = EnvConfigRegistry.getAppId();
  const pub = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  });
  pub.publish(appId, message);
}
