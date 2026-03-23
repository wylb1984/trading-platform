import { searchInstruments } from "@/lib/analytics";
import { instruments } from "@/lib/instruments";
import { getDefaultMarketRouting, getProviderConfig, MarketDataProvider } from "@/lib/providers";
import { Market, SearchResultItem } from "@/lib/types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function searchOpenbb(query: string): Promise<SearchResultItem[]> {
  const serviceUrl = process.env.OPENBB_SERVICE_URL;
  if (!serviceUrl) {
    return [];
  }

  const items = await fetchJson<SearchResultItem[]>(`${serviceUrl}/search?query=${encodeURIComponent(query)}`).catch(() => []);
  return items;
}

async function searchAlphaVantage(query: string): Promise<SearchResultItem[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    return [];
  }

  const payload = await fetchJson<{
    bestMatches?: Array<{
      "1. symbol"?: string;
      "2. name"?: string;
      "3. type"?: string;
      "4. region"?: string;
      "8. currency"?: string;
      "9. matchScore"?: string;
    }>;
  }>(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${apiKey}`).catch(
    () => ({ bestMatches: [] })
  );

  return (payload.bestMatches ?? []).slice(0, 10).map((item) => ({
    symbol: (item["1. symbol"] ?? "").replace(/\.SHH$/i, ".SH").replace(/\.SZZ$/i, ".SZ"),
    name: item["2. name"] ?? "",
    market:
      item["4. region"] === "United States"
        ? "US"
        : item["4. region"]?.includes("Hong Kong")
          ? "HK"
          : item["4. region"]?.includes("China") || item["4. region"]?.includes("Shanghai") || item["4. region"]?.includes("Shenzhen")
            ? "CN"
            : item["4. region"] ?? "",
    assetClass: item["3. type"] ?? "stock",
    exchange: item["8. currency"] ?? ""
  }));
}

async function searchAkshare(query: string): Promise<SearchResultItem[]> {
  const serviceUrl = process.env.AKSHARE_SERVICE_URL;
  if (!serviceUrl) {
    return [];
  }

  return fetchJson<SearchResultItem[]>(`${serviceUrl}/search?query=${encodeURIComponent(query)}`).catch(() => []);
}

function mergeResults(groups: SearchResultItem[][]) {
  const merged: SearchResultItem[] = [];
  for (const group of groups) {
    for (const item of group) {
      if (!item.symbol) {
        continue;
      }
      if (!["US", "HK", "CN"].includes(String(item.market))) {
        continue;
      }
      if (!merged.some((existing) => existing.symbol.toUpperCase() === item.symbol.toUpperCase())) {
        const local = instruments.find((instrument) => instrument.symbol.toUpperCase() === item.symbol.toUpperCase());
        merged.push(item);
        if (local) {
          merged[merged.length - 1] = {
            ...item,
            name: local.name,
            market: local.market,
            assetClass: item.assetClass ?? local.assetClass,
            exchange: item.exchange ?? local.exchange
          };
        }
      }
    }
  }
  return merged;
}

function inferMarketFromQuery(query: string): Market | undefined {
  const upper = query.toUpperCase();
  if (/^\d{4,5}\.HK$/.test(upper) || /^\d{3,5}HK$/.test(upper)) {
    return "HK";
  }
  if (/^\d{6}\.(SH|SZ)$/.test(upper)) {
    return "CN";
  }
  if (/^[A-Z]{1,5}$/.test(upper)) {
    return "US";
  }
  return undefined;
}

function getSearchProviderOrder(market?: Market): MarketDataProvider[] {
  if (!market) {
    return ["twelveData", "akshareBridge", "openbbBridge", "alphaVantage"];
  }
  const routing = getDefaultMarketRouting();
  return routing[market];
}

async function searchRemoteByProvider(provider: MarketDataProvider, query: string): Promise<SearchResultItem[]> {
  if (provider === "twelveData") {
    return [];
  }
  if (provider === "alphaVantage" && process.env.ALPHA_VANTAGE_API_KEY) {
    return searchAlphaVantage(query);
  }
  if (provider === "openbbBridge") {
    return searchOpenbb(query);
  }
  if (provider === "akshareBridge") {
    return searchAkshare(query);
  }
  return [];
}

export async function searchAssets(query: string): Promise<SearchResultItem[]> {
  const local: SearchResultItem[] = searchInstruments(query).map((item) => ({
    symbol: item.symbol,
    name: item.name,
    market: item.market,
    assetClass: item.assetClass,
    exchange: item.exchange
  }));

  const market = inferMarketFromQuery(query);
  const globalProvider = getProviderConfig().provider;
  const remotes: SearchResultItem[][] = [];
  const providerOrder = getSearchProviderOrder(market);

  if (globalProvider !== "demo" && !providerOrder.includes(globalProvider)) {
    remotes.push(await searchRemoteByProvider(globalProvider, query));
  }

  for (const provider of providerOrder) {
    if (provider === "demo") {
      continue;
    }
    remotes.push(await searchRemoteByProvider(provider, query));
  }

  return mergeResults([local, ...remotes]);
}
