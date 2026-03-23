export type MarketDataProvider =
  | "demo"
  | "finnhub"
  | "twelveData"
  | "eodhd"
  | "akshareBridge"
  | "openbbBridge"
  | "alphaVantage"
  | "sina";

export interface ProviderConfig {
  provider: MarketDataProvider;
  description: string;
  supports: string[];
}

export interface MarketProviderRouting {
  US: MarketDataProvider[];
  HK: MarketDataProvider[];
  CN: MarketDataProvider[];
}

export function getProviderConfig(): ProviderConfig {
  const provider = (process.env.MARKET_DATA_PROVIDER ?? "twelveData") as MarketDataProvider;

  switch (provider) {
    case "finnhub":
      return {
        provider,
        description: "US/HK first, suitable for equities, ETFs, indices, and news.",
        supports: ["US equities", "HK equities", "ETF", "index", "news"]
      };
    case "twelveData":
      return {
        provider,
        description: "Daily-first provider for free US post-close quotes and historical series.",
        supports: ["US equities", "US ETF", "US daily candles", "limited global coverage"]
      };
    case "eodhd":
      return {
        provider,
        description: "Broad global coverage, better for multi-asset expansion.",
        supports: ["US", "HK", "CN partial", "funds", "bonds", "indices"]
      };
    case "akshareBridge":
      return {
        provider,
        description: "Self-hosted Python microservice recommended for CN/HK post-close data, funds, futures, and local datasets.",
        supports: ["CN equities", "HK delayed quotes", "funds", "futures", "macro", "alt data"]
      };
    case "openbbBridge":
      return {
        provider,
        description: "Python OpenBB microservice for research-grade quotes, candles, news, and cross-market enrichment.",
        supports: ["US", "HK", "CN partial", "news", "historical", "research workflows"]
      };
    case "alphaVantage":
      return {
        provider,
        description: "Alpha Vantage backup provider for quote, symbol search, news sentiment, and historical series.",
        supports: ["US primary", "global partial", "search", "news", "daily history"]
      };
    case "sina":
      return {
        provider,
        description: "Free Sina public quote endpoint for cross-market snapshots and index values.",
        supports: ["US quote snapshots", "HK quotes", "CN quotes", "indices"]
      };
    default:
      return {
        provider: "demo",
        description: "Local deterministic demo provider for UI development only.",
        supports: ["mocked assets only"]
      };
  }
}

export function getDefaultMarketRouting(): MarketProviderRouting {
  return {
    US: ["twelveData", "alphaVantage", "openbbBridge", "finnhub", "eodhd", "sina", "demo"],
    HK: ["sina", "akshareBridge", "openbbBridge", "alphaVantage", "finnhub", "eodhd", "demo"],
    CN: ["sina", "akshareBridge", "openbbBridge", "alphaVantage", "eodhd", "demo"]
  };
}
