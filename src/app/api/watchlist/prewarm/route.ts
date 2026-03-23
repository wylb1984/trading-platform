import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { invalidateDailySnapshot } from "@/lib/daily-snapshots";
import { getHistoricalCandles } from "@/lib/market-data";
import { repositoryGetWatchlist } from "@/lib/repositories";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const watchlist = await repositoryGetWatchlist(userId);
  const results = await Promise.all(
    watchlist.map(async (item) => {
      try {
        const candles = await getHistoricalCandles(item.symbol, item.market, { limit: 180 });
        return {
          symbol: item.symbol,
          market: item.market,
          candles: candles.length,
          ok: candles.length >= 60
        };
      } catch {
        return {
          symbol: item.symbol,
          market: item.market,
          candles: 0,
          ok: false
        };
      }
    })
  );

  await invalidateDailySnapshot(`watchlist-signals:${userId ?? "local"}`);

  return NextResponse.json({
    ok: true,
    warmed: results.filter((item) => item.ok).length,
    total: results.length,
    items: results
  });
}
