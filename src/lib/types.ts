export type Market = "US" | "HK" | "CN";

export type AssetClass =
  | "stock"
  | "etf"
  | "index"
  | "reit"
  | "bond"
  | "fund"
  | "future"
  | "option"
  | "forex"
  | "commodity"
  | "crypto";

export type QuoteInterval = "1D" | "1W" | "1M" | "3M" | "1Y";

export interface Instrument {
  symbol: string;
  name: string;
  market: Market;
  assetClass: AssetClass;
  currency: string;
  exchange: string;
  sector: string;
  tags: string[];
}

export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteSnapshot extends Instrument {
  price: number;
  change: number;
  changePct: number;
  volume: number;
  turnover: number;
  dataSource?: string;
  lastUpdated?: string;
  dataLatency?: "eod" | "delayed" | "realtime";
  cacheState?: "fresh" | "stale";
  pe?: number;
  pb?: number;
  dividendYield?: number;
  marketCap?: number;
  indicators: {
    sma20: number;
    sma60: number;
    rsi14: number;
    volatility30d: number;
  };
  candles: Candle[];
}

export interface ScreenerFilters {
  markets?: Market[];
  assetClasses?: AssetClass[];
  sectors?: string[];
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  maxPe?: number;
  minDividendYield?: number;
  tags?: string[];
}

export interface PortfolioHolding {
  symbol: string;
  market: Market;
  quantity: number;
  averageCost: number;
}

export interface PortfolioSummary {
  holdings: Array<PortfolioHolding & {
    lastPrice: number;
    marketValue: number;
    pnl: number;
    pnlPct: number;
  }>;
  totalCost: number;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  allocation: Array<{
    label: string;
    value: number;
  }>;
}

export interface BacktestRequest {
  symbol: string;
  market: Market;
  fastWindow: number;
  slowWindow: number;
  initialCapital: number;
}

export interface BacktestResult {
  symbol: string;
  market: Market;
  totalReturnPct: number;
  annualizedReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  trades: number;
  equityCurve: Array<{
    date: string;
    equity: number;
  }>;
  signals: Array<{
    date: string;
    action: "BUY" | "SELL";
    price: number;
  }>;
}

export interface AiBriefRequest {
  symbol: string;
  market: Market;
  stance: "bullish" | "neutral" | "bearish";
}

export interface AiBrief {
  summary: string;
  catalysts: string[];
  risks: string[];
  actionPlan: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: "positive" | "neutral" | "negative";
  symbols: string[];
  summary: string;
}

export interface MarketOverviewItem {
  symbol: string;
  name: string;
  market: Market;
  price: number | null;
  changePct: number | null;
  breadth: string;
  available: boolean;
  statusText?: string;
  dataSource?: string;
  lastUpdated?: string;
  dataLatency?: "eod" | "delayed" | "realtime";
  unavailableReason?: string;
  cacheState?: "fresh" | "stale";
}

export interface AppSettings {
  marketDataProvider: string;
  aiProvider: string;
  defaultMarkets: Market[];
  riskProfile: "conservative" | "balanced" | "aggressive";
  notificationConfig: OpenClawNotificationSettings;
}

export interface OpenClawNotificationSettings {
  enabled: boolean;
  channel: string;
  target: string;
  account?: string;
  minConfidence: number;
  displayName?: string;
  connectedAt?: string;
}

export interface WatchlistItem {
  symbol: string;
  market: Market;
  note?: string;
  createdAt: string;
}

export interface TradeLogItem {
  id: string;
  symbol: string;
  market: Market;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fee?: number;
  tradeDate: string;
  note?: string;
}

export interface CashFlowItem {
  id: string;
  amount: number;
  flowDate: string;
  type: "DEPOSIT" | "WITHDRAWAL";
  note?: string;
}

export interface PortfolioDerivation {
  holdings: PortfolioHolding[];
  realizedPnl: number;
  turnover: number;
  tradeCount: number;
  winRatePct: number;
  cashBalance: number;
  equityValue: number;
  totalAccountValue: number;
  maxDrawdownPct: number;
  equityCurve: Array<{
    date: string;
    cash: number;
    holdingsValue: number;
    totalValue: number;
  }>;
}

export interface ReviewInsight {
  title: string;
  detail: string;
  tone: "positive" | "neutral" | "negative";
}

export interface PeriodReturnRow {
  period: string;
  pnl: number;
  returnPct: number;
  trades: number;
  startingValue: number;
  endingValue: number;
}

export interface MarketReviewBreakdown {
  market: Market;
  label: string;
  tradeCount: number;
  turnover: number;
  realizedPnl: number;
  unrealizedPnl: number;
  endingPnl: number;
  totalReturnPct: number;
  winRatePct: number;
  monthlyReturns: PeriodReturnRow[];
  yearlyReturns: PeriodReturnRow[];
}

export interface TradingStyleProfile {
  styleLabel: string;
  avgHoldingDays: number;
  rapidTradePct: number;
  concentrationPct: number;
  preferredMarkets: Market[];
  strengths: string[];
  weaknesses: string[];
}

export interface TradingReview {
  periodLabel: string;
  summary: string;
  totalTrades: number;
  buys: number;
  sells: number;
  turnover: number;
  realizedPnl: number;
  winRatePct: number;
  topSymbols: Array<{
    symbol: string;
    trades: number;
  }>;
  insights: ReviewInsight[];
  marketBreakdown: MarketReviewBreakdown[];
  styleProfile: TradingStyleProfile;
  historyRange?: {
    from: string;
    to: string;
  };
}

export interface AccountPerformance {
  startingCapital: number;
  endingEquity: number;
  netFlow: number;
  totalReturnPct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  maxDrawdownPct: number;
  sharpeLike: number;
  equityCurve: Array<{
    date: string;
    totalValue: number;
    netDeposits: number;
  }>;
}

export interface WatchlistSignalItem {
  symbol: string;
  market: Market;
  name: string;
  price: number | null;
  changePct: number | null;
  signal: "BUY" | "HOLD" | "SELL" | "WATCH";
  confidence: number | null;
  reason: string;
  available: boolean;
  fundamentalTone?: "supportive" | "neutral" | "cautious";
  fundamentalNote?: string | null;
  reflexivityTone?: "reinforcing" | "turning-bearish" | "neutral";
  reflexivityNote?: string | null;
  dataSource?: string;
  lastUpdated?: string;
  dataLatency?: "eod" | "delayed" | "realtime";
  unavailableReason?: string;
  cacheState?: "fresh" | "stale";
}

export interface WatchlistInsight {
  summary: string;
  opportunities: string[];
  risks: string[];
}

export interface SymbolAnalysis {
  quote: QuoteSnapshot;
  signal: WatchlistSignalItem;
  brief: AiBrief;
  news: NewsItem[];
  fundamentalContext: {
    stance: "supportive" | "neutral" | "cautious";
    valuation: string;
    incomeProfile: string;
    highlights: string[];
    alerts: string[];
  };
  marketContext: {
    trend: "bullish" | "neutral" | "bearish";
    momentum: "strong" | "neutral" | "weak";
    sentiment: "hot" | "neutral" | "cold";
    chanState: string;
  };
  reflexivityContext: {
    stance: "reinforcing" | "turning-bearish" | "neutral";
    summary: string;
    drivers: string[];
    risks: string[];
  };
  opportunities: string[];
  risks: string[];
  importantLevels: {
    support: number;
    resistance: number;
  };
}

export interface SearchResultItem {
  symbol: string;
  name: string;
  market: Market | string;
  assetClass?: AssetClass | string;
  exchange?: string;
}
