import { execFile, spawn } from "node:child_process";
import { buildQuoteSnapshot, buildSnapshotFromCandles } from "@/lib/analytics";
import { getStoredCandles, mergeStoredCandles } from "@/lib/candle-store";
import { getPersistentCache, setPersistentCache } from "@/lib/market-cache";
import { instruments } from "@/lib/instruments";
import { getDefaultMarketRouting, getProviderConfig, MarketDataProvider } from "@/lib/providers";
import { Candle, Market, MarketOverviewItem, NewsItem, QuoteSnapshot } from "@/lib/types";
import { getDemoNews } from "@/lib/news";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function formatDataRecency(snapshot: QuoteSnapshot) {
  if (!snapshot.lastUpdated) {
    return snapshot.dataLatency === "eod" ? "盘后快照" : "数据可用";
  }
  const date = snapshot.lastUpdated.slice(0, 10);
  if (snapshot.dataLatency === "eod") {
    return `盘后更新 ${date}`;
  }
  if (snapshot.dataLatency === "delayed") {
    return `延时数据 ${date}`;
  }
  return `更新于 ${date}`;
}

export function describeUnavailableData(symbol: string, market: Market) {
  const instrument = instruments.find((item) => item.symbol === symbol);
  if (instrument?.assetClass === "index") {
    if (market === "US") {
      return "免费源对美股指数直连覆盖不足，当前未取到可靠盘后快照。";
    }
    if (market === "HK") {
      return "港股指数当前依赖 AKShare 桥接，今天未取到可校验盘后快照。";
    }
    return "A 股指数当前依赖 AKShare 桥接，今天未取到可校验盘后快照。";
  }
  if (market === "US") {
    return "美股个股当前未取到足够的盘后日线，可能是免费额度或上游限流导致。";
  }
  if (market === "HK") {
    return "港股个股当前依赖免费延时源，今天未取到可校验日线数据。";
  }
  return "A 股个股当前依赖 AKShare 桥接，今天未取到可校验日线数据。";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(4000)
  });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchJsonViaCurl<T>(url: string): Promise<T> {
  const { stdout } = await execFileAsync("curl", ["-s", "--max-time", "8", url], {
    maxBuffer: 1024 * 1024 * 8
  });
  return JSON.parse(stdout) as T;
}

async function fetchText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(4000)
  });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return new TextDecoder("gb18030").decode(buffer);
}

async function fetchPlainText(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(4000)
  });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  return response.text();
}

async function decodeHkSinaPayload(payload: string): Promise<
  Array<{
    date?: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
  }>
