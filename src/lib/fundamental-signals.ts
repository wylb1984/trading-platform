import { NewsItem, QuoteSnapshot, SymbolAnalysis } from "@/lib/types";

export function buildFundamentalContext(
  quote: QuoteSnapshot,
  news: NewsItem[]
): SymbolAnalysis["fundamentalContext"] {
  const highlights: string[] = [];
  const alerts: string[] = [];

  const pe = quote.pe ?? 0;
  const pb = quote.pb ?? 0;
  const dy = quote.dividendYield ?? 0;

  let valuation = "估值数据不足";
  let stance: SymbolAnalysis["fundamentalContext"]["stance"] = "neutral";

  if (pe > 0) {
    if (pe <= 18 && pb <= 3) {
      valuation = `估值相对克制，PE ${pe.toFixed(2)} / PB ${pb.toFixed(2)}`;
      highlights.push("估值压力相对可控，若业绩兑现，基本面可支撑中期观察。");
      stance = "supportive";
    } else if (pe >= 35 || pb >= 6) {
      valuation = `估值偏高，PE ${pe.toFixed(2)} / PB ${pb.toFixed(2)}`;
      alerts.push("估值已处高位，若业绩或指引不及预期，回撤会被放大。");
      stance = "cautious";
    } else {
      valuation = `估值中性，PE ${pe.toFixed(2)} / PB ${pb.toFixed(2)}`;
    }
  }

  const incomeProfile =
    dy >= 4
      ? `股息率 ${dy.toFixed(2)}%，偏收益型`
      : dy > 0
        ? `股息率 ${dy.toFixed(2)}%，分红贡献有限`
        : "暂无明确分红优势";

  if (dy >= 4) {
    highlights.push("分红水平较高，若现金流稳定，回撤承受力通常更强。");
  }

  if ((quote.marketCap ?? 0) >= 300_000_000_000) {
    highlights.push("市值体量大，基本面拐点通常更依赖业绩和机构资金共振。");
  }

  const eventKeywords: Array<{ words: string[]; text: string; tone: "highlight" | "alert" }> = [
    { words: ["earnings", "profit", "revenue", "guidance", "业绩", "利润", "营收", "指引"], text: "新闻里出现业绩或指引相关变化，需要重点确认是否属于基本面拐点。", tone: "alert" },
    { words: ["dividend", "股息", "分红"], text: "新闻涉及分红变化，这会直接影响收益型资金的偏好。", tone: "highlight" },
    { words: ["buyback", "回购"], text: "新闻涉及回购，通常代表管理层对估值或现金流的态度变化。", tone: "highlight" },
    { words: ["regulation", "investigation", "诉讼", "监管", "处罚"], text: "新闻涉及监管或诉讼，属于基本面风险事件，需要提高警惕。", tone: "alert" }
  ];

  const textPool = news.map((item) => `${item.title} ${item.summary}`.toLowerCase());
  for (const rule of eventKeywords) {
    if (textPool.some((text) => rule.words.some((word) => text.includes(word.toLowerCase())))) {
      if (rule.tone === "highlight") {
        highlights.push(rule.text);
      } else {
        alerts.push(rule.text);
        if (stance === "supportive") {
          stance = "neutral";
        } else {
          stance = "cautious";
        }
      }
    }
  }

  return {
    stance,
    valuation,
    incomeProfile,
    highlights: Array.from(new Set(highlights)),
    alerts: Array.from(new Set(alerts))
  };
}

export function summarizeFundamentalSignal(context: SymbolAnalysis["fundamentalContext"]) {
  if (context.alerts.length) {
    return context.alerts[0]!;
  }
  if (context.highlights.length) {
    return context.highlights[0]!;
  }
  return `${context.valuation}；${context.incomeProfile}`;
}
