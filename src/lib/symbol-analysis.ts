import {
  buildPartialWatchlistSignal,
  buildSignalReason,
  buildSnapshotFromCandles,
  buildUnavailableWatchlistSignal,
  buildWatchlistSignals,
  generateAiBrief
} from "@/lib/analytics";
import { buildFundamentalContext } from "@/lib/fundamental-signals";
import { getHistoricalCandles, getNews, getQuote } from "@/lib/market-data";
import { buildReflexivityContext, summarizeReflexivitySignal } from "@/lib/reflexivity-signals";
import { AiBrief, Market, QuoteSnapshot, SymbolAnalysis } from "@/lib/types";

function resolveTrend(quote: QuoteSnapshot): SymbolAnalysis["marketContext"]["trend"] {
  if (quote.indicators.sma20 > quote.indicators.sma60 && quote.changePct > 0) {
    return "bullish";
  }
  if (quote.indicators.sma20 < quote.indicators.sma60 && quote.changePct < 0) {
    return "bearish";
  }
  return "neutral";
}

function resolveMomentum(quote: QuoteSnapshot): SymbolAnalysis["marketContext"]["momentum"] {
  if (quote.indicators.rsi14 >= 60) {
    return "strong";
  }
  if (quote.indicators.rsi14 <= 40) {
    return "weak";
  }
  return "neutral";
}

function resolveSentiment(quote: QuoteSnapshot): SymbolAnalysis["marketContext"]["sentiment"] {
  if (quote.changePct >= 3) {
    return "hot";
  }
  if (quote.changePct <= -3) {
    return "cold";
  }
  return "neutral";
}

function resolveChanState(quote: QuoteSnapshot) {
  const recent = quote.candles.slice(-5);
  const highs = recent.map((item) => item.high);
  const lows = recent.map((item) => item.low);
  const higherHigh = highs.at(-1)! > highs[0]!;
  const higherLow = lows.at(-1)! > lows[0]!;
  if (higherHigh && higherLow) {
    return "缠论结构偏向向上笔延续，正在尝试离开中枢上沿";
  }
  if (!higherHigh && !higherLow) {
    return "缠论结构偏向向下笔或弱势震荡，暂未看到有效转强";
  }
  return "缠论结构仍在中枢内反复，需要等待方向选择";
}

function resolveVolumeState(quote: QuoteSnapshot) {
  const recent = quote.candles.slice(-20);
  const avgVolume = recent.reduce((sum, item) => sum + item.volume, 0) / Math.max(recent.length, 1);
  if (quote.volume >= avgVolume * 1.4) {
    return "放量";
  }
  if (quote.volume <= avgVolume * 0.75) {
    return "缩量";
  }
  return "量能平稳";
}

function resolveNewsTone(news: SymbolAnalysis["news"]) {
  const score = news.reduce((sum, item) => {
    if (item.sentiment === "positive") {
      return sum + 1;
    }
    if (item.sentiment === "negative") {
      return sum - 1;
    }
    return sum;
  }, 0);

  if (score >= 2) {
    return "偏多";
  }
  if (score <= -2) {
    return "偏空";
  }
  return "中性";
}

function buildEnhancedBrief(
  base: AiBrief,
  quote: QuoteSnapshot,
  news: SymbolAnalysis["news"],
  signalText: string,
  fundamentalContext: SymbolAnalysis["fundamentalContext"],
  options: {
    hasTechnicalHistory: boolean;
    support: number;
    resistance: number;
  }
): AiBrief {
  const volumeState = options.hasTechnicalHistory ? resolveVolumeState(quote) : "量能信息不足";
  const newsTone = resolveNewsTone(news);
  const summary = `${quote.name} 当前处于${signalText}框架，技术面 ${quote.indicators.sma20 > quote.indicators.sma60 ? "偏强" : "偏弱"}，量价状态为${volumeState}，新闻情绪${newsTone}，基本面${fundamentalContext.stance === "supportive" ? "偏支持" : fundamentalContext.stance === "cautious" ? "偏谨慎" : "中性"}。`;
  const actionPlan = options.hasTechnicalHistory
    ? [
        quote.price >= quote.indicators.sma20
          ? `若回踩 ${quote.indicators.sma20.toFixed(2)} 一线后承接稳定，可继续跟踪上行延续。`
          : `先观察价格能否重新站回 ${quote.indicators.sma20.toFixed(2)}，站回之前不急于提高仓位。`,
        `上方先看 ${options.resistance.toFixed(2)} 一线是否放量突破，下方留意 ${options.support.toFixed(2)} 是否失守。`,
        volumeState === "放量"
          ? "当前量能已有配合，接下来重点看放量是否具备连续性。"
          : "当前量能还不够强，若没有成交量确认，突破持续性要打折。"
      ]
    : [
        `当前先以 ${quote.price.toFixed(2)} 作为盘后跟踪基准，等待更多历史日线补齐。`,
        `上方先看 ${options.resistance.toFixed(2)}，下方留意 ${options.support.toFixed(2)}，先按区间跟踪。`,
        "在历史样本不足前，先把重点放在新闻、基本面变化和关键价位反应。"
      ];

  return {
    ...base,
    summary,
    catalysts: [
      `价格 ${quote.price.toFixed(2)}，距离 20 日均线 ${quote.indicators.sma20.toFixed(2)} ${quote.price >= quote.indicators.sma20 ? "上方" : "下方"}`,
      `${volumeState}，短线资金参与度需要结合后续持续性验证`,
      `新闻情绪${newsTone}，需继续跟踪是否出现业绩、政策或产品催化`,
      ...fundamentalContext.highlights.slice(0, 2)
    ],
    risks: Array.from(
      new Set([...base.risks, `若量价背离扩大，${signalText}可信度会明显下降。`, ...fundamentalContext.alerts])
    ),
    actionPlan: Array.from(new Set(actionPlan))
  };
}