> {
  return new Promise((resolve, reject) => {
    const child = spawn("python3", [`${process.cwd()}/python/hk_sina_decode.py`], {
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `hk decode exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

const transientCache = new Map<string, { expiresAt: number; value: unknown }>();

function getCachedValue<T>(key: string): T | undefined {
  const entry = transientCache.get(key);
  if (!entry) {
    return undefined;
  }
  if (entry.expiresAt <= Date.now()) {
    transientCache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCachedValue<T>(key: string, value: T, ttlMs: number) {
  transientCache.set(key, { expiresAt: Date.now() + ttlMs, value });
}

function withCacheState<T extends object>(value: T, state: "fresh" | "stale") {
  return {
    ...value,
    cacheState: state
  };
}

function withCacheStateList<T extends object>(values: T[], state: "fresh" | "stale") {
  return values.map((value) => withCacheState(value, state));
}

function buildProviderBaseSnapshot(input: {
  symbol: string;
  price: number;
  change: number;
  changePct: number;
  volume?: number;
  candles?: Candle[];
  dataSource?: string;
  lastUpdated?: string;
  dataLatency?: "eod" | "delayed" | "realtime";
}) {
  const instrument = instruments.find((item) => item.symbol === input.symbol);
  if (!instrument) {
    return null;
  }

  const candles = input.candles ?? [];
  const latestPrice = Number(input.price.toFixed(2));
  return {
    ...instrument,
    price: latestPrice,
    change: Number(input.change.toFixed(2)),
    changePct: Number(input.changePct.toFixed(2)),
    volume: Number(input.volume ?? 0),
    turnover: Number(((input.volume ?? 0) * latestPrice).toFixed(2)),
    dataSource: input.dataSource,
    lastUpdated: input.lastUpdated,
    dataLatency: input.dataLatency,
    pe: undefined,
    pb: undefined,
    dividendYield: undefined,
    marketCap: undefined,
    indicators: candles.length
      ? buildSnapshotFromCandles(input.symbol, candles)?.indicators ?? {
          sma20: latestPrice,
          sma60: latestPrice,
          rsi14: 50,
          volatility30d: 0
        }
      : {
          sma20: latestPrice,
          sma60: latestPrice,
          rsi14: 50,
          volatility30d: 0
        },
    candles
  };
}

async function getFinnhubQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return null;
  }

  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const quote = await fetchJson<{ c: number; d: number; dp: number; pc: number; t: number }>(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  );

  const price = Number(quote.c.toFixed(2));
  return buildProviderBaseSnapshot({
    symbol,
    price,
    change: quote.d,
    changePct: quote.dp,
    volume: 0,
    dataSource: "Finnhub",
    lastUpdated: new Date(quote.t * 1000).toISOString(),
    dataLatency: "realtime"
  });
}

async function getTwelveDataQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return null;
  }

  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const candles = await getTwelveDataCandles(symbol, instrument.market);
  if (candles.length < 2) {
    return null;
  }

  const last = candles.at(-1)!;
  const previous = candles.at(-2)!;
  const change = Number((last.close - previous.close).toFixed(2));
  const changePct = previous.close === 0 ? 0 : Number((((last.close - previous.close) / previous.close) * 100).toFixed(2));
  const base = buildProviderBaseSnapshot({
    symbol,
    price: last.close,
    change,
    changePct,
    volume: last.volume,
    candles,
    dataSource: "Twelve Data",
    lastUpdated: `${last.date}T00:00:00.000Z`,
    dataLatency: "eod"
  });
  if (!base) {
    return null;
  }

  return {
    ...base,
    volume: last.volume,
    turnover: Number((last.volume * last.close).toFixed(2))
  };
}

async function getEodhdQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const apiKey = process.env.EODHD_API_KEY;
  if (!apiKey) {
    return null;
  }

  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const quote = await fetchJson<{ close: number; change: number; change_p: number; volume: number }>(
    `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json`
  );

  return buildProviderBaseSnapshot({
    symbol,
    price: Number(quote.close.toFixed(2)),
    change: Number(quote.change.toFixed(2)),
    changePct: Number(quote.change_p.toFixed(2)),
    volume: quote.volume,
    dataSource: "EODHD",
    lastUpdated: new Date().toISOString(),
    dataLatency: "delayed"
  });
}

async function getOpenbbQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const serviceUrl = process.env.OPENBB_SERVICE_URL;
  if (!serviceUrl) {
    return null;
  }

  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const quote = await fetchJson<{
    symbol: string;
    name: string;
    market: string;
    price: number;
    change: number;
    change_pct: number;
    volume?: number | null;
  }>(`${serviceUrl}/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(instrument.market)}`);

  const candles = await fetchJson<
    Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume?: number | null;
    }>
  >(`${serviceUrl}/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(instrument.market)}&limit=180`).catch(() => []);

  const normalizedCandles: Candle[] = candles.length
    ? candles.map((item) => ({
        date: item.date,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume ?? 0)
      }))
    : [];

  const base = buildProviderBaseSnapshot({
    symbol,
    price: Number(quote.price),
    change: Number(quote.change),
    changePct: Number(quote.change_pct),
    volume: Number(quote.volume ?? 0),
    dataSource: "OpenBB",
    lastUpdated: normalizedCandles.at(-1)?.date ? `${normalizedCandles.at(-1)!.date}T00:00:00.000Z` : new Date().toISOString(),
    dataLatency: "delayed"
  });
  if (!base) {
    return null;
  }

  const rebuilt = buildSnapshotFromCandles(symbol, normalizedCandles) ?? base;
  return {
    ...rebuilt,
    price: Number(quote.price),
    change: Number(quote.change),
    changePct: Number(quote.change_pct),
    volume: Number(quote.volume ?? rebuilt.volume),
    turnover: Number(((quote.volume ?? rebuilt.volume) * Number(quote.price)).toFixed(2))
  };
}

async function getAlphaVantageQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return null;
  }

  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const quote = await fetchJson<{
    "Global Quote"?: {
      "05. price"?: string;
      "09. change"?: string;
      "10. change percent"?: string;
      "06. volume"?: string;
    };
    Note?: string;
    Information?: string;
  }>(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`);

  const globalQuote = quote["Global Quote"];
  if (!globalQuote?.["05. price"]) {
    return null;
  }

  const candles = await getAlphaVantageCandles(symbol);

  const base = buildProviderBaseSnapshot({
    symbol,
    price: Number(globalQuote["05. price"]),
    change: Number(globalQuote["09. change"] ?? 0),
    changePct: Number((globalQuote["10. change percent"] ?? "0").replace("%", "")),
    volume: Number(globalQuote["06. volume"] ?? 0),
    dataSource: "Alpha Vantage",
    lastUpdated: candles.at(-1)?.date ? `${candles.at(-1)!.date}T00:00:00.000Z` : new Date().toISOString(),
    dataLatency: "eod"
  });
  if (!base) {
    return null;
  }
  const rebuilt = candles.length ? buildSnapshotFromCandles(symbol, candles) ?? base : base;

  return {
    ...rebuilt,
    price: Number(globalQuote["05. price"]),
    change: Number(globalQuote["09. change"] ?? rebuilt.change),
    changePct: Number((globalQuote["10. change percent"] ?? `${rebuilt.changePct}`).replace("%", "")),
    volume: Number(globalQuote["06. volume"] ?? rebuilt.volume),
    turnover: Number((Number(globalQuote["06. volume"] ?? rebuilt.volume) * Number(globalQuote["05. price"])).toFixed(2))
  };
}

async function getAkshareQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const serviceUrl = process.env.AKSHARE_SERVICE_URL;
  if (!serviceUrl) {
    return null;
  }

  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const quote = await fetchJson<{
    symbol: string;
    name: string;
    market: string;
    price: number;
    change: number;
    change_pct: number;
    volume?: number | null;
  }>(`${serviceUrl}/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(instrument.market)}`);

  const candles = await getAkshareCandles(symbol, instrument.market);

  const base = buildProviderBaseSnapshot({
    symbol,
    price: Number(quote.price),
    change: Number(quote.change),
    changePct: Number(quote.change_pct),
    volume: Number(quote.volume ?? 0),
    dataSource: "AKShare",
    lastUpdated: candles.at(-1)?.date ? `${candles.at(-1)!.date}T00:00:00.000Z` : new Date().toISOString(),
    dataLatency: instrument.market === "HK" ? "delayed" : "eod"
  });
  if (!base) {
    return null;
  }
  const rebuilt = candles.length ? buildSnapshotFromCandles(symbol, candles) ?? base : base;

  return {
    ...rebuilt,
    price: Number(quote.price),
    change: Number(quote.change),
    changePct: Number(quote.change_pct),
    volume: Number(quote.volume ?? rebuilt.volume),
    turnover: Number((Number(quote.volume ?? rebuilt.volume) * Number(quote.price)).toFixed(2))
  };
}

