import { NewsItem } from "@/lib/types";

function seededSummary(symbol: string) {
  return `Focus stays on liquidity, earnings revisions, and policy sensitivity around ${symbol}; validate narrative with primary filings and volume structure before execution.`;
}

export function getDemoNews(symbol?: string): NewsItem[] {
  const baseSymbols = symbol ? [symbol] : ["AAPL", "0700.HK", "600519.SH"];
  return baseSymbols.map((item, index) => ({
    id: `${item}-${index}`,
    title: `${item} sees renewed attention as cross-market rotation accelerates`,
    source: index % 2 === 0 ? "Market Wire" : "Global Desk",
    publishedAt: new Date(Date.now() - index * 3_600_000).toISOString(),
    url: "https://example.com/demo-news",
    sentiment: index % 3 === 0 ? "positive" : index % 3 === 1 ? "neutral" : "negative",
    symbols: [item],
    summary: seededSummary(item)
  }));
}
