import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const KEY = 'safepath:store'

export async function loadStore() {
  const s = await redis.get(KEY)
  return s || { rev: 0, pins: {}, ops: {} }
}

export async function saveStore(store) {
  await redis.set(KEY, store)
}