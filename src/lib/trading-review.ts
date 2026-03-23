import { derivePortfolioFromTrades } from "@/lib/analytics";
import { instruments } from "@/lib/instruments";
import { getHistoricalCandles } from "@/lib/market-data";
import {
  CashFlowItem,
  Candle,
  Market,
  MarketReviewBreakdown,
  PeriodReturnRow,
  ReviewInsight,
  TradeLogItem,
  TradingReview,
  TradingStyleProfile
} from "@/lib/types";

type DailyPoint = {
  date: string;
  equityValue: number;
  holdingsValue: number;
  cashValue: number;
};

type Lot = {
  quantity: number;
  price: number;
  tradeDate: string;
};

function inferUnderlyingSymbol(symbol: string, market: Market) {
  const normalized = symbol.trim().toUpperCase();
  const exact = instruments.find((item) => item.symbol.toUpperCase() === normalized);
  if (exact?.assetClass !== "option") {
    return {
      underlyingSymbol: normalized,
      assetClass: exact?.assetClass ?? "stock"
    };
  }

  const directOption = normalized.match(/^([A-Z]+)\d{6}[CP]\d+$/);
  if (directOption) {
    return {
      underlyingSymbol: directOption[1],
      assetClass: "option"
    };
  }

  const hkOption = normalized.match(/^HK\.([A-Z]+)\d{6}[CP]\d+$/);
  if (hkOption) {
    return {
      underlyingSymbol: `${hkOption[1]}`,
      assetClass: "option"
    };
  }

  return {
    underlyingSymbol: normalized,
    assetClass: exact?.assetClass ?? (/[CP]\d+$/.test(normalized) ? "option" : "stock")
  };
}

function getExposureKey(trade: TradeLogItem) {
  const { underlyingSymbol, assetClass } = inferUnderlyingSymbol(trade.symbol, trade.market);
  return {
    exposureKey: `${trade.market}:${underlyingSymbol}`,
    assetClass
  };
}

function normalizeTradeForAnalytics(trade: TradeLogItem): TradeLogItem {
  const symbol = trade.symbol.trim().toUpperCase();
  if (symbol.startsWith("HK.")) {
    const base = symbol.slice(3);
    return {
      ...trade,
      market: "HK",
      symbol: /^\d+$/.test(base) ? `${base.padStart(4, "0")}.HK` : symbol
    };
  }
  if (symbol.startsWith("SH.") || symbol.startsWith("SZ.")) {
    const exchange = symbol.slice(0, 2);
    const base = symbol.slice(3);
    return {
      ...trade,
      market: "CN",
      symbol: `${base}.${exchange}`
    };
  }
  if (symbol.endsWith(".HK")) {
    return { ...trade, market: "HK", symbol };
  }
  if (symbol.endsWith(".SH") || symbol.endsWith(".SZ")) {
    return { ...trade, market: "CN", symbol };
  }
  if (symbol.startsWith("US.")) {
    return { ...trade, market: "US", symbol: symbol.slice(3) };
  }
  return { ...trade, symbol };
}

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function daysBetween(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00Z`).getTime();
  const endTime = new Date(`${end}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((endTime - startTime) / 86_400_000));
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function yearKey(date: string) {
  return date.slice(0, 4);
}