function normalizeSinaCode(symbol: string, market: Market, assetClass: string) {
  if (market === "US") {
    if (symbol === "IXIC") {
      return "usr_ixic";
    }
    if (symbol === "GSPC") {
      return "usr_inx";
    }
    return `usr_${symbol.toLowerCase()}`;
  }
  if (market === "HK") {
    if (assetClass === "index") {
      return `hk${symbol}`;
    }
    const numeric = symbol.replace(".HK", "");
    return `hk${numeric.padStart(5, "0")}`;
  }
  const [code, exchange] = symbol.split(".");
  if (exchange && (assetClass === "index" || assetClass === "stock" || assetClass === "etf" || assetClass === "fund")) {
    return `s_${exchange.toLowerCase()}${code}`;
  }
  return symbol.toLowerCase();
}

function parseSinaTimestamp(raw: string) {
  if (!raw) {
    return undefined;
  }
  const normalized = raw.trim().replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2},\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace(",", "T")}:00+08:00`;
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace(" ", "T")}-04:00`;
  }
  return undefined;
}

function parseSinaLine(line: string, symbol: string): string[] | null {
  const prefix = `var hq_str_${symbol}=`;
  if (!line.startsWith(prefix)) {
    return null;
  }
  const match = line.match(/="(.*)";?$/);
  if (!match) {
    return null;
  }
  return match[1].split(",");
}

