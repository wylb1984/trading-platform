import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Candle, Market } from "@/lib/types";

type CandleStore = Record<string, Candle[]>;

const dataDir = path.join(process.cwd(), "data");
const storePath = path.join(dataDir, "candle-store.json");

let writeQueue: Promise<void> = Promise.resolve();

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(storePath, "utf-8");
  } catch {
    await writeFile(storePath, JSON.stringify({}, null, 2), "utf-8");
  }
}

async function readStore(): Promise<CandleStore> {
  await ensureStoreFile();
  try {
    const raw = await readFile(storePath, "utf-8");
    return JSON.parse(raw) as CandleStore;
  } catch {
    return {};
  }
}

async function writeStore(store: CandleStore) {
  await ensureStoreFile();
  writeQueue = writeQueue.then(() => writeFile(storePath, JSON.stringify(store, null, 2), "utf-8"));
  await writeQueue;
}

function buildKey(symbol: string, market: Market) {
  return `${market}:${symbol}`;
}

function normalizeCandles(candles: Candle[]) {
  const merged = new Map<string, Candle>();
  for (const candle of candles) {
    if (!candle?.date) {
      continue;
    }
    merged.set(candle.date, {
      date: candle.date,
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
      volume: Number(candle.volume ?? 0)
    });
  }
  return Array.from(merged.values()).sort((left, right) => left.date.localeCompare(right.date));
}

export async function getStoredCandles(
  symbol: string,
  market: Market,
  options?: { startDate?: string; limit?: number }
): Promise<Candle[]> {
  const store = await readStore();
  const candles = normalizeCandles(store[buildKey(symbol, market)] ?? []);
  const filtered = options?.startDate ? candles.filter((item) => item.date >= options.startDate!) : candles;
  if (options?.limit && filtered.length > options.limit) {
    return filtered.slice(-options.limit);
  }
  return filtered;
}

export async function mergeStoredCandles(symbol: string, market: Market, candles: Candle[]): Promise<Candle[]> {
  if (!candles.length) {
    return getStoredCandles(symbol, market);
  }

  const store = await readStore();
  const key = buildKey(symbol, market);
  const merged = normalizeCandles([...(store[key] ?? []), ...candles]);
  store[key] = merged;
  await writeStore(store);
  return merged;
}
