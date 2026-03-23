"use client";

import Link from "next/link";
import { memo, useDeferredValue, useEffect, useRef, useState, useTransition } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  AppSettings,
  AiBrief,
  MarketOverviewItem,
  NewsItem,
  OpenClawNotificationSettings,
  QuoteSnapshot,
  SymbolAnalysis,
  TradingReview,
  WatchlistInsight,
  WatchlistItem,
  WatchlistSignalItem
} from "@/lib/types";

function formatDataStamp(lastUpdated?: string, dataSource?: string) {
  if (!lastUpdated && !dataSource) {
    return "";
  }
  const date = lastUpdated ? lastUpdated.slice(0, 10) : "";
  return [dataSource, date].filter(Boolean).join(" · ");
}

function formatDateStamp(lastUpdated?: string) {
  return lastUpdated ? lastUpdated.slice(0, 10) : "";
}

function formatCacheState(cacheState?: "fresh" | "stale") {
  if (cacheState === "stale") {
    return "缓存快照";
  }
  return "";
}

function formatAccountTail(value?: string | null) {
  if (!value || value === "N/A") {
    return "";
  }
  return value.slice(-4);
}

function formatFutuAccountLabel(account: {
  acc_id: string;
  acc_type?: string | null;
  card_num?: string | null;
  uni_card_num?: string | null;
}) {
  const uniTail = formatAccountTail(account.uni_card_num);
  const cardTail = formatAccountTail(account.card_num);
  const segments = [account.acc_type ?? "ACCOUNT"];

  if (uniTail) {
    segments.push(`统一账户尾号 ${uniTail}`);
  }

  if (cardTail && cardTail !== uniTail) {
    segments.push(`资金账户尾号 ${cardTail}`);
  }

  if (!uniTail && !cardTail) {
    segments.push(`账户尾号 ${account.acc_id.slice(-4)}`);
  }

  return segments.join(" · ");
}

function buildReviewQualityNote(review: TradingReview | null) {
  if (!review?.historyRange) {
    return null;
  }

  const notes: string[] = [];
  if (review.historyRange.from > "2020-01-01") {
    notes.push(`当前交易记录仅覆盖 ${review.historyRange.from} 至 ${review.historyRange.to}`);
  }
  notes.push("若更早的成交、初始持仓成本或完整入金流水尚未同步，月度和年度收益率仅供参考");

  return notes.join("；");
}

function containsChinese(text?: string | null) {
  if (!text) {
    return false;
  }
  return /[\u3400-\u9fff]/.test(text);
}

function buildChineseNewsSummary(item: NewsItem) {
  if (containsChinese(item.summary)) {
    return item.summary;
  }
  if (containsChinese(item.title) && !item.summary) {
    return `这条新闻主要围绕「${item.title}」展开，建议结合价格、量能和基本面继续确认影响。`;
  }
  const tone = item.sentiment === "positive" ? "偏多" : item.sentiment === "negative" ? "偏空" : "中性";
  return `${item.source || "新闻源"}提到「${item.title}」，当前情绪${tone}，建议结合价格位置、量能变化和基本面信号判断其对股价的持续影响。`;
}

function buildSignalListItems(items: WatchlistSignalItem[], mode: "opportunity" | "risk") {
  return items.slice(0, 6).map((item) => {
    const prefix = `${item.name}（${item.symbol}）`;
    const tail =
      mode === "opportunity"
        ? item.reason || item.fundamentalNote || item.reflexivityNote || "当前信号偏强。"
        : item.reason || item.unavailableReason || item.fundamentalNote || item.reflexivityNote || "当前需要保持谨慎。";
    return `${prefix}：${tail}`;
  });
}

function buildSignalSummaryText({
  bullishCandidates,
  bearishCandidates
}: {
  bullishCandidates: WatchlistSignalItem[];
  bearishCandidates: WatchlistSignalItem[];
}) {
  const leadBull = bullishCandidates.slice(0, 2).map((item) => item.name).join("、");
  const leadBear = bearishCandidates.slice(0, 2).map((item) => item.name).join("、");

  if (bullishCandidates.length && !bearishCandidates.length) {
    return `${leadBull}等 ${bullishCandidates.length} 个标的偏强，当前以机会跟踪为主。`;
  }
  if (bearishCandidates.length && !bullishCandidates.length) {
    return `${leadBear}等 ${bearishCandidates.length} 个标的风险更高，当前以防守为主。`;
  }
  if (bullishCandidates.length && bearishCandidates.length) {
    return `${leadBull}偏强，但 ${leadBear} 需重点防守；当前机会与风险并存。`;
  }
  return "当前暂无明确的偏强机会或风险信号，先继续观察盘后结构。";
}

function formatSignalLabel(signal?: WatchlistSignalItem["signal"] | null) {
  if (signal === "BUY") {
    return "偏多";
  }
  if (signal === "SELL") {
    return "偏空";
  }
  if (signal === "HOLD") {
    return "持有";
  }
  return "观察";
}

function formatFundamentalStanceLabel(stance?: "supportive" | "neutral" | "cautious") {
  if (stance === "supportive") {
    return "基本面偏强";
  }
  if (stance === "cautious") {
    return "基本面偏弱";
  }
  return "基本面中性";
}

function formatReflexivityLabel(stance?: "reinforcing" | "turning-bearish" | "neutral") {
  if (stance === "reinforcing") {
    return "反身性加强";
  }
  if (stance === "turning-bearish") {
    return "反身性转空";
  }
  return "反身性中性";
}

function formatNewsSentimentLabel(sentiment?: NewsItem["sentiment"]) {
  if (sentiment === "positive") {
    return "偏多";
  }
  if (sentiment === "negative") {
    return "偏空";
  }
  return "中性";
}

function formatTrendLabel(trend?: SymbolAnalysis["marketContext"]["trend"]) {
  if (trend === "bullish") {
    return "趋势偏多";
  }
  if (trend === "bearish") {
    return "趋势偏空";
  }
  return "趋势中性";
}

function formatMarketSentimentLabel(sentiment?: SymbolAnalysis["marketContext"]["sentiment"]) {
  if (sentiment === "hot") {
    return "情绪偏热";
  }
  if (sentiment === "cold") {
    return "情绪偏冷";
  }
  return "情绪中性";
}

function createDefaultNotificationSettings(): OpenClawNotificationSettings {
  return {
    enabled: false,
    channel: "",
    target: "",
    account: "",
    minConfidence: 60
  };
}

