import {
  AccountPerformance,
  AiBrief,
  AiBriefRequest,
  BacktestRequest,
  BacktestResult,
  Candle,
  PortfolioDerivation,
  PortfolioHolding,
  PortfolioSummary,
  QuoteSnapshot,
  ScreenerFilters
} from "@/lib/types";
import { CashFlowItem, TradeLogItem, TradingReview, WatchlistInsight, WatchlistSignalItem } from "@/lib/types";
import { instruments } from "@/lib/instruments";

function seededNumber(seed: string, min: number, max: number) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 100000;
  }
  const normalized = (Math.sin(hash) + 1) / 2;
  return min + normalized * (max - min);
}

export function generateCandles(symbol: string, points = 180): Candle[] {
  const base = seededNumber(symbol, 18, 360);
  const candles: Candle[] = [];
  let previousClose = base;

  for (let index = points - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);

    const drift = Math.sin(index / 11) * 0.008;
    const shock = Math.cos(index / 5 + base) * 0.015;
    const open = previousClose * (1 + drift / 2);
    const close = Math.max(1, open * (1 + drift + shock));
    const high = Math.max(open, close) * 1.01;
    const low = Math.min(open, close) * 0.99;
    const volume = Math.round(seededNumber(`${symbol}-${index}`, 900000, 35000000));

    candles.push({
      date: date.toISOString().slice(0, 10),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume
    });

    previousClose = close;
  }

  return candles;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sma(values: number[], window: number) {
  const slice = values.slice(-window);
  return Number(average(slice).toFixed(2));
}

