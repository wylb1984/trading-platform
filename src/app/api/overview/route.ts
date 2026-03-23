import { NextResponse } from "next/server";
import { getDailySnapshot, getMarketSnapshotToken, setDailySnapshot } from "@/lib/daily-snapshots";
import { getMarketOverview } from "@/lib/market-data";

export async function GET() {
  const cacheKey = "overview:global";
  const token = getMarketSnapshotToken("MIXED");
  const cached = await getDailySnapshot<{ items: Awaited<ReturnType<typeof getMarketOverview>> }>(cacheKey, token);
  if (cached) {
    return NextResponse.json(cached);
  }

  const payload = { items: await getMarketOverview() };
  await setDailySnapshot(cacheKey, token, payload);
  return NextResponse.json(payload);
}