async function getSinaQuote(symbol: string): Promise<QuoteSnapshot | null> {
  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const sinaCode = normalizeSinaCode(symbol, instrument.market, instrument.assetClass);
  const payload = await fetchText(`https://hq.sinajs.cn/list=${encodeURIComponent(sinaCode)}`, {
    headers: {
      Referer: "https://finance.sina.com.cn"
    }
  }).catch(() => "");

  const fields = payload
    .split("\n")
    .map((line) => parseSinaLine(line.trim(), sinaCode))
    .find(Boolean);
  if (!fields?.length) {
    return null;
  }

  if (instrument.market === "US") {
    const price = Number(fields[1] ?? 0);
    const changePct = Number(fields[2] ?? 0);
    const change = Number(fields[4] ?? 0);
    const volume = Number(fields[10] ?? 0);
    if (!price) {
      return null;
    }
    return buildProviderBaseSnapshot({
      symbol,
      price,
      change,
      changePct,
      volume,
      dataSource: "Sina Finance",
      lastUpdated: parseSinaTimestamp(fields[3] ?? ""),
      dataLatency: "eod"
    });
  }

  if (instrument.market === "HK") {
    const price = Number(fields[6] ?? 0);
    const change = Number(fields[7] ?? 0);
    const changePct = Number(fields[8] ?? 0);
    const volume = Number(fields[11] ?? 0);
    if (!price) {
      return null;
    }
    return buildProviderBaseSnapshot({
      symbol,
      price,
      change,
      changePct,
      volume,
      dataSource: "Sina Finance",
      lastUpdated: parseSinaTimestamp(`${fields[17] ?? ""},${fields[18] ?? ""}`),
      dataLatency: instrument.assetClass === "index" ? "delayed" : "delayed"
    });
  }

  const candles = await getSinaCnCandles(symbol);
  const price = Number(fields[1] ?? 0);
  const change = Number(fields[2] ?? 0);
  const changePct = Number(fields[3] ?? 0);
  const volume = Number(fields[4] ?? 0);
  if (!price) {
    return null;
  }
  const base = buildProviderBaseSnapshot({
    symbol,
    price,
    change,
    changePct,
    volume,
    candles,
    dataSource: "Sina Finance",
    lastUpdated: new Date().toISOString(),
    dataLatency: "delayed"
  });
  if (!base) {
    return null;
  }
  const rebuilt = candles.length ? buildSnapshotFromCandles(symbol, candles) ?? base : base;
  return {
    ...rebuilt,
    price,
    change,
    changePct,
    volume,
    turnover: Number((volume * price).toFixed(2)),
    dataSource: "Sina Finance",
    lastUpdated: new Date().toISOString(),
    dataLatency: "delayed"
  };
}

async function getAlphaVantageCandles(symbol: string): Promise<Candle[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return [];
  }

  type AlphaVantageDailyPayload = {
    "Time Series (Daily)"?: Record<
      string,
      {
        "1. open": string;
        "2. high": string;
        "3. low": string;
        "4. close": string;
        "5. volume": string;
      }
    >;
  };

  const payload: AlphaVantageDailyPayload = await fetchJson<AlphaVantageDailyPayload>(
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
  ).catch(() => ({} as AlphaVantageDailyPayload));

  const series = payload["Time Series (Daily)"];
  if (!series) {
    return [];
  }

  return Object.entries(series)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-180)
    .map(([date, value]) => ({
      date,
      open: Number(value["1. open"]),
      high: Number(value["2. high"]),
      low: Number(value["3. low"]),
      close: Number(value["4. close"]),
      volume: Number(value["5. volume"] ?? 0)
    }));
}

async function getAkshareCandles(symbol: string, market: Market, limit = 180): Promise<Candle[]> {
  const serviceUrl = process.env.AKSHARE_SERVICE_URL;
  if (!serviceUrl) {
    return [];
  }

  return fetchJson<Array<{ date: string; open: number; high: number; low: number; close: number; volume?: number | null }>>(
    `${serviceUrl}/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}&limit=${limit}`
  )
    .then((items) =>
      items.map((item) => ({
        date: item.date,
        open: Number(item.open),
        high: Number(item.high),
        low: Number(item.low),
        close: Number(item.close),
        volume: Number(item.volume ?? 0)
      }))
    )
    .catch(() => []);
}

function normalizeSinaCnSymbol(symbol: string) {
  const [code, exchange] = symbol.split(".");
  if (!code || !exchange) {
    return null;
  }
  return `${exchange.toLowerCase()}${code}`;
}

async function getSinaCnCandles(symbol: string, limit = 180): Promise<Candle[]> {
  const normalizedSymbol = normalizeSinaCnSymbol(symbol);
  if (!normalizedSymbol) {
    return [];
  }

  const cacheKey = `sina-cn-candles:${symbol}:${limit}`;
  const cached = getCachedValue<Candle[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const raw = await fetchText(
    `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${encodeURIComponent(normalizedSymbol)}&scale=240&ma=no&datalen=${limit}`
  ).catch(() => "");

  let parsed: Array<{ day: string; open: string; high: string; low: string; close: string; volume?: string }> = [];
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  const candles = parsed
    .map((item) => ({
      date: item.day.slice(0, 10),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume ?? 0)
    }))
    .filter((item) => item.date && Number.isFinite(item.close) && item.close > 0);

  if (candles.length) {
    setCachedValue(cacheKey, candles, 15 * 60_000);
  }
  return candles;
}

