import { getRedis } from '../lib/redis.js';

const queueKey = (eventId: string) => `queue:event:${eventId}`;
const tokenKey = (eventId: string, token: string) =>
  `queue:event:${eventId}:token:${token}`;

const TOKEN_TTL_SEC = 120;
const ESTIMATED_WAIT_PER_SLOT_MS = 2000;

export interface EnqueueResult {
  position: number;
  estimatedWaitMs: number;
  token: string;
}

export const enqueue = async (
  eventId: string,
  userId: string,
): Promise<EnqueueResult | null> => {
  const r = getRedis();
  if (!r) return null;
  const token = `${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  const position = await r.rpush(queueKey(eventId), token);
  await r.set(tokenKey(eventId, token), '1', 'EX', TOKEN_TTL_SEC);
  return {
    position,
    estimatedWaitMs: position * ESTIMATED_WAIT_PER_SLOT_MS,
    token,
  };
};

export const peek = async (
  eventId: string,
  token: string,
): Promise<{ position: number } | null> => {
  const r = getRedis();
  if (!r) return null;
  const all = await r.lrange(queueKey(eventId), 0, -1);
  const idx = all.indexOf(token);
  if (idx === -1) return null;
  return { position: idx + 1 };
};

export const dequeueBatch = async (
  eventId: string,
  size: number,
): Promise<string[]> => {
  const r = getRedis();
  if (!r) return [];
  const tokens: string[] = [];
  for (let i = 0; i < size; i++) {
    const token = await r.lpop(queueKey(eventId));
    if (!token) break;
    tokens.push(token);
    await r.del(tokenKey(eventId, token));
  }
  return tokens;
};

export const queueDepth = async (eventId: string): Promise<number> => {
  const r = getRedis();
  if (!r) return 0;
  return await r.llen(queueKey(eventId));
};