function buildPeriodRows(points: DailyPoint[], trades: TradeLogItem[], keyFn: (date: string) => string): PeriodReturnRow[] {
  const grouped = new Map<
    string,
    {
      points: DailyPoint[];
      trades: number;
    }
  >();

  for (const point of points) {
    const key = keyFn(point.date);
    const bucket = grouped.get(key) ?? { points: [], trades: 0 };
    bucket.points.push(point);
    grouped.set(key, bucket);
  }

  for (const trade of trades) {
    const key = keyFn(trade.tradeDate);
    const bucket = grouped.get(key) ?? { points: [], trades: 0 };
    bucket.trades += 1;
    grouped.set(key, bucket);
  }

  const orderedKeys = [...grouped.keys()].sort().reverse();
  return orderedKeys
    .map((key) => {
      const bucket = grouped.get(key);
      if (!bucket || bucket.points.length === 0) {
        return null;
      }
      const first = bucket.points[0];
      const last = bucket.points[bucket.points.length - 1];
      const startingEquity = first.equityValue;
      const endingEquity = last.equityValue;
      const pnl = endingEquity - startingEquity;
      const returnPct = startingEquity > 0 ? (pnl / startingEquity) * 100 : 0;

      return {
        period: key,
        pnl: round(pnl),
        returnPct: round(returnPct),
        trades: bucket.trades,
        startingValue: round(startingEquity),
        endingValue: round(endingEquity)
      };
    })
    .filter((item): item is PeriodReturnRow => Boolean(item));
}

async function loadCandlesBySymbol(trades: TradeLogItem[]) {
  const unique = Array.from(new Map(trades.map((trade) => [`${trade.market}:${trade.symbol}`, trade] as const)).values());
  const entries = await Promise.all(
    unique.map(async (trade) => {
      const candles = await getHistoricalCandles(trade.symbol, trade.market, { longRange: true, startDate: "2020-01-01" });
      return [`${trade.market}:${trade.symbol}`, candles] as const;
    })
  );
  return new Map(entries);
}

function getLatestCloseOnOrBefore(candles: Candle[], date: string) {
  let latest = 0;
  for (const candle of candles) {
    if (candle.date > date) {
      break;
    }
    latest = candle.close;
  }
  return latest;
}