async function getSinaHkCandles(symbol: string, limit = 180): Promise<Candle[]> {
  const numeric = symbol.replace(".HK", "").padStart(5, "0");
  const cacheKey = `sina-hk-candles:${numeric}:${limit}`;
  const cached = getCachedValue<Candle[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const raw = await fetchText(`https://finance.sina.com.cn/stock/hkstock/${numeric}/klc2_kl.js`).catch(() => "");
  const match = raw.match(/="([^"]+)"/);
  if (!match?.[1]) {
    return [];
  }

  const decoded = await decodeHkSinaPayload(match[1]).catch(() => []);
  const candles = decoded
    .map((item) => ({
      date: String(item.date ?? "").slice(0, 10),
      open: Number(item.open ?? 0),
      high: Number(item.high ?? 0),
      low: Number(item.low ?? 0),
      close: Number(item.close ?? 0),
      volume: Number(item.volume ?? 0)
    }))
    .filter((item) => item.date && Number.isFinite(item.close) && item.close > 0);
  const trimmed = limit > 0 ? candles.slice(-limit) : candles;

  if (trimmed.length) {
    setCachedValue(cacheKey, trimmed, 15 * 60_000);
  }
  return trimmed;
}

function buildEastmoneySecid(symbol: string, market: Market) {
  if (market !== "CN") {
    return null;
  }
  const [code, exchange] = symbol.split(".");
  if (!code || !exchange) {
    return null;
  }
  const marketId = exchange.toUpperCase() === "SH" ? "1" : exchange.toUpperCase() === "SZ" ? "0" : null;
  if (!marketId) {
    return null;
  }
  return `${marketId}.${code}`;
}

async function getEastmoneyCandles(symbol: string, market: Market, startDate = "2024-01-01", limit = 180): Promise<Candle[]> {
  const secid = buildEastmoneySecid(symbol, market);
  if (!secid) {
    return [];
  }

  const cacheKey = `eastmoney-candles:${market}:${symbol}:${startDate}:${limit}`;
  const cached = getCachedValue<Candle[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await fetchJson<{
    data?: {
      klines?: string[];
    } | null;
  }>(
    `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=1&beg=${startDate.replaceAll("-", "")}&end=20500101`
  ).catch(async () =>
    fetchJsonViaCurl<{
      data?: {
        klines?: string[];
      } | null;
    }>(
      `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=1&beg=${startDate.replaceAll("-", "")}&end=20500101`
    ).catch(() => ({ data: null }))
  );

  const candles = (payload.data?.klines ?? [])
    .slice(limit > 0 ? -limit : undefined)
    .map((line) => {
      const [date, open, close, high, low, volume] = line.split(",");
      return {
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume ?? 0)
      };
    })
    .filter((item) => item.date && Number.isFinite(item.close) && item.close > 0);

  if (candles.length) {
    setCachedValue(cacheKey, candles, 15 * 60_000);
  }
  return candles;
}

function normalizeTwelveDataSymbol(symbol: string, market: Market) {
  if (market === "HK") {
    return symbol.replace(/\.HK$/i, "");
  }
  if (market === "CN") {
    return symbol.replace(/\.(SH|SZ)$/i, "");
  }
  return symbol;
}

async function getTwelveDataCandles(symbol: string, market: Market, outputsize = 180): Promise<Candle[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return [];
  }

  const normalizedSymbol = normalizeTwelveDataSymbol(symbol, market);
  const cacheKey = `twelve-candles:${market}:${normalizedSymbol}:${outputsize}`;
  const cached = getCachedValue<Candle[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await fetchJson<{
    code?: number;
    message?: string;
    status?: string;
    values?: Array<{
      datetime: string;
      open: string;
      high: string;
      low: string;
      close: string;
      volume?: string;
    }>;
  }>(
    `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(normalizedSymbol)}&interval=1day&outputsize=${outputsize}&apikey=${apiKey}`
  ).catch(() => ({ values: [] }));

  const candles = (payload.values ?? [])
    .slice()
    .reverse()
    .map((item) => ({
      date: item.datetime.slice(0, 10),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume ?? 0)
    }));
  if (candles.length) {
    setCachedValue(cacheKey, candles, 60_000);
  }
  return candles;
}

function normalizeStooqSymbol(symbol: string) {
  return symbol.toLowerCase().replace(/\./g, "-");
}

