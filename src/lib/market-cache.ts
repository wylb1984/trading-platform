import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  staleUntil: number;
}

type CacheStore = Record<string, CacheEntry>;

const dataDir = path.join(process.cwd(), "data");
const cachePath = path.join(dataDir, "market-cache.json");

let writeQueue: Promise<void> = Promise.resolve();

async function ensureCacheFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(cachePath, "utf-8");
  } catch {
    await writeFile(cachePath, JSON.stringify({}, null, 2), "utf-8");
  }
}

async function readCacheStore(): Promise<CacheStore> {
  await ensureCacheFile();
  try {
    const raw = await readFile(cachePath, "utf-8");
    return JSON.parse(raw) as CacheStore;
  } catch {
    return {};
  }
}

async function writeCacheStore(store: CacheStore) {
  await ensureCacheFile();
  writeQueue = writeQueue.then(() => writeFile(cachePath, JSON.stringify(store, null, 2), "utf-8"));
  await writeQueue;
}

export async function getPersistentCache<T>(key: string): Promise<{ value: T; state: "fresh" | "stale" } | null> {
  const store = await readCacheStore();
  const entry = store[key];
  if (!entry) {
    return null;
  }

  const now = Date.now();
  if (entry.staleUntil <= now) {
    delete store[key];
    await writeCacheStore(store);
    return null;
  }

  return {
    value: entry.value as T,
    state: entry.expiresAt > now ? "fresh" : "stale"
  };
}

export async function setPersistentCache<T>(
  key: string,
  value: T,
  options: { ttlMs: number; staleMs: number }
) {
  const store = await readCacheStore();
  const now = Date.now();
  store[key] = {
    value,
    expiresAt: now + options.ttlMs,
    staleUntil: now + options.ttlMs + options.staleMs
  };
  await writeCacheStore(store);
}