function buildMarketBreakdown(
  market: Market,
  trades: TradeLogItem[],
  candlesBySymbol: Map<string, Candle[]>
): MarketReviewBreakdown {
  if (!trades.length) {
    return {
      market,
      label: market === "US" ? "美股" : market === "HK" ? "港股" : "A股",
      tradeCount: 0,
      turnover: 0,
      realizedPnl: 0,
      unrealizedPnl: 0,
      endingPnl: 0,
      totalReturnPct: 0,
      winRatePct: 0,
      monthlyReturns: [],
      yearlyReturns: []
    };
  }

  const sortedTrades = [...trades].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate));
  const positions = new Map<string, { quantity: number; totalCost: number }>();
  const lots = new Map<string, Lot[]>();
  let cash = 0;
  let realizedPnl = 0;
  let closedTrades = 0;
  let wins = 0;
  let turnover = 0;

  const dateSet = new Set<string>(sortedTrades.map((item) => item.tradeDate));
  for (const trade of sortedTrades) {
    const candles = candlesBySymbol.get(`${trade.market}:${trade.symbol}`) ?? [];
    for (const candle of candles) {
      if (candle.date >= sortedTrades[0].tradeDate) {
        dateSet.add(candle.date);
      }
    }
  }

  const orderedDates = [...dateSet].sort();
  const tradesByDate = new Map<string, TradeLogItem[]>();
  for (const trade of sortedTrades) {
    const bucket = tradesByDate.get(trade.tradeDate) ?? [];
    bucket.push(trade);
    tradesByDate.set(trade.tradeDate, bucket);
  }

  const dailyPoints: DailyPoint[] = [];
  let minCash = 0;

  for (const date of orderedDates) {
    const tradesForDate = tradesByDate.get(date) ?? [];
    for (const trade of tradesForDate) {
      const key = trade.symbol;
      const current = positions.get(key) ?? { quantity: 0, totalCost: 0 };
      const lotBook = lots.get(key) ?? [];
      turnover += trade.quantity * trade.price + (trade.fee ?? 0);

      if (trade.side === "BUY") {
        current.quantity += trade.quantity;
        current.totalCost += trade.quantity * trade.price;
        cash -= trade.quantity * trade.price + (trade.fee ?? 0);
        lotBook.push({ quantity: trade.quantity, price: trade.price, tradeDate: trade.tradeDate });
        positions.set(key, current);
        lots.set(key, lotBook);
        continue;
      }

      let remaining = trade.quantity;
      while (remaining > 0.000001 && lotBook.length) {
        const head = lotBook[0];
        const matched = Math.min(remaining, head.quantity);
        const pnl = matched * (trade.price - head.price);
        realizedPnl += pnl;
        closedTrades += 1;
        if (pnl > 0) {
          wins += 1;
        }
        head.quantity -= matched;
        remaining -= matched;
        current.quantity -= matched;
        current.totalCost -= matched * head.price;
        if (head.quantity <= 0.000001) {
          lotBook.shift();
        }
      }

      cash += trade.quantity * trade.price - (trade.fee ?? 0);
      if (current.quantity <= 0.000001) {
        positions.delete(key);
        lots.delete(key);
      } else {
        positions.set(key, current);
        lots.set(key, lotBook);
      }
    }

    minCash = Math.min(minCash, cash);

    const holdingsValue = Array.from(positions.entries()).reduce((sum, [symbol, position]) => {
      const candles = candlesBySymbol.get(`${market}:${symbol}`) ?? [];
      const close = getLatestCloseOnOrBefore(candles, date);
      if (!close) {
        return sum;
      }
      return sum + position.quantity * close;
    }, 0);

    dailyPoints.push({
      date,
      equityValue: 0,
      holdingsValue: round(holdingsValue),
      cashValue: round(cash)
    });
  }

  const startingCapital = Math.max(0, round(-minCash));
  const normalizedDailyPoints = dailyPoints.map((point) => ({
    ...point,
    equityValue: round(startingCapital + point.cashValue + point.holdingsValue)
  }));

  const unrealizedPnl = Array.from(positions.entries()).reduce((sum, [symbol, position]) => {
    const candles = candlesBySymbol.get(`${market}:${symbol}`) ?? [];
    const lastClose = candles.at(-1)?.close ?? 0;
    const avgCost = position.quantity > 0 ? position.totalCost / position.quantity : 0;
    return sum + position.quantity * (lastClose - avgCost);
  }, 0);

  const endingEquity = normalizedDailyPoints.at(-1)?.equityValue ?? startingCapital;
  const startingEquity = normalizedDailyPoints[0]?.equityValue ?? startingCapital;
  const endingPnl = round(realizedPnl + unrealizedPnl);

  return {
    market,
    label: market === "US" ? "美股" : market === "HK" ? "港股" : "A股",
    tradeCount: trades.length,
    turnover: round(turnover),
    realizedPnl: round(realizedPnl),
    unrealizedPnl: round(unrealizedPnl),
    endingPnl: round(endingPnl),
    totalReturnPct: startingEquity > 0 ? round(((endingEquity - startingEquity) / startingEquity) * 100) : 0,
    winRatePct: closedTrades > 0 ? round((wins / closedTrades) * 100) : 0,
    monthlyReturns: buildPeriodRows(normalizedDailyPoints, sortedTrades, monthKey).slice(0, 12),
    yearlyReturns: buildPeriodRows(normalizedDailyPoints, sortedTrades, yearKey)
  };
}