async function getStooqUsCandles(symbol: string, outputsize = 180): Promise<Candle[]> {
  const normalizedSymbol = normalizeStooqSymbol(symbol);
  const cacheKey = `stooq-candles:US:${normalizedSymbol}:${outputsize}`;
  const cached = getCachedValue<Candle[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const raw = await fetchPlainText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(`${normalizedSymbol}.us`)}&i=d`).catch(() => "");
  if (!raw || raw.startsWith("No data")) {
    return [];
  }

  const rows = raw
    .trim()
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);

  const candles = rows
    .map((line) => {
      const [date, open, high, low, close, volume] = line.split(",");
      return {
        date,
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume ?? 0)
      };
    })
    .filter((item) => item.date && Number.isFinite(item.close) && item.close > 0)
    .slice(-outputsize);

  if (candles.length) {
    setCachedValue(cacheKey, candles, 60 * 60_000);
  }
  return candles;
}

export async function getHistoricalCandles(
  symbol: string,
  market?: Market,
  options?: { startDate?: string; limit?: number; longRange?: boolean }
): Promise<Candle[]> {
  const explicitMarket = market ?? instruments.find((item) => item.symbol === symbol)?.market;
  if (!explicitMarket) {
    return [];
  }

  const limit = options?.limit ?? (options?.longRange ? 5000 : 180);
  const startDate = options?.startDate ?? (options?.longRange ? "2020-01-01" : "2024-01-01");
  const requiredCount = options?.longRange ? limit : Math.min(limit, 60);
  const cacheKey = `historical:${explicitMarket}:${symbol}:${startDate}:${limit}`;

  const stored = await getStoredCandles(symbol, explicitMarket, { startDate, limit });
  if (stored.length >= requiredCount) {
    setCachedValue(cacheKey, stored, 15 * 60_000);
    return stored;
  }

  const cached = getCachedValue<Candle[]>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const persisted = await getPersistentCache<Candle[]>(cacheKey);
  if (persisted?.state === "fresh") {
    setCachedValue(cacheKey, persisted.value, 15 * 60_000);
    return persisted.value;
  }

  const providerOrder = getProviderOrder(symbol, explicitMarket);
  for (const provider of providerOrder) {
    try {
      if (provider === "alphaVantage") {
        const candles = await getAlphaVantageCandles(symbol);
        if (candles.length) {
          const merged = await mergeStoredCandles(symbol, explicitMarket, candles);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
      if (provider === "akshareBridge") {
        const candles = await getAkshareCandles(symbol, explicitMarket, limit);
        if (candles.length) {
          const merged = await mergeStoredCandles(symbol, explicitMarket, candles);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
      if (provider === "sina" && explicitMarket === "CN") {
        const candles = await getSinaCnCandles(symbol, limit);
        if (candles.length) {
          const merged = await mergeStoredCandles(symbol, explicitMarket, candles);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
      if (provider === "sina" && explicitMarket === "HK") {
        const candles = await getSinaHkCandles(symbol, limit);
        if (candles.length) {
          const merged = await mergeStoredCandles(symbol, explicitMarket, candles);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
      if (provider === "twelveData") {
        const candles = await getTwelveDataCandles(symbol, explicitMarket, limit);
        if (candles.length) {
          const merged = await mergeStoredCandles(symbol, explicitMarket, candles);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
      if (explicitMarket === "US") {
        const candles = await getStooqUsCandles(symbol, limit);
        if (candles.length) {
          const merged = await mergeStoredCandles(symbol, explicitMarket, candles);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
      if (provider === "openbbBridge" && process.env.OPENBB_SERVICE_URL) {
        const candles = await fetchJson<Array<{ date: string; open: number; high: number; low: number; close: number; volume?: number | null }>>(
          `${process.env.OPENBB_SERVICE_URL}/candles?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(explicitMarket)}&limit=${limit}`
        ).catch(() => []);
        if (candles.length) {
          const normalized = candles.map((item) => ({
            date: item.date,
            open: Number(item.open),
            high: Number(item.high),
            low: Number(item.low),
            close: Number(item.close),
            volume: Number(item.volume ?? 0)
          }));
          const merged = await mergeStoredCandles(symbol, explicitMarket, normalized);
          const scoped = merged.filter((item) => item.date >= startDate).slice(-limit);
          setCachedValue(cacheKey, scoped, 15 * 60_000);
          await setPersistentCache(cacheKey, scoped, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
          return scoped;
        }
      }
    } catch {}
  }

  if (persisted?.state === "stale") {
    setCachedValue(cacheKey, persisted.value, 15 * 60_000);
    return persisted.value;
  }
  return stored;
}

function normalizeSentiment(label?: string): NewsItem["sentiment"] {
  const value = label?.toLowerCase() ?? "";
  if (value.includes("bullish") || value.includes("positive")) {
    return "positive";
  }
  if (value.includes("bearish") || value.includes("negative")) {
    return "negative";
  }
  return "neutral";
}

async function getQuoteByProvider(provider: ReturnType<typeof getProviderConfig>["provider"], symbol: string) {
  if (provider === "akshareBridge") {
    return getAkshareQuote(symbol);
  }
  if (provider === "finnhub") {
    return getFinnhubQuote(symbol);
  }
  if (provider === "twelveData") {
    return getTwelveDataQuote(symbol);
  }
  if (provider === "eodhd") {
    return getEodhdQuote(symbol);
  }
  if (provider === "openbbBridge") {
    return getOpenbbQuote(symbol);
  }
  if (provider === "alphaVantage") {
    return getAlphaVantageQuote(symbol);
  }
  if (provider === "sina") {
    return getSinaQuote(symbol);
  }
  return null;
}

function findInstrument(symbol: string) {
  return instruments.find((item) => item.symbol === symbol);
}

function getProviderOrder(symbol: string, explicitMarket?: Market): MarketDataProvider[] {
  const routing = getDefaultMarketRouting();
  const market = explicitMarket ?? findInstrument(symbol)?.market;
  if (market === "US") {
    return routing.US;
  }
  if (market === "HK") {
    return routing.HK;
  }
  if (market === "CN") {
    return routing.CN;
  }

  const globalProvider = getProviderConfig().provider;
  return globalProvider === "demo" ? ["sina", "alphaVantage", "openbbBridge", "akshareBridge", "demo"] : [globalProvider, "demo"];
}

export async function getQuote(
  symbol: string,
  market?: Market,
  options?: { allowSyntheticFallback?: boolean }
): Promise<QuoteSnapshot | null> {
  const cacheKey = `quote:v3:${market ?? "auto"}:${symbol}:${options?.allowSyntheticFallback === true ? "synthetic" : "real"}`;
  const cached = getCachedValue<QuoteSnapshot | null>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const persisted = await getPersistentCache<QuoteSnapshot | null>(cacheKey);
  if (persisted?.state === "fresh" && persisted.value) {
    const fresh = withCacheState(persisted.value, "fresh");
    setCachedValue(cacheKey, fresh, 15 * 60_000);
    return fresh;
  }

  const providerOrder = getProviderOrder(symbol, market);

  for (const provider of providerOrder) {
    if (provider === "demo") {
      continue;
    }
    try {
      const snapshot = await getQuoteByProvider(provider, symbol);
      if (snapshot) {
        const fresh = withCacheState(snapshot, "fresh");
        setCachedValue(cacheKey, fresh, 15 * 60_000);
        await setPersistentCache(cacheKey, fresh, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
        return fresh;
      }
    } catch {}
  }

  if (persisted?.value) {
    const stale = withCacheState(persisted.value, "stale");
    setCachedValue(cacheKey, stale, 15 * 60_000);
    return stale;
  }
  if (options?.allowSyntheticFallback === true) {
    const synthetic = buildQuoteSnapshot(symbol);
    setCachedValue(cacheKey, synthetic, 5 * 60_000);
    return synthetic;
  }
  setCachedValue(cacheKey, null, 60_000);
  return null;
}

async function getOpenbbNews(symbol: string): Promise<NewsItem[]> {
  const items = await fetchJson<
    Array<{
      id: string;
      title: string;
      source: string;
      published_at: string;
      url: string;
      summary: string;
      sentiment: NewsItem["sentiment"];
    }>
  >(`${process.env.OPENBB_SERVICE_URL}/news?symbol=${encodeURIComponent(symbol)}`);

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    publishedAt: item.published_at,
    url: item.url,
    summary: item.summary,
    sentiment: item.sentiment,
    symbols: [symbol]
  }));
}

async function getAkshareNews(symbol: string): Promise<NewsItem[]> {
  const serviceUrl = process.env.AKSHARE_SERVICE_URL;
  if (!serviceUrl) {
    return [];
  }

  const items = await fetchJson<
    Array<{
      id: string;
      title: string;
      source: string;
      published_at: string;
      url: string;
      summary: string;
      sentiment?: string;
    }>
  >(`${serviceUrl}/news?symbol=${encodeURIComponent(symbol)}`).catch(() => []);

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    source: item.source,
    publishedAt: item.published_at,
    url: item.url,
    summary: item.summary,
    sentiment: normalizeSentiment(item.sentiment),
    symbols: [symbol]
  }));
}

async function getNewsByProvider(provider: MarketDataProvider, symbol: string): Promise<NewsItem[]> {
  if (provider === "akshareBridge") {
    return getAkshareNews(symbol);
  }
  if (provider === "openbbBridge" && process.env.OPENBB_SERVICE_URL) {
    return getOpenbbNews(symbol);
  }
  if (provider === "alphaVantage" && process.env.ALPHA_VANTAGE_API_KEY) {
    return getAlphaVantageNews(symbol);
  }
  return [];
}

function getNewsProviderOrder(symbol: string, explicitMarket?: Market): MarketDataProvider[] {
  const market = explicitMarket ?? findInstrument(symbol)?.market;
  if (market === "CN") {
    return ["akshareBridge", "openbbBridge", "alphaVantage", "demo"];
  }
  if (market === "US" || market === "HK") {
    return ["alphaVantage", "openbbBridge", "demo"];
  }

  const globalProvider = getProviderConfig().provider;
  return globalProvider === "demo" ? ["alphaVantage", "openbbBridge", "demo"] : [globalProvider, "demo"];
}

export async function getNews(symbol?: string, market?: Market): Promise<NewsItem[]> {
  if (!symbol) {
    return getDemoNews(symbol);
  }

  const cacheKey = `news:${market ?? "auto"}:${symbol}`;
  const cached = getCachedValue<NewsItem[]>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const persisted = await getPersistentCache<NewsItem[]>(cacheKey);
  if (persisted?.state === "fresh") {
    setCachedValue(cacheKey, persisted.value, 30 * 60_000);
    return persisted.value;
  }

  const providerOrder = getNewsProviderOrder(symbol, market);
  for (const provider of providerOrder) {
    if (provider === "demo") {
      continue;
    }
    try {
      const items = await getNewsByProvider(provider, symbol);
      if (items.length) {
        setCachedValue(cacheKey, items, 30 * 60_000);
        await setPersistentCache(cacheKey, items, { ttlMs: 30 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
        return items;
      }
    } catch {}
  }
  if (persisted?.value?.length) {
    setCachedValue(cacheKey, persisted.value, 30 * 60_000);
    return persisted.value;
  }
  setCachedValue(cacheKey, [], 10 * 60_000);
  return [];
}

async function getAlphaVantageNews(symbol: string): Promise<NewsItem[]> {
  const payload = await fetchJson<{
    feed?: Array<{
      title?: string;
      source?: string;
      time_published?: string;
      url?: string;
      summary?: string;
      overall_sentiment_label?: string;
    }>;
  }>(
    `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(symbol)}&limit=10&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
  );

  return (payload.feed ?? []).map((item, index) => ({
    id: `${symbol}-av-${index}`,
    title: item.title ?? `${symbol} news`,
    source: item.source ?? "Alpha Vantage",
    publishedAt: item.time_published ?? new Date().toISOString(),
    url: item.url ?? "",
    summary: item.summary ?? "",
    sentiment: normalizeSentiment(item.overall_sentiment_label),
    symbols: [symbol]
  }));
}

