import { deriveChanStructure } from "@/lib/analytics";
import { instruments } from "@/lib/instruments";
import { NewsItem, QuoteSnapshot, SymbolAnalysis } from "@/lib/types";

type FundamentalContext = SymbolAnalysis["fundamentalContext"];

type ReflexiveDriver = {
  label: string;
  direction: "bull" | "bear";
  weight: number;
};

function getInstrumentMeta(symbol: string, market: QuoteSnapshot["market"]) {
  return instruments.find((item) => item.symbol === symbol && item.market === market) ?? null;
}

function resolveReflexiveProfile(quote: QuoteSnapshot) {
  const meta = getInstrumentMeta(quote.symbol, quote.market);
  const tags = meta?.tags ?? [];
  const growthLike =
    meta?.assetClass === "stock" &&
    (
      tags.some((tag) => ["ai", "growth", "model", "ev", "gpu", "cloud", "semiconductor"].includes(tag.toLowerCase())) ||
      ["Technology", "Communication Services", "Consumer Discretionary"].includes(meta?.sector ?? "")
    );

  return {
    name: growthLike ? "growth" : "stable",
    priceShockPct: growthLike ? 3.2 : 5.2,
    negativeShockPct: growthLike ? -3.2 : -5.2,
    volumeBoost: growthLike ? 1.2 : 1.35,
    newsThreshold: growthLike ? 1 : 2
  } as const;
}

function buildReflexiveDrivers(
  quote: QuoteSnapshot,
  news: NewsItem[],
  fundamentalContext: FundamentalContext
) {
  const profile = resolveReflexiveProfile(quote);
  const chan = deriveChanStructure(quote);
  const recentCandles = quote.candles.slice(-20);
  const avgVolume = recentCandles.length
    ? recentCandles.reduce((sum, item) => sum + item.volume, 0) / recentCandles.length
    : Math.max(quote.volume, 1);
  const volumeRatio = avgVolume > 0 ? quote.volume / avgVolume : 1;
  const positiveNews = news.filter((item) => item.sentiment === "positive").length;
  const negativeNews = news.filter((item) => item.sentiment === "negative").length;

  const drivers: ReflexiveDriver[] = [];

  if (quote.price >= quote.indicators.sma20 && quote.indicators.sma20 >= quote.indicators.sma60) {
    drivers.push({ label: "价格站上短中期均线，趋势预期正在自我强化", direction: "bull", weight: 1.4 });
  }
  if (quote.price <= quote.indicators.sma20 && quote.indicators.sma20 <= quote.indicators.sma60) {
    drivers.push({ label: "价格跌回短中期均线下方，弱势反馈开始扩散", direction: "bear", weight: 1.4 });
  }

  if (quote.changePct >= profile.priceShockPct) {
    drivers.push({ label: "涨幅达到易触发跟风和叙事扩散的阈值", direction: "bull", weight: 1.1 });
  }
  if (quote.changePct <= profile.negativeShockPct) {
    drivers.push({ label: "跌幅达到容易触发负反馈扩散的阈值", direction: "bear", weight: 1.1 });
  }

  if (volumeRatio >= profile.volumeBoost) {
    drivers.push({
      label: quote.changePct >= 0 ? "放量上涨，增量资金开始验证原有预期" : "放量下跌，抛压正在验证负面预期",
      direction: quote.changePct >= 0 ? "bull" : "bear",
      weight: 1.2
    });
  }

  if (chan.strokeDirection === "up" && chan.pivotCount >= 2) {
    drivers.push({ label: `${chan.fractal}后笔方向向上，结构强化趋势叙事`, direction: "bull", weight: 0.9 });
  }
  if (chan.strokeDirection === "down" && chan.pivotCount >= 2) {
    drivers.push({ label: `${chan.fractal}后笔方向向下，结构强化弱势叙事`, direction: "bear", weight: 0.9 });
  }

  if (positiveNews >= profile.newsThreshold) {
    drivers.push({ label: "正面消息开始提供额外叙事燃料", direction: "bull", weight: 0.8 });
  }
  if (negativeNews >= profile.newsThreshold) {
    drivers.push({ label: "负面消息开始放大市场谨慎预期", direction: "bear", weight: 0.8 });
  }

  if (fundamentalContext.stance === "supportive") {
    drivers.push({ label: "基本面当前偏支持，价格走强更容易得到资金认可", direction: "bull", weight: 0.8 });
  }
  if (fundamentalContext.stance === "cautious") {
    drivers.push({ label: "基本面转谨慎时，价格回落更容易形成负反馈", direction: "bear", weight: 0.8 });
  }

  return { drivers, profile, chan };
}

export function buildReflexivityContext(
  quote: QuoteSnapshot,
  news: NewsItem[],
  fundamentalContext: FundamentalContext
): SymbolAnalysis["reflexivityContext"] {
  const { drivers, profile } = buildReflexiveDrivers(quote, news, fundamentalContext);
  const bullDrivers = drivers.filter((item) => item.direction === "bull");
  const bearDrivers = drivers.filter((item) => item.direction === "bear");
  const bullScore = bullDrivers.reduce((sum, item) => sum + item.weight, 0);
  const bearScore = bearDrivers.reduce((sum, item) => sum + item.weight, 0);
  const scoreGap = Math.abs(bullScore - bearScore);

  if (bullScore >= 3.1 && bullScore > bearScore && scoreGap >= 1) {
    return {
      stance: "reinforcing",
      summary:
        profile.name === "growth"
          ? "成长型标的已出现反身性加强，价格、量能、结构和叙事正在互相推升。"
          : "当前已有偏正向的反身性加强，趋势与预期开始同向共振。",
      drivers: bullDrivers.sort((left, right) => right.weight - left.weight).map((item) => item.label).slice(0, 4),
      risks: [
        "若放量不能延续，反身性加强往往会退化成一次性脉冲。",
        "一旦跌回关键均线下方，顺势资金可能快速撤离。"
      ]
    };
  }

  if (bearScore >= 3.1 && bearScore > bullScore && scoreGap >= 1) {
    return {
      stance: "turning-bearish",
      summary:
        profile.name === "growth"
          ? "成长型标的已出现反身性转空，弱势价格行为和负面叙事正在互相强化。"
          : "当前已出现反身性转空，价格回落与谨慎预期开始形成负反馈。",
      drivers: bearDrivers.sort((left, right) => right.weight - left.weight).map((item) => item.label).slice(0, 4),
      risks: [
        "若后续出现放量反包或利好催化，反身性转空可能被迅速打断。",
        "在关键支撑位附近，过度追空的赔率会下降。"
      ]
    };
  }

  const neutralDrivers = drivers
    .sort((left, right) => right.weight - left.weight)
    .map((item) => item.label)
    .slice(0, 3);

  return {
    stance: "neutral",
    summary: "当前还没有形成足够清晰的反身性闭环，价格、结构、量能和叙事仍在博弈。",
    drivers: neutralDrivers.length ? neutralDrivers : ["当前趋势和叙事还没形成明确的自我强化链条。"],
    risks: ["若后续出现放量突破或放量失守，反身性状态可能很快从中性切换。"]
  };
}

export function summarizeReflexivitySignal(context: SymbolAnalysis["reflexivityContext"]) {
  if (context.stance === "reinforcing") {
    return `反身性加强：${context.drivers[0] ?? context.summary}`;
  }
  if (context.stance === "turning-bearish") {
    return `反身性转空：${context.drivers[0] ?? context.summary}`;
  }
  return `反身性中性：${context.drivers[0] ?? context.summary}`;
}