function buildStyleProfile(trades: TradeLogItem[]): TradingStyleProfile {
  if (!trades.length) {
    return {
      styleLabel: "暂无交易记录",
      avgHoldingDays: 0,
      rapidTradePct: 0,
      concentrationPct: 0,
      preferredMarkets: [],
      strengths: [],
      weaknesses: []
    };
  }

  const lots = new Map<string, Lot[]>();
  const holdingDays: number[] = [];
  const symbolTurnover = new Map<string, number>();
  const marketTrades = new Map<Market, number>();
  const stockExposureOpen = new Map<string, number>();

  for (const trade of [...trades].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate))) {
    const { exposureKey, assetClass } = getExposureKey(trade);
    symbolTurnover.set(exposureKey, (symbolTurnover.get(exposureKey) ?? 0) + trade.quantity * trade.price);
    marketTrades.set(trade.market, (marketTrades.get(trade.market) ?? 0) + 1);

    if (assetClass === "option") {
      continue;
    }

    const lotBook = lots.get(exposureKey) ?? [];
    if (trade.side === "BUY") {
      lotBook.push({ quantity: trade.quantity, price: trade.price, tradeDate: trade.tradeDate });
      lots.set(exposureKey, lotBook);
      if (assetClass !== "option") {
        stockExposureOpen.set(exposureKey, (stockExposureOpen.get(exposureKey) ?? 0) + trade.quantity);
      }
      continue;
    }

    let remaining = trade.quantity;
    while (remaining > 0.000001 && lotBook.length) {
      const head = lotBook[0];
      const matched = Math.min(remaining, head.quantity);
      const shouldCountHolding =
        assetClass !== "option" || (stockExposureOpen.get(exposureKey) ?? 0) <= 0;
      if (shouldCountHolding) {
        holdingDays.push(daysBetween(head.tradeDate, trade.tradeDate));
      }
      head.quantity -= matched;
      remaining -= matched;
      if (head.quantity <= 0.000001) {
        lotBook.shift();
      }
    }
    lots.set(exposureKey, lotBook);
    stockExposureOpen.set(exposureKey, Math.max(0, (stockExposureOpen.get(exposureKey) ?? 0) - trade.quantity));
  }

  const avgHoldingDays = round(average(holdingDays), 1);
  const rapidTradePct = holdingDays.length ? round((holdingDays.filter((item) => item <= 5).length / holdingDays.length) * 100) : 0;
  const totalTurnover = [...symbolTurnover.values()].reduce((sum, value) => sum + value, 0);
  const concentrationPct = totalTurnover
    ? round((Math.max(...symbolTurnover.values()) / totalTurnover) * 100)
    : 0;
  const preferredMarkets = [...marketTrades.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([market]) => market);

  let styleLabel = "波段 / 趋势混合";
  if (avgHoldingDays > 0 && avgHoldingDays <= 3) {
    styleLabel = "超短线";
  } else if (avgHoldingDays > 3 && avgHoldingDays <= 20) {
    styleLabel = "波段交易";
  } else if (avgHoldingDays > 20) {
    styleLabel = "中线持有";
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (avgHoldingDays >= 5 && avgHoldingDays <= 45) {
    strengths.push(`平均持有 ${avgHoldingDays} 天，执行节奏更接近有计划的波段而不是纯冲动交易。`);
  }
  if (rapidTradePct <= 25) {
    strengths.push(`短平快交易占比 ${rapidTradePct}% ，过度追涨杀跌的倾向不算重。`);
  }
  if (concentrationPct <= 40) {
    strengths.push(`单一标的成交集中度 ${concentrationPct}% ，整体没有明显押注过重。`);
  }

  if (rapidTradePct >= 45) {
    weaknesses.push(`短线交易占比 ${rapidTradePct}% ，容易把收益波动放大成执行噪音。`);
  }
  if (concentrationPct >= 55) {
    weaknesses.push(`单一标的成交集中度达到 ${concentrationPct}% ，一旦判断失误会明显拖累整体结果。`);
  }
  if (avgHoldingDays > 60) {
    weaknesses.push(`平均持有 ${avgHoldingDays} 天，复盘时要确认是否存在止盈止损偏慢的问题。`);
  }

  if (!strengths.length) {
    strengths.push("当前交易样本还不算多，先继续积累样本再判断稳定优势。");
  }
  if (!weaknesses.length) {
    weaknesses.push("当前没有特别突出的结构性短板，但仍建议持续跟踪回撤和集中度。");
  }

  return {
    styleLabel,
    avgHoldingDays,
    rapidTradePct,
    concentrationPct,
    preferredMarkets,
    strengths,
    weaknesses
  };
}

