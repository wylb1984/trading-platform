import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { getDailySnapshot, getMarketSnapshotToken, setDailySnapshot } from "@/lib/daily-snapshots";
import { repositoryGetCashFlows, repositoryGetTradeLogs } from "@/lib/repositories";
import { buildTradingReviewDetailed } from "@/lib/trading-review";
import { TradingReview } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const cacheKey = `review:v2:${userId ?? "local"}`;
  const token = getMarketSnapshotToken("MIXED");
  const cached = await getDailySnapshot<TradingReview>(cacheKey, token);
  if (cached) {
    return NextResponse.json(cached);
  }

  const [trades, cashFlows] = await Promise.all([repositoryGetTradeLogs(userId), repositoryGetCashFlows(userId)]);
  const payload = await buildTradingReviewDetailed(trades, cashFlows);
  await setDailySnapshot(cacheKey, token, payload);
  return NextResponse.json(payload);
}