export async function getMarketOverview(): Promise<MarketOverviewItem[]> {
  const cacheKey = "market-overview:eod:v2";
  const cached = getCachedValue<MarketOverviewItem[]>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }
  const persisted = await getPersistentCache<MarketOverviewItem[]>(cacheKey);
  if (persisted?.state === "fresh") {
    const fresh = withCacheStateList(persisted.value, "fresh");
    setCachedValue(cacheKey, fresh, 15 * 60_000);
    return fresh;
  }

  const targets = [
    { symbol: "IXIC", market: "US" as Market },
    { symbol: "GSPC", market: "US" as Market },
    { symbol: "HSI", market: "HK" as Market },
    { symbol: "HSTECH", market: "HK" as Market },
    { symbol: "000001.SH", market: "CN" as Market },
    { symbol: "399001.SZ", market: "CN" as Market }
  ];
  const items = await Promise.all(
    targets.map(async (target) => {
      const snapshot = await getQuote(target.symbol, target.market);
      if (!snapshot) {
        return {
          symbol: target.symbol,
          name: instruments.find((item) => item.symbol === target.symbol)?.name ?? target.symbol,
          market: target.market,
          price: null,
          changePct: null,
          breadth: "No Data",
          available: false,
          statusText: "暂无可校验盘后数据",
          dataSource: undefined,
          lastUpdated: undefined,
          dataLatency: undefined,
          unavailableReason: describeUnavailableData(target.symbol, target.market)
        };
      }
      const trendUp = snapshot.candles.length >= 60 ? snapshot.indicators.sma20 > snapshot.indicators.sma60 : (snapshot.changePct ?? 0) >= 0;
      return {
        symbol: target.symbol,
        name: instruments.find((item) => item.symbol === target.symbol)?.name ?? snapshot.name,
        market: target.market,
        price: snapshot.price,
        changePct: snapshot.changePct,
        breadth: trendUp ? "Trend Up" : "Trend Down",
        available: true,
        statusText: `${trendUp ? "偏多" : "偏空"} · ${formatDataRecency(snapshot)}`,
        dataSource: snapshot.dataSource,
        lastUpdated: snapshot.lastUpdated,
        dataLatency: snapshot.dataLatency,
        unavailableReason: undefined
      };
    })
  );
  const hasAvailable = items.some((item) => item.available);
  if (hasAvailable) {
    const fresh = withCacheStateList(items, "fresh");
    setCachedValue(cacheKey, fresh, 15 * 60_000);
    await setPersistentCache(cacheKey, fresh, { ttlMs: 15 * 60_000, staleMs: 7 * 24 * 60 * 60_000 });
    return fresh;
  }
  if (persisted?.value?.length) {
    const stale = withCacheStateList(persisted.value, "stale");
    setCachedValue(cacheKey, stale, 15 * 60_000);
    return stale;
  }
  setCachedValue(cacheKey, items, 15 * 60_000);
  return items;
}