export async function buildTradingReviewDetailed(
  trades: TradeLogItem[],
  cashFlows: CashFlowItem[] = []
): Promise<TradingReview> {
  const normalizedTrades = trades.map(normalizeTradeForAnalytics);
  const derivation = derivePortfolioFromTrades(normalizedTrades, cashFlows);
  const buys = normalizedTrades.filter((item) => item.side === "BUY").length;
  const sells = normalizedTrades.filter((item) => item.side === "SELL").length;
  const topSymbols = Array.from(
    normalizedTrades.reduce((map, trade) => {
      map.set(trade.symbol, (map.get(trade.symbol) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([symbol, count]) => ({ symbol, trades: count }))
    .sort((left, right) => right.trades - left.trades)
    .slice(0, 5);

  const candlesBySymbol = await loadCandlesBySymbol(normalizedTrades);
  const marketBreakdown = (["US", "HK", "CN"] as Market[])
    .map((market) => buildMarketBreakdown(market, normalizedTrades.filter((item) => item.market === market), candlesBySymbol))
    .filter((item) => item.tradeCount > 0);
  const styleProfile = buildStyleProfile(normalizedTrades);

  const insights: ReviewInsight[] = [];
  if (derivation.winRatePct >= 55) {
    insights.push({
      title: "胜率保持正向",
      detail: `已平仓交易胜率为 ${derivation.winRatePct}% ，当前执行纪律尚可。`,
      tone: "positive" as const
    });
  } else {
    insights.push({
      title: "胜率仍需改善",
      detail: `已平仓交易胜率为 ${derivation.winRatePct}% ，需要复盘入场条件与止盈止损设计。`,
      tone: "negative" as const
    });
  }

  if (marketBreakdown.length) {
    const strongest = [...marketBreakdown].sort((left, right) => right.totalReturnPct - left.totalReturnPct)[0];
    const weakest = [...marketBreakdown].sort((left, right) => left.totalReturnPct - right.totalReturnPct)[0];
    insights.push({
      title: "市场偏好已显现",
      detail: `${strongest.label}累计回报 ${strongest.totalReturnPct.toFixed(2)}% 相对更强；${weakest.label}当前更需要复盘仓位与节奏。`,
      tone: strongest.market === weakest.market ? "neutral" : "neutral"
    });
  }

  if (styleProfile.rapidTradePct >= 45) {
    insights.push({
      title: "交易节奏偏快",
      detail: `短线交易占比 ${styleProfile.rapidTradePct}% ，需要确认是否存在高频试错、低质量出手的问题。`,
      tone: "negative" as const
    });
  } else {
    insights.push({
      title: "交易节奏相对克制",
      detail: `短线交易占比 ${styleProfile.rapidTradePct}% ，当前节奏更接近有计划的持有与轮动。`,
      tone: "positive" as const
    });
  }

  const from = normalizedTrades.length ? [...normalizedTrades].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))[0]?.tradeDate : undefined;
  const to = normalizedTrades.length ? [...normalizedTrades].sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))[0]?.tradeDate : undefined;

  return {
    periodLabel: from && to ? `${from} 至 ${to}` : "No trades",
    summary: `共记录 ${normalizedTrades.length} 笔交易，买入 ${buys} 笔，卖出 ${sells} 笔；已实现盈亏 ${derivation.realizedPnl.toFixed(
      2
    )}，胜率 ${derivation.winRatePct.toFixed(2)}%，当前更适合重点看 ${marketBreakdown.map((item) => item.label).join(" / ") || "各市场"} 的分市场收益曲线。`,
    totalTrades: normalizedTrades.length,
    buys,
    sells,
    turnover: derivation.turnover,
    realizedPnl: derivation.realizedPnl,
    winRatePct: derivation.winRatePct,
    topSymbols,
    insights,
    marketBreakdown,
    styleProfile,
    historyRange: from && to ? { from, to } : undefined
  };
}
