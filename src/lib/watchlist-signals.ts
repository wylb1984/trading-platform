import {
  buildPartialWatchlistSignal,
  buildSnapshotFromCandles,
  buildUnavailableWatchlistSignal,
  buildWatchlistInsight,
  buildWatchlistSignals
} from "@/lib/analytics";
import { getDailySnapshot, getMarketSnapshotToken, setDailySnapshot } from "@/lib/daily-snapshots";
import { buildFundamentalContext, summarizeFundamentalSignal } from "@/lib/fundamental-signals";
import { instruments } from "@/lib/instruments";
import { describeUnavailableData, getHistoricalCandles, getNews, getQuote } from "@/lib/market-data";
import { buildReflexivityContext, summarizeReflexivitySignal } from "@/lib/reflexivity-signals";
import { repositoryGetWatchlist } from "@/lib/repositories";
import { WatchlistInsight, WatchlistSignalItem } from "@/lib/types";

export interface WatchlistSignalsPayload {
  items: WatchlistSignalItem[];
  insight: WatchlistInsight;
}

export async function computeWatchlistSignals(userId?: string | null): Promise<WatchlistSignalsPayload> {
  const watchlist = await repositoryGetWatchlist(userId);
  const resolved = await Promise.all(
    watchlist.map(async (item) => {
      const snapshot = await getQuote(item.symbol, item.market);
      const candles = snapshot?.candles.length ? snapshot.candles : await getHistoricalCandles(item.symbol, item.market);
      const enrichedSnapshot =
        snapshot && candles.length >= 2
          ? {
              ...(buildSnapshotFromCandles(item.symbol, candles) ?? snapshot),
              price: snapshot.price,
              change: snapshot.change,
              changePct: snapshot.changePct,
              volume: snapshot.volume,
              turnover: snapshot.turnover,
              dataSource: snapshot.dataSource,
              lastUpdated: snapshot.lastUpdated,
              dataLatency: snapshot.dataLatency,
              cacheState: snapshot.cacheState
            }
          : snapshot;

      if (enrichedSnapshot && candles.length >= 60) {
        const [signal, news] = await Promise.all([
          Promise.resolve(buildWatchlistSignals([{ ...enrichedSnapshot, candles }])[0]),
          getNews(item.symbol, item.market).catch(() => [])
        ]);
        const fundamentalContext = buildFundamentalContext({ ...enrichedSnapshot, candles }, news);
        const reflexivityContext = buildReflexivityContext({ ...enrichedSnapshot, candles }, news, fundamentalContext);
        return {
          ...signal,
          fundamentalTone: fundamentalContext.stance,
          fundamentalNote: summarizeFundamentalSignal(fundamentalContext),
          reflexivityTone: reflexivityContext.stance,
          reflexivityNote: summarizeReflexivitySignal(reflexivityContext)
        };
      }

      if (enrichedSnapshot && candles.length >= 20) {
        const news = await getNews(item.symbol, item.market).catch(() => []);
        const signal = buildPartialWatchlistSignal({ ...enrichedSnapshot, candles });
        const fundamentalContext = buildFundamentalContext({ ...enrichedSnapshot, candles }, news);
        const reflexivityContext = buildReflexivityContext({ ...enrichedSnapshot, candles }, news, fundamentalContext);
        return {
          ...signal,
          fundamentalTone: fundamentalContext.stance,
          fundamentalNote: summarizeFundamentalSignal(fundamentalContext),
          reflexivityTone: reflexivityContext.stance,
          reflexivityNote: summarizeReflexivitySignal(reflexivityContext)
        };
      }

      const instrument = instruments.find((entry) => entry.symbol === item.symbol);
      return buildUnavailableWatchlistSignal({
        symbol: item.symbol,
        market: item.market,
        name: instrument?.name ?? item.symbol,
        snapshot: enrichedSnapshot
          ? {
              price: enrichedSnapshot.price,
              changePct: enrichedSnapshot.changePct,
              dataSource: enrichedSnapshot.dataSource,
              lastUpdated: enrichedSnapshot.lastUpdated,
              dataLatency: enrichedSnapshot.dataLatency,
              cacheState: enrichedSnapshot.cacheState
            }
          : undefined,
        reason: enrichedSnapshot ? "已拿到报价，但缺少可校验的真实历史K线，暂不输出交易信号。" : undefined,
        unavailableReason: enrichedSnapshot
          ? "缺少足够的真实日线历史，无法稳定生成技术信号。"
          : describeUnavailableData(item.symbol, item.market)
      });
    })
  );

  return {
    items: resolved,
    insight: buildWatchlistInsight(resolved)
  };
}

export async function getWatchlistSignalsSnapshot(userId?: string | null) {
  const cacheKey = `watchlist-signals:${userId ?? "local"}`;
  const token = getMarketSnapshotToken("MIXED");
  const cached = await getDailySnapshot<WatchlistSignalsPayload>(cacheKey, token);
  if (cached) {
    return cached;
  }

  const payload = await computeWatchlistSignals(userId);
  await setDailySnapshot(cacheKey, token, payload);
  return payload;
}
