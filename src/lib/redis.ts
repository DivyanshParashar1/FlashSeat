import { Redis } from 'ioredis';

let client: InstanceType<typeof Redis> | undefined;

export const getRedis = (): InstanceType<typeof Redis> | undefined => {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return undefined;
  client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
  });
  client.connect().catch((err: Error) => {
    console.error('redis connect failed:', err?.message ?? err);
  });
  return client;
};

export const redisAvailable = async (): Promise<boolean> => {
  const r = getRedis();
  if (!r) return false;
  try {
    await r.ping();
    return true;
  } catch {
    return false;
  }
};
