import { createClient, RedisClient } from 'redis';
import util from 'util';
import { EnvConfigRegistry } from './registries';
import { getLogger } from './Logger';

const logger = getLogger('RedisChannel');
let sub: RedisClient = null;

export function getRedisSubscriber(customChannel?: string): RedisClient {
  if (sub) {
    return sub;
  }

  sub = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  });

  const appId = EnvConfigRegistry.getAppId();

  if (!customChannel) {
    sub.subscribe(`${appId}`);
  } else {
    sub.subscribe(`${appId}:${customChannel}`);
  }

  return sub;
}

interface IRedisPromiseClient {
  setex(key: string, seconds: number, value: string): Promise<string>;
  set(key: string, value: string): Promise<string>;
  get(key: string): Promise<string>;
  publish(channel: string, message: string): Promise<string>;
}

let client: RedisClient;
let promiseClient: IRedisPromiseClient;
export function getRedisClient() {
  if (!EnvConfigRegistry.isUsingRedis()) {
    throw new Error(`Redis is not enabled now.`);
  }

  if (!client) {
    client = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
    });

    promiseClient = {
      setex: util.promisify(client.setex).bind(client),
      set: util.promisify(client.set).bind(client),
      get: util.promisify(client.get).bind(client),
      publish: util.promisify(client.publish).bind(client),
    };
  }

  return promiseClient;
}