async function getJson<T>(input: RequestInfo, accessToken?: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  const response = await fetch(input, { ...init, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

const ReviewAnalyticsPanel = memo(function ReviewAnalyticsPanel({
  review,
  reviewLoading,
  reviewQualityNote,
  reviewReturnView,
  setReviewReturnView
}: {
  review: TradingReview | null;
  reviewLoading: boolean;
  reviewQualityNote: string | null;
  reviewReturnView: "monthly" | "yearly";
  setReviewReturnView: (value: "monthly" | "yearly") => void;
}) {
  if (!review) {
    return <div className="footer-note">{reviewLoading ? "正在加载交易复盘…" : "导入或同步交易后，这里会生成复盘摘要。"}</div>;
  }

  return (
    <>
      <div className="quote-card review-summary-card">
        <strong>复盘摘要</strong>
        <p>{review.summary}</p>
      </div>
      <div className="table-card">
        <div className="mini-grid review-kpi-grid">
          <div>
            <span>交易数</span>
            <strong>{review.totalTrades}</strong>
          </div>
          <div>
            <span>买/卖</span>
            <strong>
              {review.buys}/{review.sells}
            </strong>
          </div>
          <div>
            <span>成交额</span>
            <strong>{review.turnover.toFixed(2)}</strong>
          </div>
          <div>
            <span>胜率</span>
            <strong>{review.winRatePct.toFixed(2)}%</strong>
          </div>
        </div>
      </div>
      <div className="review-meta-strip">
        {review.historyRange ? (
          <div className="quote-card review-meta-card">
            <span>交易覆盖区间</span>
            <strong>
              {review.historyRange.from} 至 {review.historyRange.to}
            </strong>
          </div>
        ) : null}
        {reviewQualityNote ? <div className="quality-note">{reviewQualityNote}</div> : null}
      </div>
      {review.marketBreakdown.length ? (
        <div className="review-market-grid">
          <div className="review-return-toolbar">
            <strong>分市场收益拆解</strong>
            <div className="pill-row">
              <button
                className={reviewReturnView === "monthly" ? undefined : "secondary"}
                onClick={() => setReviewReturnView("monthly")}
                type="button"
              >
                月度视图
              </button>
              <button
                className={reviewReturnView === "yearly" ? undefined : "secondary"}
                onClick={() => setReviewReturnView("yearly")}
                type="button"
              >
                年度视图
              </button>
            </div>
          </div>
          {review.marketBreakdown.map((item) => (
            <div key={item.market} className="table-card review-market-card">
              <div className="detail-card-header">
                <strong>{item.label}</strong>
                <span className={`signal-badge ${item.totalReturnPct >= 0 ? "signal-bull" : "signal-bear"}`}>
                  {item.totalReturnPct.toFixed(2)}%
                </span>
              </div>
              <div className="mini-grid review-market-metrics">
                <div>
                  <span>累计收益率</span>
                  <strong>{item.totalReturnPct.toFixed(2)}%</strong>
                </div>
                <div>
                  <span>已实现盈亏</span>
                  <strong>{item.realizedPnl.toFixed(2)}</strong>
                </div>
                <div>
                  <span>浮动盈亏</span>
                  <strong>{item.unrealizedPnl.toFixed(2)}</strong>
                </div>
                <div>
                  <span>胜率</span>
                  <strong>{item.winRatePct.toFixed(2)}%</strong>
                </div>
              </div>
              <div className="review-return-block">
                <div className="review-return-table review-return-table-single">
                  <div className="detail-card-header">
                    <strong>{reviewReturnView === "monthly" ? "月度" : "年度"}</strong>
                    <span className="pill">{reviewReturnView === "monthly" ? "最近12个月" : "全量"}</span>
                  </div>
                  <table className="table compact-table">
                    <thead>
                      <tr>
                        <th>{reviewReturnView === "monthly" ? "月份" : "年份"}</th>
                        <th>收益率</th>
                        <th>盈亏</th>
                        <th>笔数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reviewReturnView === "monthly" ? item.monthlyReturns : item.yearlyReturns).length ? (
                        (reviewReturnView === "monthly" ? item.monthlyReturns : item.yearlyReturns).map((row) => (
                          <tr key={`${item.market}-${reviewReturnView}-${row.period}`}>
                            <td>{row.period}</td>
                            <td className={row.returnPct >= 0 ? "delta-up" : "delta-down"}>{row.returnPct.toFixed(2)}%</td>
                            <td>{row.pnl.toFixed(2)}</td>
                            <td>{row.trades}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4}>暂无该市场的{reviewReturnView === "monthly" ? "月度" : "年度"}可计算收益。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <div className="table-card">
        <strong>复盘重点</strong>
        <ul>
          {review.insights.map((item) => (
            <li key={item.title}>{item.detail}</li>
          ))}
        </ul>
      </div>
      <div className="detail-grid">
        <div className="table-card detail-card">
          <div className="detail-card-header">
            <strong>交易风格画像</strong>
            <span className="pill">{review.styleProfile.styleLabel}</span>
          </div>
          <div className="mini-grid review-style-metrics">
            <div>
              <span>平均持有</span>
              <strong>{review.styleProfile.avgHoldingDays.toFixed(1)} 天</strong>
            </div>
            <div>
              <span>快进快出占比</span>
              <strong>{review.styleProfile.rapidTradePct.toFixed(2)}%</strong>
            </div>
            <div>
              <span>成交集中度</span>
              <strong>{review.styleProfile.concentrationPct.toFixed(2)}%</strong>
            </div>
            <div>
              <span>偏好市场</span>
              <strong>{review.styleProfile.preferredMarkets.join(" / ") || "--"}</strong>
            </div>
          </div>
        </div>
        <div className="table-card detail-card">
          <div className="detail-card-header">
            <strong>风格优劣</strong>
            <span className="pill">基于历史成交</span>
          </div>
          <div className="review-style-grid">
            <div className="detail-subcard">
              <div className="footer-note">做得好的地方</div>
              <ul>
                {review.styleProfile.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="detail-subcard">
              <div className="footer-note">需要改进的地方</div>
              <ul>
                {review.styleProfile.weaknesses.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

export function MarketWorkbench({ initialView = "home" }: { initialView?: "home" | "dashboard" | "report" }) {
  const [priceColorMode, setPriceColorMode] = useState<"global" | "cn">("global");
  const [futuAccounts, setFutuAccounts] = useState<
    Array<{ acc_id: string; trd_env: string; acc_type?: string | null; card_num?: string | null; uni_card_num?: string | null }>
  >([]);
  const [selectedFutuAccId, setSelectedFutuAccId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ symbol: string; name: string; market: string }>>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchSignals, setWatchSignals] = useState<WatchlistSignalItem[]>([]);
  const [watchInsight, setWatchInsight] = useState<WatchlistInsight | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [watchlistEditMode, setWatchlistEditMode] = useState(false);
  const [draggingSymbol, setDraggingSymbol] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SymbolAnalysis | null>(null);
  const [overview, setOverview] = useState<MarketOverviewItem[]>([]);
  const [review, setReview] = useState<TradingReview | null>(null);
  const [importCsv, setImportCsv] = useState("symbol,market,side,quantity,price,fee,tradeDate,note");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [refreshingFutuAccounts, setRefreshingFutuAccounts] = useState(false);
  const [syncingFutu, setSyncingFutu] = useState<null | "recent" | "full">(null);
  const [probingFutuEarliest, setProbingFutuEarliest] = useState(false);
  const [futuEarliestProbeResults, setFutuEarliestProbeResults] = useState<
    Array<{
      acc_id: string;
      trd_env: string;
      acc_type?: string | null;
      card_num?: string | null;
      uni_card_num?: string | null;
      earliestTradeDate: string | null;
      sampleSymbol?: string | null;
      status: "found" | "empty" | "skipped" | "error";
      message?: string;
    }>
  >([]);
  const [reviewReturnView, setReviewReturnView] = useState<"monthly" | "yearly">("monthly");
  const [signalsLoading, setSignalsLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [openClawStatus, setOpenClawStatus] = useState<string | null>(null);
  const [openClawSending, setOpenClawSending] = useState<null | "test" | "dispatch">(null);
  const [notificationSettings, setNotificationSettings] = useState<OpenClawNotificationSettings>(createDefaultNotificationSettings());
  const [notificationConfigOpen, setNotificationConfigOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [pending, startTransition] = useTransition();
  const analysisCacheRef = useRef(new Map<string, SymbolAnalysis>());
  const syncPollTimerRef = useRef<number | null>(null);

  const selectedSignal = selectedAnalysis?.signal ?? watchSignals.find((item) => item.symbol === selectedSymbol) ?? null;
  const selectedWatchlistItem = watchlist.find((item) => item.symbol === selectedSymbol) ?? null;
  const selectedMarket = selectedWatchlistItem?.market ?? "US";
  const deferredSelectedSymbol = useDeferredValue(selectedSymbol);
  const majorIndices = overview.filter((item) =>
    ["IXIC", "GSPC", "HSI", "HSTECH", "000001.SH", "399001.SZ"].includes(item.symbol)
  );
  const watchSignalMap = new Map(watchSignals.map((item) => [item.symbol, item] as const));
  const orderedWatchSignals = watchlist.map((item) => {
    const signal = watchSignalMap.get(item.symbol);
    if (signal) {
      return signal;
    }
    return {
      symbol: item.symbol,
      market: item.market,
      name: item.symbol,
      price: null,
      changePct: null,
      signal: "WATCH" as const,
      confidence: null,
      reason: "正在加载盘后信号…",
      available: false
    };
  });
  const bullishSignalCount = watchSignals.filter((item) => item.available && item.signal === "BUY").length;
  const bearishSignalCount = watchSignals.filter((item) => item.available && item.signal === "SELL").length;
  const bullishCandidates = orderedWatchSignals.filter((item) => item.available && item.signal === "BUY");
  const bearishCandidates = orderedWatchSignals.filter((item) => item.available && item.signal === "SELL");
  const supportiveFundamentalCount = watchSignals.filter((item) => item.fundamentalTone === "supportive").length;
  const cautiousFundamentalCount = watchSignals.filter((item) => item.fundamentalTone === "cautious").length;
  const reflexiveBullCount = watchSignals.filter((item) => item.reflexivityTone === "reinforcing").length;
  const reflexiveBearCount = watchSignals.filter((item) => item.reflexivityTone === "turning-bearish").length;
  const marketBullishCount = majorIndices.filter((item) => item.available && (item.breadth === "Trend Up" || (item.changePct ?? 0) > 0)).length;
  const overviewColumns = [
    { market: "US" as const, label: "美股", items: majorIndices.filter((item) => item.market === "US") },
    { market: "HK" as const, label: "港股", items: majorIndices.filter((item) => item.market === "HK") },
    { market: "CN" as const, label: "A股", items: majorIndices.filter((item) => item.market === "CN") }
  ];
  const keyNews = selectedAnalysis?.news.slice(0, 2) ?? [];
  const reviewQualityNote = buildReviewQualityNote(review);
  const signalSummaryText = buildSignalSummaryText({
    bullishCandidates,
    bearishCandidates
  });
  const opportunityItems = buildSignalListItems(bullishCandidates, "opportunity");
  const riskItems = buildSignalListItems(bearishCandidates, "risk");

  const stopSyncPolling = () => {
    if (syncPollTimerRef.current !== null) {
      window.clearInterval(syncPollTimerRef.current);
      syncPollTimerRef.current = null;
    }
  };

  const pollSyncJob = (jobId: string, label: string) => {
    stopSyncPolling();
    syncPollTimerRef.current = window.setInterval(async () => {
      try {
        const response = await getJson<{
          ok: boolean;
          job?: {
            status: "running" | "completed" | "failed";
            progress: { completed: number; total: number };
            message: string;
            imported?: number;
            includedAccounts?: Array<{ acc_id: string; trd_env: string; acc_type?: string | null; card_num?: string | null; uni_card_num?: string | null }>;
          };
        }>(`/api/trades/sync?provider=futu&jobId=${encodeURIComponent(jobId)}`, session?.access_token);
        const job = response.job;
        if (!job) {
          return;
        }

        setSyncStatus(`${label}：${job.message}（${job.progress.completed}/${job.progress.total}）`);

        if (job.status === "completed" || job.status === "failed") {
          stopSyncPolling();
          setSyncingFutu(null);
          setSyncStatus(null);
          const includedAccountText =
            job.includedAccounts?.length
              ? ` 本次纳入：${job.includedAccounts.map((item) => formatFutuAccountLabel(item)).join("、")}。`
              : "";
          setSyncMessage(`${label}：${job.message}${includedAccountText}`);
          if (job.status === "completed") {
            const reviewData = await getJson<TradingReview>("/api/review", session?.access_token);
            setReview(reviewData);
            setError(null);
          } else {
            setError(job.message);
          }
        }
      } catch (nextError) {
        stopSyncPolling();
        setSyncingFutu(null);
        setSyncStatus(null);
        setError(nextError instanceof Error ? nextError.message : "poll futu sync failed");
      }
    }, 1500);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const saved = window.localStorage.getItem("price-color-mode");
    if (saved === "cn" || saved === "global") {
      setPriceColorMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem("price-color-mode", priceColorMode);
  }, [priceColorMode]);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) {
      return;
    }

    client.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    });

    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setUser(nextSession?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const syncSessionCookie = async () => {
      if (session?.access_token) {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: session.access_token })
        });
        return;
      }
      await fetch("/api/auth/session", { method: "DELETE" });
    };

    void syncSessionCookie();
  }, [session?.access_token]);

  useEffect(() => () => stopSyncPolling(), []);

  useEffect(() => {
    startTransition(async () => {
      try {
        const [overviewData, watchlistData, settingsData] = await Promise.all([
          getJson<{ items: MarketOverviewItem[] }>("/api/overview", session?.access_token),
          getJson<{ items: WatchlistItem[] }>("/api/watchlist", session?.access_token),
          getJson<AppSettings>("/api/settings", session?.access_token)
        ]);

        setOverview(overviewData.items);
        setWatchlist(watchlistData.items);
        setNotificationSettings(settingsData.notificationConfig ?? createDefaultNotificationSettings());

        const firstSymbol = watchlistData.items[0]?.symbol ?? "";
        setSelectedSymbol((current) => current || firstSymbol);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "load failed");
      }
    });
  }, [session?.access_token]);

  useEffect(() => {
    if (!watchlist.length) {
      setWatchSignals([]);
      setWatchInsight(null);
      setSelectedSymbol("");
      return;
    }

    if (!watchlist.some((item) => item.symbol === selectedSymbol)) {
      setSelectedSymbol(watchlist[0]?.symbol ?? "");
    }
  }, [selectedSymbol, watchlist]);

  useEffect(() => {
    if (!watchlist.length) {
      setWatchSignals([]);
      setWatchInsight(null);
      return;
    }

    setSignalsLoading(true);
    void getJson<{ items: WatchlistSignalItem[]; insight: WatchlistInsight }>("/api/watchlist/signals", session?.access_token)
      .then((data) => {
        setWatchSignals(data.items);
        setWatchInsight(data.insight);
        setError(null);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "load signals failed");
      })
      .finally(() => setSignalsLoading(false));
  }, [session?.access_token, watchlist]);

  useEffect(() => {
    setReviewLoading(true);
    void getJson<TradingReview>("/api/review", session?.access_token)
      .then((data) => {
        setReview(data);
        setError(null);
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "load review failed");
      })
      .finally(() => setReviewLoading(false));
  }, [session?.access_token]);

  useEffect(() => {
    if (!watchlist.length) {
      return;
    }
    void (async () => {
      try {
        await fetch("/api/watchlist/prewarm", {
          method: "POST",
          headers: session?.access_token ? { authorization: `Bearer ${session.access_token}` } : undefined
        });
        const data = await getJson<{ items: WatchlistSignalItem[]; insight: WatchlistInsight }>(
          "/api/watchlist/signals",
          session?.access_token
        );
        setWatchSignals(data.items);
        setWatchInsight(data.insight);
      } catch {
        // keep the last rendered signals if prewarm refresh fails
      }
    })();
  }, [session?.access_token, watchlist]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await getJson<{
          ok: boolean;
          accounts?: Array<{ acc_id: string; trd_env: string; acc_type?: string | null; card_num?: string | null; uni_card_num?: string | null }>;
        }>("/api/trades/sync?provider=futu", session?.access_token);
        const accounts = response.accounts ?? [];
        setFutuAccounts(accounts);
        setSelectedFutuAccId((current) => (current && accounts.some((item) => item.acc_id === current) ? current : ""));
      } catch {}
    })();
  }, [session?.access_token]);

  useEffect(() => {
    if (!deferredSelectedSymbol) {
      return;
    }

    const cacheKey = `${deferredSelectedSymbol}:${selectedMarket}`;
    const cached = analysisCacheRef.current.get(cacheKey);
    if (cached) {
      setSelectedAnalysis(cached);
    }

    const controller = new AbortController();
    setDetailLoading(!cached);

    void (async () => {
      try {
        const analysisData = await getJson<SymbolAnalysis>(
          `/api/symbol-analysis?symbol=${encodeURIComponent(deferredSelectedSymbol)}&market=${encodeURIComponent(selectedMarket)}`,
          session?.access_token,
          { signal: controller.signal }
        );
        analysisCacheRef.current.set(cacheKey, analysisData);
        setSelectedAnalysis(analysisData);
        setError(null);
      } catch (nextError) {
        if ((nextError as Error).name !== "AbortError") {
          setError(nextError instanceof Error ? nextError.message : "detail failed");
        }
      } finally {
        if (!controller.signal.aborted) {
          setDetailLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [deferredSelectedSymbol, selectedMarket, session?.access_token]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeout = setTimeout(() => {
      void getJson<{ items: Array<{ symbol: string; name: string; market: string }> }>(
        `/api/search?q=${encodeURIComponent(searchQuery)}`,
        session?.access_token
      )
        .then((data) => setSearchResults(data.items.slice(0, 8)))
        .catch(() => setSearchResults([]));
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery, session?.access_token]);

  const addToWatchlist = (item: { symbol: string; market: string }) => {
    startTransition(async () => {
      try {
        const response = await getJson<{ items: WatchlistItem[] }>("/api/watchlist", session?.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: { symbol: item.symbol, market: item.market } })
        });
        setWatchlist(response.items);
        setSelectedSymbol(item.symbol);
        setSearchQuery("");
        setSearchResults([]);

        const signals = await getJson<{ items: WatchlistSignalItem[]; insight: WatchlistInsight }>("/api/watchlist/signals", session?.access_token);
        setWatchSignals(signals.items);
        setWatchInsight(signals.insight);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "add watchlist failed");
      }
    });
  };

  const saveWatchlistOrder = (items: WatchlistItem[]) => {
    startTransition(async () => {
      try {
        const response = await getJson<{ items: WatchlistItem[] }>("/api/watchlist", session?.access_token, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        });
        setWatchlist(response.items);
        const signals = await getJson<{ items: WatchlistSignalItem[]; insight: WatchlistInsight }>(
          "/api/watchlist/signals",
          session?.access_token
        );
        setWatchSignals(signals.items);
        setWatchInsight(signals.insight);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "save order failed");
      }
    });
  };

  const removeFromWatchlist = (symbol: string) => {
    startTransition(async () => {
      try {
        const response = await getJson<{ items: WatchlistItem[] }>(
          `/api/watchlist?symbol=${encodeURIComponent(symbol)}`,
          session?.access_token,
          { method: "DELETE" }
        );
        setWatchlist(response.items);
        const nextSelected = response.items[0]?.symbol ?? "";
        setSelectedSymbol(nextSelected);
        const signals = await getJson<{ items: WatchlistSignalItem[]; insight: WatchlistInsight }>(
          "/api/watchlist/signals",
          session?.access_token
        );
        setWatchSignals(signals.items);
        setWatchInsight(signals.insight);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "remove watchlist failed");
      }
    });
  };

  const sendOpenClawNotification = (mode: "test" | "dispatch") => {
    startTransition(async () => {
      try {
        setOpenClawSending(mode);
        setOpenClawStatus(null);
        const response = await getJson<{
          ok: boolean;
          skipped?: boolean;
          reason?: string;
          important?: number;
          sentAt?: string;
        }>("/api/notifications/openclaw", session?.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "test"
              ? {
                  test: true,
                  channel: notificationSettings.channel,
                  target: notificationSettings.target,
                  account: notificationSettings.account
                }
              : {
                  scope: "MIXED",
                  channel: notificationSettings.channel,
                  target: notificationSettings.target,
                  account: notificationSettings.account
                }
          )
        });
        if (response.skipped) {
          setOpenClawStatus(response.reason ?? "当前没有需要发送的通知。");
        } else if (mode === "test") {
          setOpenClawStatus("OpenClaw 测试通知已发送。");
        } else {
          setOpenClawStatus(`已发送 ${response.important ?? 0} 个重要信号通知。`);
        }
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "openclaw notify failed");
      } finally {
        setOpenClawSending(null);
      }
    });
  };

  const saveNotificationSettings = () => {
    startTransition(async () => {
      try {
        setSettingsSaving(true);
        const currentSettings = await getJson<AppSettings>("/api/settings", session?.access_token);
        const nextSettings: AppSettings = {
          ...currentSettings,
          notificationConfig: {
            ...notificationSettings,
            minConfidence: Math.max(0, Math.min(100, Number(notificationSettings.minConfidence || 0)))
          }
        };
        const saved = await getJson<AppSettings>("/api/settings", session?.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextSettings)
        });
        setNotificationSettings(saved.notificationConfig);
        setOpenClawStatus("通知配置已保存。");
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "save notification settings failed");
      } finally {
        setSettingsSaving(false);
      }
    });
  };

  const moveWatchlistItem = (fromSymbol: string, toSymbol: string) => {
    if (fromSymbol === toSymbol) {
      return;
    }
    const current = [...watchlist];
    const fromIndex = current.findIndex((item) => item.symbol === fromSymbol);
    const toIndex = current.findIndex((item) => item.symbol === toSymbol);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setWatchlist(current);
    saveWatchlistOrder(current);
  };

  const importTrades = () => {
    startTransition(async () => {
      try {
        const response = await getJson<{ imported: number; provider?: string; errors?: string[] }>("/api/trades/import", session?.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: importCsv })
        });
        const reviewData = await getJson<TradingReview>("/api/review", session?.access_token);
        setReview(reviewData);
        setSyncMessage(
          `${response.provider ? `${response.provider.toUpperCase()} ` : ""}CSV 已导入 ${response.imported} 笔交易${response.errors?.length ? `，另有 ${response.errors.length} 行跳过` : ""}。`
        );
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "import failed");
      }
    });
  };

  const syncTrades = (provider: "futu" | "ib") => {
    startTransition(async () => {
      try {
        const response = await getJson<{ message: string; imported?: number }>("/api/trades/sync", session?.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, csv: importCsv })
        });
        if (response.imported) {
          const reviewData = await getJson<TradingReview>("/api/review", session?.access_token);
          setReview(reviewData);
        }
        setSyncMessage(response.message);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "sync failed");
      }
    });
  };

  const refreshFutuAccounts = () => {
    startTransition(async () => {
      setRefreshingFutuAccounts(true);
      setSyncStatus("正在刷新富途账户列表…");
      try {
        const response = await getJson<{
          ok: boolean;
          accounts?: Array<{ acc_id: string; trd_env: string; acc_type?: string | null; card_num?: string | null; uni_card_num?: string | null }>;
        }>("/api/trades/sync?provider=futu", session?.access_token);
        const accounts = response.accounts ?? [];
        setFutuAccounts(accounts);
        setSelectedFutuAccId((current) => (current && accounts.some((item) => item.acc_id === current) ? current : ""));
        setSyncMessage(`已刷新富途账户，共识别 ${accounts.length} 个可选账户；默认会合并全部账户同步。`);
        setSyncStatus(null);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "refresh futu accounts failed");
        setSyncStatus(null);
      } finally {
        setRefreshingFutuAccounts(false);
      }
    });
  };

  const probeFutuEarliestTrades = () => {
    startTransition(async () => {
      setProbingFutuEarliest(true);
      setSyncStatus("正在探测各个富途子账户最早可查询成交日期…");
      try {
        const response = await getJson<{
          ok: boolean;
          results?: Array<{
            acc_id: string;
            trd_env: string;
            acc_type?: string | null;
            card_num?: string | null;
            uni_card_num?: string | null;
            earliestTradeDate: string | null;
            sampleSymbol?: string | null;
            status: "found" | "empty" | "skipped" | "error";
            message?: string;
          }>;
        }>("/api/trades/sync?provider=futu&inspect=earliest&start=2020-01-01", session?.access_token);
        setFutuEarliestProbeResults(response.results ?? []);
        setSyncMessage("已完成最早成交探测。");
        setSyncStatus(null);
        setError(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "probe futu earliest failed");
        setSyncStatus(null);
      } finally {
        setProbingFutuEarliest(false);
      }
    });
  };

  const syncFutuRange = (start: string, end: string, label: string, mode: "recent" | "full") => {
    startTransition(async () => {
      setSyncingFutu(mode);
      setSyncStatus(
        mode === "full"
          ? "正在从 2020 年开始分段拉取富途历史成交，首次同步会比较慢。"
          : "正在同步富途最近 180 天成交…"
      );
      try {
        const response = await getJson<{
          message: string;
          imported?: number;
          windows?: number;
          async?: boolean;
          jobId?: string;
          includedAccounts?: Array<{ acc_id: string; trd_env: string; acc_type?: string | null; card_num?: string | null; uni_card_num?: string | null }>;
        }>("/api/trades/sync", session?.access_token, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "futu",
            start,
            end,
            accId: selectedFutuAccId || undefined,
            trdEnv: "REAL",
            async: true
          })
        });
        const includedAccountText =
          response.includedAccounts?.length
            ? ` 本次纳入：${response.includedAccounts.map((item) => formatFutuAccountLabel(item)).join("、")}。`
            : "";
        setSyncMessage(`${label}：${response.message}${response.windows ? ` 共分 ${response.windows} 段拉取。` : ""}${includedAccountText}`);
        setError(null);
        if (response.jobId) {
          pollSyncJob(response.jobId, label);
          return;
        }
        setSyncStatus(null);
        setSyncingFutu(null);
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : "futu history sync failed");
        setSyncStatus(null);
        setSyncingFutu(null);
      }
    });
  };

  const syncFutuHistory = () => {
    const end = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 180 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    syncFutuRange(start, end, "近180天同步", "recent");
  };

  const syncFutuSince2020 = () => {
    const end = new Date().toISOString().slice(0, 10);
    syncFutuRange("2020-01-01", end, "2020年至今同步", "full");
  };

  const signIn = () => {
    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError("Supabase browser client is not configured");
        return;
      }
      const { error: authError } = await client.auth.signInWithPassword({ email: authEmail, password: authPassword });
      setError(authError?.message ?? null);
    });
  };

  const signUp = () => {
    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        setError("Supabase browser client is not configured");
        return;
      }
      const { error: authError } = await client.auth.signUp({ email: authEmail, password: authPassword });
      setError(authError?.message ?? "注册请求已提交，请检查邮箱确认设置。");
    });
  };

  const signOut = () => {
    startTransition(async () => {
      const client = getSupabaseBrowserClient();
      if (!client) {
        return;
      }
      const { error: authError } = await client.auth.signOut();
      setError(authError?.message ?? null);
    });
  };

  return (
    <div className={`shell ${priceColorMode === "cn" ? "cn-colors" : ""}`}>
      <div className="panel section" style={{ marginBottom: 18 }}>
        <div className="quote-line">
            <div>
              <div className="eyebrow">Stock Desk</div>
              <h2 style={{ marginBottom: 4 }}>{initialView === "report" ? "交易与信号报告" : "自选股交易信号工作台"}</h2>
            <p style={{ marginBottom: 0 }}>先看搜索、指数环境和交易信号，再看标的细节与交易复盘。</p>
            </div>
          <div className="button-row">
            <button className="secondary" type="button" onClick={() => setPriceColorMode((value) => (value === "cn" ? "global" : "cn"))}>
              {priceColorMode === "cn" ? "红涨绿跌" : "绿涨红跌"}
            </button>
            {user ? (
              <>
                <span className="pill">{user.email}</span>
                <Link className="button-link" href={initialView === "home" ? "/dashboard" : "/"}>
                  {initialView === "home" ? "进入 Dashboard" : "返回首页"}
                </Link>
                <Link className="button-link" href="/dashboard/report">
                  报告页
                </Link>
                <button className="secondary" onClick={signOut}>
                  登出
                </button>
              </>
            ) : (
              <>
                <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="邮箱" style={{ maxWidth: 180 }} />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(event) => setAuthPassword(event.target.value)}
                  placeholder="密码"
                  style={{ maxWidth: 160 }}
                />
                <button onClick={signIn}>登录</button>
                <button className="secondary" onClick={signUp}>
                  注册
                </button>
              </>
            )}
          </div>
        </div>
        {error ? <p className="footer-note">{error}</p> : null}
        {syncMessage ? <p className="footer-note">{syncMessage}</p> : null}
      </div>

      <section className="stack-stage">
        <div className="panel section compact-section">
          <h2>2. 三大市场指数多空概览</h2>
          <p>基于盘后日线，快速判断美股、港股、A 股环境偏多还是偏空。</p>
          <div className="market-overview-grid">
            {overviewColumns.map((column) => (
              <div className="market-overview-column" key={column.market}>
                <div className="market-overview-column-header">
                  <strong>{column.label}</strong>
                </div>
                <div className="cards">
                  {column.items.map((item) => {
                    const bullish = item.available && (item.breadth === "Trend Up" || (item.changePct ?? 0) > 0);
                    return (
                      <div className="market-strip" key={item.symbol}>
                        <div className="market-strip-main">
                          <strong>{item.name}</strong>
                          <div className="market-strip-meta">
                            <span className="market-strip-code">{item.symbol}</span>
                          </div>
                        </div>
                        <div className="market-strip-metrics">
                          <strong className="headline-number">{item.price === null ? "--" : item.price.toFixed(2)}</strong>
                          <span className={item.changePct !== null && item.changePct >= 0 ? "delta-up" : "delta-down"}>
                            {item.changePct === null ? "--" : `${item.changePct.toFixed(2)}%`}
                          </span>
                          <span className={`signal-badge ${item.available ? (bullish ? "signal-bull" : "signal-bear") : "signal-neutral"}`}>
                            {bullish ? "偏多" : "偏空"}
                          </span>
                        </div>
                        <div className="footer-note compact-meta">
                          {[formatDateStamp(item.lastUpdated), item.dataSource, formatCacheState(item.cacheState)].filter(Boolean).join(" · ") || "等待盘后快照"}
                        </div>
                        {!item.available && item.unavailableReason ? <div className="footer-note compact-meta">{item.unavailableReason}</div> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel section compact-section">
          <h2>3. 自选股最新交易信号分析总结</h2>
          <p>基于盘后数据，结合技术面、情绪面和缠论结构，给出当前机会与风险。</p>
          {orderedWatchSignals.length ? (
            <div className="brief">
              <div className="signal-summary-shell">
                <div className="quote-card signal-summary-headline">
                  <div>
                    <strong>今日结论</strong>
                    <p>{signalSummaryText}</p>
                  </div>
                  <div>
                    <div className="signal-summary-pills">
                      <span className={`signal-badge ${marketBullishCount >= 3 ? "signal-bull" : "signal-bear"}`}>
                        市场环境 {marketBullishCount >= 3 ? "偏多" : "偏谨慎"}
                      </span>
                      <span className={`signal-badge ${supportiveFundamentalCount >= cautiousFundamentalCount ? "signal-bull" : "signal-bear"}`}>
                        基本面 {supportiveFundamentalCount >= cautiousFundamentalCount ? "中性偏稳" : "风险增多"}
                      </span>
                      <span className={`signal-badge ${reflexiveBullCount >= reflexiveBearCount ? "signal-bull" : "signal-bear"}`}>
                        反身性 {reflexiveBullCount > reflexiveBearCount ? "偏加强" : reflexiveBearCount > reflexiveBullCount ? "偏转空" : "待观察"}
                      </span>
                    </div>
                    <div className="button-row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                      <button className="secondary" onClick={() => setNotificationConfigOpen((value) => !value)} type="button">
                        {notificationConfigOpen ? "收起通知配置" : "通知配置"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => sendOpenClawNotification("test")}
                        type="button"
                        disabled={openClawSending !== null}
                      >
                        {openClawSending === "test" ? "发送中…" : "测试通知"}
                      </button>
                      <button onClick={() => sendOpenClawNotification("dispatch")} type="button" disabled={openClawSending !== null}>
                        {openClawSending === "dispatch" ? "推送中…" : "推送重要信号"}
                      </button>
                    </div>
                    {notificationConfigOpen ? (
                      <div className="table-card notification-config-card">
                        <div className="detail-card-header">
                          <strong>通知配置</strong>
                          <span className="pill">{notificationSettings.enabled ? "已启用" : "未启用"}</span>
                        </div>
                        <div className="controls notification-config-grid">
                          <label className="field-inline checkbox-field">
                            <span>启用自动通知</span>
                            <input
                              type="checkbox"
                              checked={notificationSettings.enabled}
                              onChange={(event) =>
                                setNotificationSettings((current) => ({ ...current, enabled: event.target.checked }))
                              }
                            />
                          </label>
                          <label className="field-inline">
                            <span>通道</span>
                            <input
                              value={notificationSettings.channel}
                              onChange={(event) =>
                                setNotificationSettings((current) => ({ ...current, channel: event.target.value }))
                              }
                              placeholder="feishu / openclaw-weixin"
                            />
                          </label>
                          <label className="field-inline">
                            <span>账号</span>
                            <input
                              value={notificationSettings.account ?? ""}
                              onChange={(event) =>
                                setNotificationSettings((current) => ({ ...current, account: event.target.value }))
                              }
                              placeholder="可留空"
                            />
                          </label>
                          <label className="field-inline">
                            <span>目标 ID</span>
                            <input
                              value={notificationSettings.target}
                              onChange={(event) =>
                                setNotificationSettings((current) => ({ ...current, target: event.target.value }))
                              }
                              placeholder="用户 ID / 群 ID"
                            />
                          </label>
                          <label className="field-inline">
                            <span>最低置信度</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={notificationSettings.minConfidence}
                              onChange={(event) =>
                                setNotificationSettings((current) => ({
                                  ...current,
                                  minConfidence: Number(event.target.value || 0)
                                }))
                              }
                            />
                          </label>
                        </div>
                        <div className="button-row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
                          <button onClick={saveNotificationSettings} type="button" disabled={settingsSaving || openClawSending !== null}>
                            {settingsSaving ? "保存中…" : "保存通知配置"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {openClawStatus ? <div className="footer-note compact-meta">{openClawStatus}</div> : null}
                  </div>
                </div>
              </div>
              <div className="signal-boards">
                <div className="table-card signal-board signal-board-positive">
                  <div className="signal-board-header">
                    <strong>重点机会</strong>
                    <span className="signal-badge signal-bull">{bullishSignalCount}</span>
                  </div>
                  {opportunityItems.length ? (
                    <ul>
                      {opportunityItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="footer-note compact-meta">当前没有明确偏强机会。</div>
                  )}
                </div>
                <div className="table-card signal-board signal-board-negative">
                  <div className="signal-board-header">
                    <strong>主要风险</strong>
                    <span className="signal-badge signal-bear">{bearishSignalCount}</span>
                  </div>
                  {riskItems.length ? (
                    <ul>
                      {riskItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="footer-note compact-meta">当前没有明确风险标的。</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="footer-note">先添加自选股后这里会生成信号总结。</div>
          )}
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: "1fr", gap: 14 }}>
        <div className="panel section">
          <h2>4. 自选股列表</h2>
          <div className="detail-stage">
            <div className="table-card">
              <div className="watchlist-toolbar" style={{ marginBottom: 12 }}>
                <div className="watchlist-toolbar-main">
                  <strong>自选股列表</strong>
                  <div className="watchlist-search-shell">
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="搜索并添加：AAPL / 0700.HK / 贵州茅台"
                    />
                  </div>
                </div>
                <div className="button-row">
                  {signalsLoading ? <span className="pill">正在加载信号</span> : null}
                  <button className="secondary" onClick={() => setWatchlistEditMode((value) => !value)}>
                    {watchlistEditMode ? "完成编辑" : "编辑自选"}
                  </button>
                </div>
              </div>
              <div className="watchlist-search-results" style={{ maxHeight: searchResults.length ? 180 : 0, overflow: "auto" }}>
                {searchResults.map((item) => (
                  <div className="quote-card compact-card" key={item.symbol}>
                    <div className="quote-line">
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.symbol}</p>
                      </div>
                      <div className="button-row">
                        <span className="pill">{item.market}</span>
                        <button onClick={() => addToWatchlist(item)}>加入自选</button>
                      </div>
                    </div>
                  </div>
                ))}
                {searchQuery && searchResults.length === 0 ? <div className="footer-note">没有匹配结果</div> : null}
              </div>
              <table className="table watchlist-table">
                <thead>
                  <tr>
                    <th>名称</th>
                    <th>代码</th>
                    <th>价格</th>
                    <th>涨跌幅</th>
                    <th>信号</th>
                    {watchlistEditMode ? <th>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {orderedWatchSignals.map((item) => (
                    <tr
                      key={item.symbol}
                      onClick={() => {
                        if (item.symbol === selectedSymbol) {
                          return;
                        }
                        startTransition(() => setSelectedSymbol(item.symbol));
                      }}
                      className={item.symbol === selectedSymbol ? "is-active" : undefined}
                      style={{ cursor: "pointer" }}
                      draggable={watchlistEditMode}
                      onDragStart={() => setDraggingSymbol(item.symbol)}
                      onDragOver={(event) => {
                        if (watchlistEditMode) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={() => {
                        if (watchlistEditMode && draggingSymbol) {
                          moveWatchlistItem(draggingSymbol, item.symbol);
                        }
                        setDraggingSymbol(null);
                      }}
                      onDragEnd={() => setDraggingSymbol(null)}
                    >
                      <td className="watchlist-symbol-cell">
                        <strong>{item.name}</strong>
                      </td>
                      <td className="watchlist-code-cell">
                        <span>{item.symbol}</span>
                      </td>
                      <td className="watchlist-price-cell">
                        <strong className="headline-number">{item.price === null ? "--" : item.price.toFixed(2)}</strong>
                      </td>
                      <td className="watchlist-change-cell">
                        <span className={item.changePct !== null && item.changePct >= 0 ? "delta-up" : "delta-down"}>
                          {item.changePct === null ? "--" : `${item.changePct.toFixed(2)}%`}
                        </span>
                      </td>
                      <td className="watchlist-signal-cell">
                        <div className="pill-row">
                          <span
                            className={`signal-badge ${
                              !item.available
                                ? "signal-neutral"
                                : item.signal === "BUY"
                                ? "signal-bull"
                                : item.signal === "SELL"
                                  ? "signal-bear"
                                  : "signal-neutral"
                            }`}
                          >
                            {item.available ? formatSignalLabel(item.signal) : item.price === null ? "无数据" : "待确认"}
                          </span>
                        </div>
                      </td>
                      {watchlistEditMode ? (
                        <td>
                          <div className="button-row">
                            <span className="drag-handle">拖拽排序</span>
                            <button
                              className="secondary"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeFromWatchlist(item.symbol);
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="detail-column">
              {selectedAnalysis ? (
                <div className="quote-card emphatic-card detail-hero-card">
                  <div className="detail-hero-top">
                    <div className="detail-hero-title">
                      <div className="detail-hero-title-row">
                        <strong>{selectedAnalysis.quote.name}</strong>
                        <span className="footer-note compact-meta detail-hero-code">
                          {selectedAnalysis.quote.symbol} · {selectedAnalysis.quote.exchange}
                        </span>
                      </div>
                      <div className="pill-row detail-hero-pills">
                        <span className="pill">{selectedAnalysis.quote.market}</span>
                        <span className={`signal-badge ${selectedSignal?.signal === "BUY" ? "signal-bull" : selectedSignal?.signal === "SELL" ? "signal-bear" : "signal-neutral"}`}>
                          {formatSignalLabel(selectedSignal?.signal)}
                        </span>
                        <span className={`signal-badge ${selectedAnalysis.reflexivityContext.stance === "reinforcing" ? "signal-bull" : selectedAnalysis.reflexivityContext.stance === "turning-bearish" ? "signal-bear" : "signal-neutral"}`}>
                          {formatReflexivityLabel(selectedAnalysis.reflexivityContext.stance)}
                        </span>
                        <span className="pill">{formatTrendLabel(selectedAnalysis.marketContext.trend)}</span>
                        <span className="pill">{formatMarketSentimentLabel(selectedAnalysis.marketContext.sentiment)}</span>
                        <span className="confidence-chip">置信度 {selectedSignal?.confidence ?? "--"}</span>
                      </div>
                      <div className="footer-note compact-meta detail-hero-source">
                        {[formatDataStamp(selectedAnalysis.quote.lastUpdated, selectedAnalysis.quote.dataSource), formatCacheState(selectedAnalysis.quote.cacheState)]
                          .filter(Boolean)
                          .join(" · ") || "暂无来源信息"}
                      </div>
                    </div>
                    <div className="detail-price-block">
                      <strong className="detail-price">{selectedAnalysis.quote.price.toFixed(2)}</strong>
                      <div className={selectedAnalysis.quote.changePct >= 0 ? "delta-up detail-delta" : "delta-down detail-delta"}>
                        {selectedAnalysis.quote.changePct.toFixed(2)}%
                      </div>
                      {detailLoading ? <div className="footer-note compact-meta">正在刷新详情…</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}
              {selectedAnalysis ? (
                <div className="table-card detail-card">
                  <div className="detail-card-header">
                    <strong>当前执行判断</strong>
                    <span className="pill">缠论结构</span>
                  </div>
                  <p>{selectedAnalysis.signal.reason}</p>
                  <div className="detail-subcard">
                    <div className="footer-note">结构判断</div>
                    <strong>{selectedAnalysis.marketContext.chanState}</strong>
                  </div>
                </div>
              ) : null}
              {selectedAnalysis ? (
                <div className="detail-grid">
                  <div className="table-card detail-card">
                    <div className="detail-card-header">
                      <strong>结论与动作</strong>
                      <span className="confidence-chip">置信度 {selectedSignal?.confidence ?? "--"}</span>
                    </div>
                    <p>{selectedAnalysis.brief.summary}</p>
                    <ul>
                      {selectedAnalysis.brief.actionPlan.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="table-card detail-card">
                    <div className="detail-card-header">
                      <strong>关键价位</strong>
                      <span className="pill">盘后区间</span>
                    </div>
                    <div className="detail-levels">
                      <div className="detail-level detail-level-support">
                        <span>支撑</span>
                        <strong>{selectedAnalysis.importantLevels.support}</strong>
                      </div>
                      <div className="detail-level detail-level-resistance">
                        <span>压力</span>
                        <strong>{selectedAnalysis.importantLevels.resistance}</strong>
                      </div>
                    </div>
                    <p className="footer-note compact-meta">
                      优先看关键位附近是否出现放量确认或跌破失守。
                    </p>
                  </div>
                </div>
              ) : null}
              {selectedAnalysis ? (
                <div className="table-card detail-card">
                  <div className="detail-card-header">
                    <strong>基本面信号</strong>
                    <span className={`signal-badge ${selectedAnalysis.fundamentalContext.stance === "supportive" ? "signal-bull" : selectedAnalysis.fundamentalContext.stance === "cautious" ? "signal-bear" : "signal-neutral"}`}>
                      {formatFundamentalStanceLabel(selectedAnalysis.fundamentalContext.stance)}
                    </span>
                  </div>
                  <p>
                    {selectedAnalysis.fundamentalContext.valuation}；{selectedAnalysis.fundamentalContext.incomeProfile}
                  </p>
                  <div className="detail-grid detail-grid-wide">
                    <div className="detail-subcard">
                      <div className="footer-note">正向提示</div>
                      <ul>
                        {(selectedAnalysis.fundamentalContext.highlights.length
                          ? selectedAnalysis.fundamentalContext.highlights
                          : ["当前没有额外的基本面正向催化。"]).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="detail-subcard">
                      <div className="footer-note">重大变化 / 风险提示</div>
                      <ul>
                        {(selectedAnalysis.fundamentalContext.alerts.length
                          ? selectedAnalysis.fundamentalContext.alerts
                          : ["当前没有检测到明确的基本面风险事件。"]).map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
              {selectedAnalysis ? (
                <div className="detail-grid">
                  <div className="table-card detail-card">
                    <div className="detail-card-header">
                      <strong>机会与催化</strong>
                      <span className="signal-badge signal-bull">{selectedAnalysis.opportunities.length}</span>
                    </div>
                    <ul>
                      {selectedAnalysis.opportunities.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="table-card detail-card">
                    <div className="detail-card-header">
                      <strong>风险与失效条件</strong>
                      <span className="signal-badge signal-bear">{selectedAnalysis.risks.length}</span>
                    </div>
                    <ul>
                      {selectedAnalysis.risks.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              {selectedAnalysis ? (
                <div className="table-card detail-card">
                  <div className="detail-card-header">
                    <strong>反身性框架</strong>
                    <span className={`signal-badge ${selectedAnalysis.reflexivityContext.stance === "reinforcing" ? "signal-bull" : selectedAnalysis.reflexivityContext.stance === "turning-bearish" ? "signal-bear" : "signal-neutral"}`}>
                      {formatReflexivityLabel(selectedAnalysis.reflexivityContext.stance)}
                    </span>
                  </div>
                  <p>{selectedAnalysis.reflexivityContext.summary}</p>
                  <div className="detail-grid detail-grid-wide">
                    <div className="detail-subcard">
                      <div className="footer-note">强化驱动</div>
                      <ul>
                        {selectedAnalysis.reflexivityContext.drivers.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="detail-subcard">
                      <div className="footer-note">失效风险</div>
                      <ul>
                        {selectedAnalysis.reflexivityContext.risks.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
              {selectedAnalysis ? (
                <div className="table-card detail-card">
                    <div className="detail-card-header">
                      <strong>重要新闻</strong>
                      <span className="pill">{keyNews.length}</span>
                    </div>
                    <div className="news-list">
                      {(keyNews.length
                        ? keyNews
                        : [{ id: "none", title: "暂无重要新闻", summary: "当前没有可展示的相关新闻。", source: "", publishedAt: "", url: "", sentiment: "neutral" as const, symbols: [] }]).map((item) => (
                        <div key={item.id} className="news-row">
                          <div className="news-row-header">
                            <strong>{item.title}</strong>
                            {item.sentiment ? (
                              <span className={`signal-badge ${item.sentiment === "positive" ? "signal-bull" : item.sentiment === "negative" ? "signal-bear" : "signal-neutral"}`}>
                                {formatNewsSentimentLabel(item.sentiment)}
                              </span>
                            ) : null}
                          </div>
                          <p>{buildChineseNewsSummary(item)}</p>
                        </div>
                      ))}
                    </div>
                    {selectedAnalysis.news.length > keyNews.length ? (
                      <div className="footer-note compact-meta">其余新闻已折叠，避免页面过长。</div>
                    ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="panel section">
          <h2>5. 交易复盘</h2>
          <p>一页看执行质量、活跃度和主要风险点，同时支持 CSV 导入、富途自动同步和 IB CSV 同步。</p>
          <div className="review-stage">
            <div className="table-card">
              <strong>导入或同步交易记录</strong>
              <div className="controls" style={{ gridTemplateColumns: "1fr" }}>
                <div className="sync-strip">
                  <div className="sync-strip-main">
                    <strong>富途账户</strong>
                    <div className="sync-inline">
                      <select value={selectedFutuAccId} onChange={(event) => setSelectedFutuAccId(event.target.value)}>
                        <option value="">全部账户（合并）</option>
                        {futuAccounts.map((item) => (
                          <option key={item.acc_id} value={item.acc_id}>
                            {formatFutuAccountLabel(item)}
                          </option>
                        ))}
                      </select>
                      <button className="secondary" onClick={refreshFutuAccounts} disabled={refreshingFutuAccounts || syncingFutu !== null}>
                        {refreshingFutuAccounts ? "正在刷新…" : "刷新账户"}
                      </button>
                      <button onClick={syncFutuHistory} disabled={refreshingFutuAccounts || syncingFutu !== null}>
                        {syncingFutu === "recent" ? "正在同步…" : "同步富途近180天"}
                      </button>
                      <button className="secondary" onClick={syncFutuSince2020} disabled={refreshingFutuAccounts || syncingFutu !== null}>
                        {syncingFutu === "full" ? "全量同步中…" : "同步富途自2020年"}
                      </button>
                      <button className="secondary" onClick={probeFutuEarliestTrades} disabled={refreshingFutuAccounts || syncingFutu !== null || probingFutuEarliest}>
                        {probingFutuEarliest ? "探测中…" : "探测最早成交"}
                      </button>
                    </div>
                  </div>
                  <div className="footer-note compact-meta">
                    当前通过 OpenD 拉取历史成交。默认合并全部证券子账户；若手动选定单个账户，则只同步该账户。
                  </div>
                  {syncStatus ? <div className="sync-status">{syncStatus}</div> : null}
                  {futuEarliestProbeResults.length ? (
                    <div className="mini-table">
                      {futuEarliestProbeResults.map((item) => (
                        <div key={item.acc_id} className="mini-table-row">
                          <div>
                            <strong>{formatFutuAccountLabel(item)}</strong>
                            <div className="compact-meta">{item.message ?? "未返回附加说明"}</div>
                          </div>
                          <div className="mini-table-metric">
                            <strong>{item.earliestTradeDate ?? "未找到"}</strong>
                            <span className="compact-meta">{item.sampleSymbol ?? item.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <label className="wide-control">
                  <span>CSV 导入</span>
                  <textarea value={importCsv} onChange={(event) => setImportCsv(event.target.value)} />
                </label>
              </div>
              <div className="button-row">
                <button onClick={importTrades}>导入交易</button>
                <button className="secondary" onClick={() => syncTrades("ib")}>
                  同步 IB
                </button>
              </div>
            </div>
            <div className="brief">
              <ReviewAnalyticsPanel
                review={review}
                reviewLoading={reviewLoading}
                reviewQualityNote={reviewQualityNote}
                reviewReturnView={reviewReturnView}
                setReviewReturnView={setReviewReturnView}
              />
            </div>
          </div>
        </div>

      </section>

      <p className="footer-note">{pending ? "正在更新盘后数据…" : "当前主界面已切到免费低频的盘后分析模式。"} </p>
    </div>
  );
}