function rsi(values: number[], window = 14) {
  const changes = values.slice(-window - 1).map((value, index, array) => {
    if (index === 0) {
      return 0;
    }
    return value - array[index - 1];
  });

  const gains = changes.filter((change) => change > 0);
  const losses = changes.filter((change) => change < 0).map((change) => Math.abs(change));
  const avgGain = gains.length ? average(gains) : 0.01;
  const avgLoss = losses.length ? average(losses) : 0.01;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

function volatility(values: number[], window = 30) {
  const returns = values.slice(-window - 1).map((value, index, array) => {
    if (index === 0) {
      return 0;
    }
    return (value - array[index - 1]) / array[index - 1];
  });
  const mean = average(returns);
  const variance = average(returns.map((value) => (value - mean) ** 2));
  return Number((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
}

export function computeIndicatorsFromCandles(candles: Candle[]) {
  const closes = candles.map((item) => item.close);
  return {
    sma20: sma(closes, Math.min(20, closes.length)),
    sma60: sma(closes, Math.min(60, closes.length)),
    rsi14: rsi(closes, Math.min(14, Math.max(2, closes.length - 1))),
    volatility30d: volatility(closes, Math.min(30, Math.max(2, closes.length - 1)))
  };
}

export function buildSnapshotFromCandles(symbol: string, candles: Candle[]): QuoteSnapshot | null {
  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument || candles.length < 2) {
    return null;
  }

  const last = candles.at(-1);
  const previous = candles.at(-2);
  if (!last || !previous) {
    return null;
  }

  const change = Number((last.close - previous.close).toFixed(2));
  const changePct = previous.close === 0 ? 0 : Number((((last.close - previous.close) / previous.close) * 100).toFixed(2));

  return {
    ...instrument,
    price: last.close,
    change,
    changePct,
    volume: last.volume,
    turnover: Number((last.volume * last.close).toFixed(2)),
    pe: Number(seededNumber(`${symbol}-pe`, 8, 36).toFixed(2)),
    pb: Number(seededNumber(`${symbol}-pb`, 0.8, 7.2).toFixed(2)),
    dividendYield: Number(seededNumber(`${symbol}-dy`, 0, 7).toFixed(2)),
    marketCap: Number(seededNumber(`${symbol}-cap`, 3_000_000_000, 3_000_000_000_000).toFixed(0)),
    indicators: computeIndicatorsFromCandles(candles),
    candles
  };
}

export function buildQuoteSnapshot(symbol: string): QuoteSnapshot | null {
  const instrument = instruments.find((item) => item.symbol === symbol);
  if (!instrument) {
    return null;
  }

  const candles = generateCandles(symbol);
  return buildSnapshotFromCandles(symbol, candles);
}

export function searchInstruments(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return instruments.slice(0, 10);
  }

  const assetClassPriority: Record<string, number> = {
    stock: 0,
    etf: 1,
    index: 2,
    reit: 3,
    fund: 4,
    bond: 5,
    commodity: 6,
    future: 7,
    forex: 8,
    crypto: 9,
    option: 10
  };

  return instruments
    .filter((instrument) => {
      return (
        instrument.symbol.toLowerCase().includes(normalized) ||
        instrument.name.toLowerCase().includes(normalized) ||
        instrument.tags.some((tag) => tag.toLowerCase().includes(normalized))
      );
    })
    .sort((left, right) => {
      const leftSymbol = left.symbol.toLowerCase();
      const rightSymbol = right.symbol.toLowerCase();
      const leftExact = leftSymbol === normalized ? 0 : leftSymbol.startsWith(normalized) ? 1 : 2;
      const rightExact = rightSymbol === normalized ? 0 : rightSymbol.startsWith(normalized) ? 1 : 2;

      if (leftExact !== rightExact) {
        return leftExact - rightExact;
      }

      const leftPriority = assetClassPriority[left.assetClass] ?? 99;
      const rightPriority = assetClassPriority[right.assetClass] ?? 99;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.symbol.localeCompare(right.symbol);
    });
}

export function runScreener(filters: ScreenerFilters) {
  return instruments
    .map((instrument) => buildQuoteSnapshot(instrument.symbol))
    .filter((item): item is QuoteSnapshot => Boolean(item))
    .filter((item) => {
      if (filters.markets?.length && !filters.markets.includes(item.market)) {
        return false;
      }
      if (filters.assetClasses?.length && !filters.assetClasses.includes(item.assetClass)) {
        return false;
      }
      if (filters.sectors?.length && !filters.sectors.includes(item.sector)) {
        return false;
      }
      if (filters.tags?.length && !filters.tags.every((tag) => item.tags.includes(tag))) {
        return false;
      }
      if (filters.minPrice !== undefined && item.price < filters.minPrice) {
        return false;
      }
      if (filters.maxPrice !== undefined && item.price > filters.maxPrice) {
        return false;
      }
      if (filters.minVolume !== undefined && item.volume < filters.minVolume) {
        return false;
      }
      if (filters.maxPe !== undefined && item.pe && item.pe > filters.maxPe) {
        return false;
      }
      if (filters.minDividendYield !== undefined && (item.dividendYield ?? 0) < filters.minDividendYield) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.changePct - left.changePct);
}

export function summarizePortfolio(holdings: PortfolioHolding[]): PortfolioSummary {
  const enrichedHoldings = holdings.map((holding) => {
    const quote = buildQuoteSnapshot(holding.symbol);
    const lastPrice = quote?.price ?? holding.averageCost;
    const marketValue = Number((lastPrice * holding.quantity).toFixed(2));
    const cost = holding.quantity * holding.averageCost;
    const pnl = Number((marketValue - cost).toFixed(2));
    const pnlPct = Number(((pnl / cost) * 100).toFixed(2));

    return {
      ...holding,
      lastPrice,
      marketValue,
      pnl,
      pnlPct
    };
  });

  const totalCost = Number(
    enrichedHoldings.reduce((sum, holding) => sum + holding.quantity * holding.averageCost, 0).toFixed(2)
  );
  const totalValue = Number(enrichedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0).toFixed(2));
  const totalPnl = Number((totalValue - totalCost).toFixed(2));
  const totalPnlPct = totalCost === 0 ? 0 : Number(((totalPnl / totalCost) * 100).toFixed(2));

  const allocation = enrichedHoldings.map((holding) => ({
    label: holding.symbol,
    value: totalValue === 0 ? 0 : Number(((holding.marketValue / totalValue) * 100).toFixed(2))
  }));

  return {
    holdings: enrichedHoldings,
    totalCost,
    totalValue,
    totalPnl,
    totalPnlPct,
    allocation
  };
}

export function derivePortfolioFromTrades(trades: TradeLogItem[], cashFlows: CashFlowItem[] = []): PortfolioDerivation {
  const sorted = [...trades].sort((left, right) => left.tradeDate.localeCompare(right.tradeDate));
  const sortedFlows = [...cashFlows].sort((left, right) => left.flowDate.localeCompare(right.flowDate));
  const positions = new Map<string, { market: PortfolioHolding["market"]; quantity: number; totalCost: number }>();
  let realizedPnl = 0;
  let turnover = 0;
  let closedTrades = 0;
  let wins = 0;
  let cashBalance = 0;
  let peakAccountValue = 0;
  let maxDrawdown = 0;
  const equityCurve: PortfolioDerivation["equityCurve"] = [];
  let flowIndex = 0;

  for (const trade of sorted) {
    while (flowIndex < sortedFlows.length && sortedFlows[flowIndex].flowDate <= trade.tradeDate) {
      const flow = sortedFlows[flowIndex];
      cashBalance += flow.type === "DEPOSIT" ? flow.amount : -flow.amount;
      flowIndex += 1;
    }

    const key = `${trade.market}:${trade.symbol}`;
    const current = positions.get(key) ?? { market: trade.market, quantity: 0, totalCost: 0 };
    turnover += trade.quantity * trade.price + (trade.fee ?? 0);

    if (trade.side === "BUY") {
      current.quantity += trade.quantity;
      current.totalCost += trade.quantity * trade.price;
      cashBalance -= trade.quantity * trade.price + (trade.fee ?? 0);
      positions.set(key, current);
    } else {
      const averageCost = current.quantity > 0 ? current.totalCost / current.quantity : 0;
      const sellQuantity = Math.min(trade.quantity, current.quantity);
      if (sellQuantity > 0) {
        const pnl = sellQuantity * (trade.price - averageCost);
        realizedPnl += pnl;
        closedTrades += 1;
        if (pnl > 0) {
          wins += 1;
        }
        current.quantity -= sellQuantity;
        current.totalCost -= sellQuantity * averageCost;
        cashBalance += sellQuantity * trade.price - (trade.fee ?? 0);
      }

      if (current.quantity <= 0.000001) {
        positions.delete(key);
      } else {
        positions.set(key, current);
      }
    }

    const holdingsValue = Array.from(positions.entries()).reduce((sum, [mapKey, position]) => {
      const symbol = mapKey.split(":")[1];
      const quote = buildQuoteSnapshot(symbol);
      const lastPrice = quote?.price ?? (position.quantity > 0 ? position.totalCost / position.quantity : 0);
      return sum + position.quantity * lastPrice;
    }, 0);
    const totalValue = cashBalance + holdingsValue;
    peakAccountValue = Math.max(peakAccountValue, totalValue);
    if (peakAccountValue !== 0) {
      maxDrawdown = Math.min(maxDrawdown, (totalValue - peakAccountValue) / peakAccountValue);
    }
    equityCurve.push({
      date: trade.tradeDate,
      cash: Number(cashBalance.toFixed(2)),
      holdingsValue: Number(holdingsValue.toFixed(2)),
      totalValue: Number(totalValue.toFixed(2))
    });
  }

  while (flowIndex < sortedFlows.length) {
    const flow = sortedFlows[flowIndex];
    cashBalance += flow.type === "DEPOSIT" ? flow.amount : -flow.amount;
    flowIndex += 1;
    const holdingsValue = Array.from(positions.entries()).reduce((sum, [mapKey, position]) => {
      const symbol = mapKey.split(":")[1];
      const quote = buildQuoteSnapshot(symbol);
      const lastPrice = quote?.price ?? (position.quantity > 0 ? position.totalCost / position.quantity : 0);
      return sum + position.quantity * lastPrice;
    }, 0);
    const totalValue = cashBalance + holdingsValue;
    peakAccountValue = Math.max(peakAccountValue, totalValue);
    if (peakAccountValue !== 0) {
      maxDrawdown = Math.min(maxDrawdown, (totalValue - peakAccountValue) / peakAccountValue);
    }
    equityCurve.push({
      date: flow.flowDate,
      cash: Number(cashBalance.toFixed(2)),
      holdingsValue: Number(holdingsValue.toFixed(2)),
      totalValue: Number(totalValue.toFixed(2))
    });
  }

  const holdings: PortfolioHolding[] = Array.from(positions.entries())
    .map(([key, value]) => {
      const [market, symbol] = key.split(":");
      return {
        symbol,
        market: market as PortfolioHolding["market"],
        quantity: Number(value.quantity.toFixed(4)),
        averageCost: value.quantity > 0 ? Number((value.totalCost / value.quantity).toFixed(4)) : 0
      };
    })
    .filter((item) => item.quantity > 0);

  const equityValue = Number(
    holdings.reduce((sum, holding) => {
      const quote = buildQuoteSnapshot(holding.symbol);
      const lastPrice = quote?.price ?? holding.averageCost;
      return sum + holding.quantity * lastPrice;
    }, 0).toFixed(2)
  );
  const totalAccountValue = Number((cashBalance + equityValue).toFixed(2));

  return {
    holdings,
    realizedPnl: Number(realizedPnl.toFixed(2)),
    turnover: Number(turnover.toFixed(2)),
    tradeCount: sorted.length,
    winRatePct: closedTrades === 0 ? 0 : Number(((wins / closedTrades) * 100).toFixed(2)),
    cashBalance: Number(cashBalance.toFixed(2)),
    equityValue,
    totalAccountValue,
    maxDrawdownPct: Number((Math.abs(maxDrawdown) * 100).toFixed(2)),
    equityCurve
  };
}

export function buildTradingReview(trades: TradeLogItem[], cashFlows: CashFlowItem[] = []): TradingReview {
  const derivation = derivePortfolioFromTrades(trades, cashFlows);
  const buys = trades.filter((item) => item.side === "BUY").length;
  const sells = trades.filter((item) => item.side === "SELL").length;
  const topSymbols = Array.from(
    trades.reduce((map, trade) => {
      map.set(trade.symbol, (map.get(trade.symbol) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([symbol, count]) => ({ symbol, trades: count }))
    .sort((left, right) => right.trades - left.trades)
    .slice(0, 5);

  const insights: TradingReview["insights"] = [];
  if (derivation.winRatePct >= 55) {
    insights.push({
      title: "胜率保持正向",
      detail: `已平仓交易胜率为 ${derivation.winRatePct}% ，当前执行纪律尚可。`,
      tone: "positive"
    });
  } else {
    insights.push({
      title: "胜率仍需改善",
      detail: `已平仓交易胜率为 ${derivation.winRatePct}% ，需要复盘入场条件与止盈止损设计。`,
      tone: "negative"
    });
  }

  if (derivation.turnover > 0) {
    insights.push({
      title: "交易活跃度",
      detail: `累计成交额 ${derivation.turnover.toFixed(2)}，应结合收益与成本评估是否过度交易。`,
      tone: "neutral"
    });
  }

  if (derivation.realizedPnl >= 0) {
    insights.push({
      title: "已实现收益为正",
      detail: `当前已实现盈亏 ${derivation.realizedPnl.toFixed(2)}，可进一步拆解盈利来源。`,
      tone: "positive"
    });
  } else {
    insights.push({
      title: "已实现亏损需控制",
      detail: `当前已实现盈亏 ${derivation.realizedPnl.toFixed(2)}，需要回看亏损交易是否符合计划。`,
      tone: "negative"
    });
  }

  return {
    periodLabel: trades.length ? `${trades.at(-1)?.tradeDate} 至 ${trades[0]?.tradeDate}` : "No trades",
    summary: `共记录 ${trades.length} 笔交易，买入 ${buys} 笔，卖出 ${sells} 笔；已实现盈亏 ${derivation.realizedPnl.toFixed(
      2
    )}，胜率 ${derivation.winRatePct.toFixed(2)}%，账户净值 ${derivation.totalAccountValue.toFixed(2)}。`,
    totalTrades: trades.length,
    buys,
    sells,
    turnover: derivation.turnover,
    realizedPnl: derivation.realizedPnl,
    winRatePct: derivation.winRatePct,
    topSymbols,
    insights,
    marketBreakdown: [],
    styleProfile: {
      styleLabel: "待补充",
      avgHoldingDays: 0,
      rapidTradePct: 0,
      concentrationPct: 0,
      preferredMarkets: [],
      strengths: [],
      weaknesses: []
    }
  };
}

export function evaluateSignal(snapshot: QuoteSnapshot): WatchlistSignalItem["signal"] {
  const bullishTrend = snapshot.indicators.sma20 > snapshot.indicators.sma60;
  const bearishTrend = snapshot.indicators.sma20 < snapshot.indicators.sma60;
  const strongMomentum = snapshot.indicators.rsi14 >= 55 && snapshot.changePct > 0;
  const weakMomentum = snapshot.indicators.rsi14 <= 45 && snapshot.changePct < 0;
  const chan = deriveChanStructure(snapshot);

  if (bullishTrend && strongMomentum && chan.strokeDirection === "up") {
    return "BUY";
  }
  if (bearishTrend && weakMomentum && chan.strokeDirection === "down") {
    return "SELL";
  }
  if (bullishTrend || (snapshot.indicators.rsi14 >= 50 && chan.strokeDirection !== "down")) {
    return "HOLD";
  }
  return "WATCH";
}

export function deriveChanStructure(snapshot: QuoteSnapshot) {
  const recent = snapshot.candles.slice(-9);
  const pivots: Array<{ index: number; type: "top" | "bottom"; price: number }> = [];

  for (let i = 1; i < recent.length - 1; i += 1) {
    const prev = recent[i - 1];
    const curr = recent[i];
    const next = recent[i + 1];
    if (curr.high > prev.high && curr.high > next.high) {
      pivots.push({ index: i, type: "top", price: curr.high });
    }
    if (curr.low < prev.low && curr.low < next.low) {
      pivots.push({ index: i, type: "bottom", price: curr.low });
    }
  }

  const lastPivot = pivots.at(-1);
  const lastTop = [...pivots].reverse().find((item) => item.type === "top");
  const lastBottom = [...pivots].reverse().find((item) => item.type === "bottom");
  const previousTop = [...pivots].reverse().filter((item) => item.type === "top")[1];
  const previousBottom = [...pivots].reverse().filter((item) => item.type === "bottom")[1];

  let strokeDirection: "up" | "down" | "range" = "range";
  if (lastBottom && previousBottom && lastBottom.price > previousBottom.price) {
    strokeDirection = "up";
  } else if (lastTop && previousTop && lastTop.price < previousTop.price) {
    strokeDirection = "down";
  }

  const fractal = lastPivot?.type === "bottom" ? "底分型" : lastPivot?.type === "top" ? "顶分型" : "结构未明";

  return {
    fractal,
    strokeDirection,
    pivotCount: pivots.length
  };
}

export function buildSignalReason(snapshot: QuoteSnapshot) {
  const trend = snapshot.indicators.sma20 > snapshot.indicators.sma60 ? "均线结构偏多" : "均线结构偏弱";
  const momentum = snapshot.indicators.rsi14 >= 55 ? "短线动能改善" : snapshot.indicators.rsi14 <= 45 ? "短线动能承压" : "短线动能中性";
  const volumeState = (() => {
    const recentVolume = snapshot.candles.slice(-10).map((item) => item.volume);
    const avg = average(recentVolume);
    if (snapshot.volume > avg * 1.3) {
      return "量能放大";
    }
    if (snapshot.volume < avg * 0.8) {
      return "量能偏弱";
    }
    return "量能平稳";
  })();
  const chan = deriveChanStructure(snapshot);
  const chanText =
    chan.strokeDirection === "up"
      ? `${chan.fractal}确认后，笔方向偏上`
      : chan.strokeDirection === "down"
        ? `${chan.fractal}确认后，笔方向偏下`
        : `${chan.fractal}附近，仍偏中枢震荡`;
  return `${trend}，${momentum}，${volumeState}，${chanText}`;
}

export function buildWatchlistSignals(snapshots: QuoteSnapshot[]): WatchlistSignalItem[] {
  return snapshots.map((snapshot) => {
      const signal = evaluateSignal(snapshot);
      const confidenceBase = signal === "BUY" || signal === "SELL" ? 74 : signal === "HOLD" ? 62 : 55;
      const chan = deriveChanStructure(snapshot);
      const chanBoost = chan.strokeDirection === "range" ? 0 : 4;
      const confidence = Math.min(95, Math.max(35, confidenceBase + Math.round(Math.abs(snapshot.changePct))));
      return {
        symbol: snapshot.symbol,
        market: snapshot.market,
        name: snapshot.name,
        price: snapshot.price,
        changePct: snapshot.changePct,
        signal,
        confidence: Math.min(95, confidence + chanBoost),
        reason: buildSignalReason(snapshot),
        available: true,
        dataSource: snapshot.dataSource,
        lastUpdated: snapshot.lastUpdated,
        dataLatency: snapshot.dataLatency,
        cacheState: snapshot.cacheState
      };
    });
}

export function buildPartialWatchlistSignal(snapshot: QuoteSnapshot): WatchlistSignalItem {
  const base = buildWatchlistSignals([snapshot])[0];
  const candleCount = snapshot.candles.length;
  const adjustedSignal = base.signal === "SELL" ? "WATCH" : base.signal;
  const adjustedConfidence = base.confidence === null ? 48 : Math.max(42, Math.min(72, base.confidence - 14));

  return {
    ...base,
    signal: adjustedSignal,
    confidence: adjustedConfidence,
    available: true,
    reason: `${buildSignalReason(snapshot)}；历史日线仅 ${candleCount} 根，当前先按轻量信号跟踪。`
  };
}

export function buildUnavailableWatchlistSignal(input: {
  symbol: string;
  market: QuoteSnapshot["market"];
  name: string;
  reason?: string;
  unavailableReason?: string;
  snapshot?: Pick<QuoteSnapshot, "price" | "changePct" | "dataSource" | "lastUpdated" | "dataLatency" | "cacheState">;
}): WatchlistSignalItem {
  return {
    symbol: input.symbol,
    market: input.market,
    name: input.name,
    price: input.snapshot?.price ?? null,
    changePct: input.snapshot?.changePct ?? null,
    signal: "WATCH",
    confidence: null,
    reason: input.reason ?? "暂无真实行情数据，当前不输出交易信号。",
    available: false,
    dataSource: input.snapshot?.dataSource,
    lastUpdated: input.snapshot?.lastUpdated,
    dataLatency: input.snapshot?.dataLatency,
    unavailableReason: input.unavailableReason,
    cacheState: input.snapshot?.cacheState
  };
}

export function buildWatchlistInsight(signals: WatchlistSignalItem[]): WatchlistInsight {
  const validSignals = signals.filter((item) => item.available);
  const ranked = [...validSignals].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0));
  const opportunities = ranked
    .filter((item) => item.signal === "BUY" || item.signal === "HOLD")
    .slice(0, 3)
    .map((item) => `${item.name}（${item.symbol}）：${item.reason}${item.fundamentalNote ? `；基本面关注：${item.fundamentalNote}` : ""}`);
  const risks = ranked
    .filter((item) => item.signal === "SELL" || item.signal === "WATCH")
    .slice(0, 3)
    .map((item) => `${item.name}（${item.symbol}）：${item.reason}${item.fundamentalNote ? `；基本面关注：${item.fundamentalNote}` : ""}`);
  const fundamentalAlerts = ranked
    .filter((item) => item.fundamentalTone === "cautious" && item.fundamentalNote)
    .slice(0, 2)
    .map((item) => `${item.name}（${item.symbol}）：${item.fundamentalNote}`);
  const fundamentalSupports = ranked
    .filter((item) => item.fundamentalTone === "supportive" && item.fundamentalNote)
    .slice(0, 2)
    .map((item) => `${item.name}（${item.symbol}）：${item.fundamentalNote}`);
  const reflexiveBull = ranked
    .filter((item) => item.reflexivityTone === "reinforcing" && item.reflexivityNote)
    .slice(0, 2)
    .map((item) => `${item.name}（${item.symbol}）：${item.reflexivityNote}`);
  const reflexiveBear = ranked
    .filter((item) => item.reflexivityTone === "turning-bearish" && item.reflexivityNote)
    .slice(0, 2)
    .map((item) => `${item.name}（${item.symbol}）：${item.reflexivityNote}`);

  return {
    summary:
      validSignals.length === 0
        ? `当前自选共 ${signals.length} 个标的，但暂无可校验的真实行情数据，先不要参考信号结论。`
        : `当前自选共 ${signals.length} 个标的，其中 ${validSignals.length} 个已有真实行情；优先留意 ${opportunities.length} 个偏强机会，风险侧重点看 ${risks.length} 个弱势或结构待确认标的${fundamentalAlerts.length ? "，并额外核对基本面变化" : ""}${reflexiveBull.length || reflexiveBear.length ? "，同时关注反身性是否正在加强或转空" : ""}。`,
    opportunities: [...opportunities, ...fundamentalSupports, ...reflexiveBull],
    risks: [...risks, ...fundamentalAlerts, ...reflexiveBear]
  };
}

export function buildAccountPerformance(trades: TradeLogItem[], cashFlows: CashFlowItem[] = []): AccountPerformance {
  const derivation = derivePortfolioFromTrades(trades, cashFlows);
  const netFlow = cashFlows.reduce((sum, flow) => sum + (flow.type === "DEPOSIT" ? flow.amount : -flow.amount), 0);
  const startingCapital = cashFlows
    .filter((flow) => flow.type === "DEPOSIT")
    .reduce((sum, flow) => sum + flow.amount, 0);
  const endingEquity = derivation.totalAccountValue;
  const unrealizedPnl = Number((endingEquity - derivation.cashBalance - derivation.holdings.reduce((sum, holding) => sum + holding.quantity * holding.averageCost, 0)).toFixed(2));
  const returns = derivation.equityCurve.map((point, index, array) => {
    if (index === 0 || array[index - 1].totalValue === 0) {
      return 0;
    }
    return (point.totalValue - array[index - 1].totalValue) / array[index - 1].totalValue;
  });
  const averageReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;
  const variance = returns.length
    ? returns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / returns.length
    : 0;
  const sharpeLike = variance === 0 ? 0 : Number(((averageReturn / Math.sqrt(variance)) * Math.sqrt(252)).toFixed(2));
  const totalReturnPct = netFlow === 0 ? 0 : Number((((endingEquity - netFlow) / netFlow) * 100).toFixed(2));

  return {
    startingCapital: Number(startingCapital.toFixed(2)),
    endingEquity: Number(endingEquity.toFixed(2)),
    netFlow: Number(netFlow.toFixed(2)),
    totalReturnPct,
    realizedPnl: derivation.realizedPnl,
    unrealizedPnl,
    maxDrawdownPct: derivation.maxDrawdownPct,
    sharpeLike,
    equityCurve: derivation.equityCurve.map((item) => ({
      date: item.date,
      totalValue: item.totalValue,
      netDeposits: Number(
        cashFlows
          .filter((flow) => flow.flowDate <= item.date)
          .reduce((sum, flow) => sum + (flow.type === "DEPOSIT" ? flow.amount : -flow.amount), 0)
          .toFixed(2)
      )
    }))
  };
}

export function backtestMovingAverageCross(input: BacktestRequest): BacktestResult | null {
  const quote = buildQuoteSnapshot(input.symbol);
  if (!quote) {
    return null;
  }
  return backtestMovingAverageCrossFromCandles(input, quote.candles);
}

export function backtestMovingAverageCrossFromCandles(input: BacktestRequest, candles: Candle[]): BacktestResult | null {
  if (candles.length < Math.max(input.slowWindow + 2, 10)) {
    return null;
  }

  const closes = candles.map((item) => item.close);
  let cash = input.initialCapital;
  let shares = 0;
  let trades = 0;
  let wins = 0;
  let costBasis = 0;
  const signals: BacktestResult["signals"] = [];
  const equityCurve: BacktestResult["equityCurve"] = [];
  let peak = input.initialCapital;
  let maxDrawdown = 0;

  for (let index = input.slowWindow; index < candles.length; index += 1) {
    const current = candles[index];
    const fast = average(closes.slice(index - input.fastWindow, index));
    const slow = average(closes.slice(index - input.slowWindow, index));

    if (fast > slow && shares === 0) {
      shares = cash / current.close;
      costBasis = current.close;
      cash = 0;
      trades += 1;
      signals.push({ date: current.date, action: "BUY", price: current.close });
    }

    if (fast < slow && shares > 0) {
      cash = shares * current.close;
      if (current.close > costBasis) {
        wins += 1;
      }
      shares = 0;
      trades += 1;
      signals.push({ date: current.date, action: "SELL", price: current.close });
    }

    const equity = Number((cash + shares * current.close).toFixed(2));
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, (equity - peak) / peak);
    equityCurve.push({ date: current.date, equity });
  }

  const finalEquity = equityCurve.at(-1)?.equity ?? input.initialCapital;
  const totalReturnPct = Number((((finalEquity - input.initialCapital) / input.initialCapital) * 100).toFixed(2));
  const years = candles.length / 252;
  const annualizedReturnPct = Number((((finalEquity / input.initialCapital) ** (1 / years) - 1) * 100).toFixed(2));

  return {
    symbol: input.symbol,
    market: input.market,
    totalReturnPct,
    annualizedReturnPct,
    maxDrawdownPct: Number((Math.abs(maxDrawdown) * 100).toFixed(2)),
    winRatePct: trades === 0 ? 0 : Number(((wins / Math.max(1, trades / 2)) * 100).toFixed(2)),
    trades,
    equityCurve,
    signals
  };
}

export function generateAiBrief(input: AiBriefRequest): AiBrief | null {
  const quote = buildQuoteSnapshot(input.symbol);
  if (!quote) {
    return null;
  }

  const trend = quote.indicators.sma20 > quote.indicators.sma60 ? "技术面偏多，短中期均线仍在多头序列" : "技术面偏弱，均线结构尚未回到多头序列";
  const sentiment =
    quote.changePct > 2
      ? "情绪面偏热，追高要注意节奏"
      : quote.changePct < -2
        ? "情绪面偏冷，容易出现恐慌性波动"
        : "情绪面中性，资金更关注确认信号";
  const chan =
    quote.candles.at(-1) && quote.candles.at(-2) && quote.candles.at(-1)!.high > quote.candles.at(-2)!.high
      ? "缠论视角更接近向上笔延续，若能脱离中枢上沿则更强"
      : "缠论视角仍像中枢震荡或向下笔未完成，需要等待结构确认";

  const stanceText = {
    bullish: "优先等回踩确认后的低吸，不建议在短线情绪过热时一次性重仓。",
    neutral: "先观察结构确认、量价配合和消息催化，再决定是否提升仓位。",
    bearish: "以控制回撤为主，反弹更适合做减仓和风险暴露管理。"
  }[input.stance];

  return {
    summary: `${quote.name}（${quote.symbol}）最新价 ${quote.price} ${quote.currency}。${trend}；${sentiment}；${chan}。`,
    catalysts: [
      `若价格继续稳定在 20 日均线 ${quote.indicators.sma20} 附近上方，短线结构更容易转强。`,
      `若 RSI14 从 ${quote.indicators.rsi14} 继续抬升，动能确认会更充分。`,
      `当前 RSI14 为 ${quote.indicators.rsi14}，短线拐点观察价值较高。`
    ],
    risks: [
      "若价格重新跌回关键中枢或均线下方，现有信号可能失效。",
      "单日情绪波动不能替代趋势确认，避免把反弹误判成反转。",
      "消息面扰动较大时，技术结构可能被快速破坏。"
    ],
    actionPlan: [
      stanceText,
      quote.price >= quote.indicators.sma20
        ? `优先观察价格回踩 ${quote.indicators.sma20} 一线后的承接强度，再决定是否跟随。`
        : `先等价格重新站回 ${quote.indicators.sma20} 上方，再考虑把关注级别提高。`,
      quote.changePct >= 0
        ? "若后续放量不能延续，短线追价性价比会下降。"
        : "若只是缩量反弹而非趋势扭转，仓位应保持克制。"
    ]
  };
}
