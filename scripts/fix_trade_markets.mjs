import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const storePath = path.join(process.cwd(), "data", "app-store.json");
const snapshotsPath = path.join(process.cwd(), "data", "daily-snapshots.json");

function normalizeTrade(trade) {
  const originalSymbol = String(trade.symbol ?? "").trim().toUpperCase();
  let market = trade.market;
  let symbol = originalSymbol;

  if (originalSymbol.startsWith("HK.")) {
    market = "HK";
    const base = originalSymbol.slice(3);
    symbol = /^\d+$/.test(base) ? `${base.padStart(4, "0")}.HK` : originalSymbol;
  } else if (originalSymbol.endsWith(".HK")) {
    market = "HK";
    const base = originalSymbol.replace(/\.HK$/i, "");
    symbol = /^\d+$/.test(base) ? `${base.padStart(4, "0")}.HK` : originalSymbol;
  } else if (originalSymbol.startsWith("SH.") || originalSymbol.startsWith("SZ.")) {
    market = "CN";
    const exchange = originalSymbol.slice(0, 2);
    const base = originalSymbol.slice(3);
    symbol = `${base}.${exchange}`;
  } else if (originalSymbol.endsWith(".SH") || originalSymbol.endsWith(".SZ")) {
    market = "CN";
    symbol = originalSymbol;
  } else if (originalSymbol.startsWith("US.")) {
    market = "US";
    symbol = originalSymbol.slice(3);
  }

  return {
    changed: market !== trade.market || symbol !== trade.symbol,
    trade: {
      ...trade,
      market,
      symbol
    }
  };
}

const raw = await readFile(storePath, "utf-8");
const store = JSON.parse(raw);

let changedCount = 0;
store.tradeLogs = (store.tradeLogs ?? []).map((trade) => {
  const normalized = normalizeTrade(trade);
  if (normalized.changed) {
    changedCount += 1;
  }
  return normalized.trade;
});

await writeFile(storePath, JSON.stringify(store, null, 2), "utf-8");

try {
  const snapshotRaw = await readFile(snapshotsPath, "utf-8");
  const snapshots = JSON.parse(snapshotRaw);
  for (const key of Object.keys(snapshots)) {
    if (key.startsWith("review:") || key.startsWith("watchlist-signals:")) {
      delete snapshots[key];
    }
  }
  await writeFile(snapshotsPath, JSON.stringify(snapshots, null, 2), "utf-8");
} catch {}

console.log(JSON.stringify({ ok: true, changedCount }, null, 2));
