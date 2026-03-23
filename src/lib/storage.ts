import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppSettings, CashFlowItem, PortfolioHolding, TradeLogItem, WatchlistItem } from "@/lib/types";

const dataDir = path.join(process.cwd(), "data");

interface AppStore {
  watchlist: WatchlistItem[];
  portfolioDraft: PortfolioHolding[];
  settings: AppSettings;
  tradeLogs: TradeLogItem[];
  cashFlows: CashFlowItem[];
}

const defaultStore: AppStore = {
  watchlist: [
    { symbol: "AAPL", market: "US", note: "AI + consumer ecosystem", createdAt: new Date().toISOString() },
    { symbol: "0700.HK", market: "HK", note: "China internet bellwether", createdAt: new Date().toISOString() },
    { symbol: "510300.SH", market: "CN", note: "Core China beta", createdAt: new Date().toISOString() }
  ],
  portfolioDraft: [
    { symbol: "AAPL", market: "US", quantity: 30, averageCost: 188 },
    { symbol: "0700.HK", market: "HK", quantity: 500, averageCost: 318 },
    { symbol: "510300.SH", market: "CN", quantity: 5000, averageCost: 3.82 }
  ],
  settings: {
    marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? "demo",
    aiProvider: process.env.OPENAI_API_KEY ? "openai" : "rules",
    defaultMarkets: ["US", "HK", "CN"],
    riskProfile: "balanced"
  },
  tradeLogs: [
    {
      id: "seed-aapl-buy",
      symbol: "AAPL",
      market: "US",
      side: "BUY",
      quantity: 20,
      price: 184.5,
      fee: 2.5,
      tradeDate: new Date().toISOString().slice(0, 10),
      note: "Core growth allocation"
    }
  ],
  cashFlows: [
    {
      id: "seed-deposit",
      amount: 100000,
      flowDate: new Date().toISOString().slice(0, 10),
      type: "DEPOSIT",
      note: "Initial capital"
    }
  ]
};

function getStorePath() {
  return path.join(dataDir, "app-store.json");
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(getStorePath(), "utf-8");
  } catch {
    await writeFile(getStorePath(), JSON.stringify(defaultStore, null, 2), "utf-8");
  }
}

function tryParseStore(raw: string) {
  return JSON.parse(raw) as AppStore;
}

function repairStore(raw: string): AppStore | null {
  const trimmed = raw.trim();
  for (let end = trimmed.length; end > 0; end -= 1) {
    const candidate = trimmed.slice(0, end).trimEnd();
    if (!candidate.endsWith("}")) {
      continue;
    }
    try {
      return tryParseStore(candidate);
    } catch {}
  }
  return null;
}

async function readStore(): Promise<AppStore> {
  await ensureStore();
  const raw = await readFile(getStorePath(), "utf-8");
  try {
    return tryParseStore(raw);
  } catch {
    const repaired = repairStore(raw);
    if (repaired) {
      await writeStore(repaired);
      return repaired;
    }
    await writeStore(defaultStore);
    return defaultStore;
  }
}

async function writeStore(store: AppStore) {
  await ensureStore();
  const target = getStorePath();
  const temp = `${target}.tmp`;
  await writeFile(temp, JSON.stringify(store, null, 2), "utf-8");
  await rename(temp, target);
}

export async function getWatchlist() {
  return (await readStore()).watchlist;
}

export async function saveWatchlist(watchlist: WatchlistItem[]) {
  const store = await readStore();
  store.watchlist = watchlist;
  await writeStore(store);
  return store.watchlist;
}

export async function getPortfolioDraft() {
  return (await readStore()).portfolioDraft;
}

export async function savePortfolioDraft(portfolioDraft: PortfolioHolding[]) {
  const store = await readStore();
  store.portfolioDraft = portfolioDraft;
  await writeStore(store);
  return store.portfolioDraft;
}

export async function getSettings() {
  return (await readStore()).settings;
}

export async function saveSettings(settings: AppSettings) {
  const store = await readStore();
  store.settings = settings;
  await writeStore(store);
  return store.settings;
}

export async function getTradeLogs() {
  return (await readStore()).tradeLogs;
}

export async function saveTradeLogs(tradeLogs: TradeLogItem[]) {
  const store = await readStore();
  store.tradeLogs = tradeLogs;
  await writeStore(store);
  return store.tradeLogs;
}

export async function getCashFlows() {
  return (await readStore()).cashFlows;
}

export async function saveCashFlows(cashFlows: CashFlowItem[]) {
  const store = await readStore();
  store.cashFlows = cashFlows;
  await writeStore(store);
  return store.cashFlows;
}