function fallbackBrief(symbol: string, market: Market, quote: QuoteSnapshot): AiBrief {
  return (
    generateAiBrief({ symbol, market, stance: "neutral" }) ?? {
      summary: `${quote.name} 当前暂无进一步分析。`,
      catalysts: [],
      risks: [],
      actionPlan: []
    }
  );
}

export async function getSymbolAnalysis(symbol: string, market?: Market): Promise<SymbolAnalysis | null> {
  const baseQuote = await getQuote(symbol, market);
  if (!baseQuote) {
    return null;
  }

  const candles = baseQuote.candles.length ? baseQuote.candles : await getHistoricalCandles(symbol, market ?? baseQuote.market);
  const quote =
    candles.length >= 2
      ? {
          ...(buildSnapshotFromCandles(symbol, candles) ?? baseQuote),
          price: baseQuote.price,
          change: baseQuote.change,
          changePct: baseQuote.changePct,
          volume: baseQuote.volume,
          turnover: baseQuote.turnover,
          dataSource: baseQuote.dataSource,
          lastUpdated: baseQuote.lastUpdated,
          dataLatency: baseQuote.dataLatency,
          cacheState: baseQuote.cacheState
        }
      : baseQuote;

  const [news] = await Promise.all([getNews(symbol, market ?? quote.market)]);
  const fundamentalContext = buildFundamentalContext(quote, news);
  const reflexivityContext = buildReflexivityContext(quote, news, fundamentalContext);
  const hasTechnicalHistory = quote.candles.length >= 60;
  const hasPartialHistory = quote.candles.length >= 20;
  const signal = hasTechnicalHistory
    ? buildWatchlistSignals([quote])[0]
    : hasPartialHistory
      ? buildPartialWatchlistSignal(quote)
      : buildUnavailableWatchlistSignal({
        symbol: quote.symbol,
        market: quote.market,
        name: quote.name,
        snapshot: {
          price: quote.price,
          changePct: quote.changePct,
          dataSource: quote.dataSource,
          lastUpdated: quote.lastUpdated,
          dataLatency: quote.dataLatency,
          cacheState: quote.cacheState
        },
        reason: "已拿到真实报价，但缺少足够历史日线，技术面与缠论信号先保持待确认。",
        unavailableReason: "缺少足够的真实日线历史，详情页先展示报价、新闻和基本面提示。"
      });
  const support = hasTechnicalHistory
    ? Number(Math.min(...quote.candles.slice(-20).map((item) => item.low)).toFixed(2))
    : Number((quote.price * 0.97).toFixed(2));
  const resistance = hasTechnicalHistory
    ? Number(Math.max(...quote.candles.slice(-20).map((item) => item.high)).toFixed(2))
    : Number((quote.price * 1.03).toFixed(2));
  const brief = buildEnhancedBrief(
    fallbackBrief(symbol, market ?? quote.market, quote),
    quote,
    news,
    signal.signal,
    fundamentalContext,
    { hasTechnicalHistory: hasTechnicalHistory || hasPartialHistory, support, resistance }
  );
  const volumeState = hasTechnicalHistory ? resolveVolumeState(quote) : "量能信息不足";
  const newsTone = resolveNewsTone(news);

  return {
    quote,
    signal: {
      ...signal,
      reason:
        hasTechnicalHistory || hasPartialHistory
          ? `${signal.reason}；${summarizeReflexivitySignal(reflexivityContext)}`
          : signal.reason
    },
    brief,
    news,
    fundamentalContext,
    reflexivityContext,
    marketContext: {
      trend: hasTechnicalHistory || hasPartialHistory ? resolveTrend(quote) : quote.changePct >= 0 ? "neutral" : "bearish",
      momentum: hasTechnicalHistory || hasPartialHistory ? resolveMomentum(quote) : "neutral",
      sentiment: resolveSentiment(quote),
      chanState: hasTechnicalHistory
        ? resolveChanState(quote)
        : hasPartialHistory
          ? "历史样本已具备初步观察条件，缠论结构先按轻量笔段跟踪。"
          : "历史 K 线不足，缠论结构先不做确认，等待更多日线样本。"
    },
    opportunities: [
      hasTechnicalHistory || hasPartialHistory
        ? `若价格站稳 ${quote.indicators.sma20.toFixed(2)} 上方，趋势延续概率会提升。`
        : `当前报价 ${quote.price.toFixed(2)}，先把它作为盘后跟踪基准，等待历史序列补齐。`,
      `若量价配合并接近 ${resistance.toFixed(2)} 突破，可观察顺势机会。`,
      `当前信号为 ${signal.signal}，置信度 ${signal.confidence}，新闻情绪 ${newsTone}。`,
      summarizeReflexivitySignal(reflexivityContext),
      ...fundamentalContext.highlights.slice(0, 2)
    ],
    risks: [
      `若失守 ${support.toFixed(2)}，短线结构可能重新转弱。`,
      `${volumeState === "放量" ? "放量" : "量能不足"}若无法延续，突破信号容易回落。`,
      "情绪波动和事件催化可能让技术信号短期失真。",
      "缠论结构若重新回到中枢内部，追价性价比会下降。",
      ...reflexivityContext.risks.slice(0, 2),
      ...fundamentalContext.alerts.slice(0, 2)
    ],
    importantLevels: {
      support,
      resistance
    }
  };
}
