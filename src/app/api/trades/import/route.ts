import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { invalidateDailySnapshot } from "@/lib/daily-snapshots";
import { importTradesFromCsv, mergeTradeImports } from "@/lib/trade-import";
import { repositoryGetTradeLogs, repositorySaveTradeLogs } from "@/lib/repositories";

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as { csv?: string };
  if (!body.csv?.trim()) {
    return NextResponse.json({ error: "csv is required" }, { status: 400 });
  }

  const parsed = importTradesFromCsv(body.csv);
  if (parsed.items.length === 0) {
    return NextResponse.json({ error: parsed.errors[0] ?? "no trades parsed" }, { status: 400 });
  }

  const current = await repositoryGetTradeLogs(userId);
  const merged = mergeTradeImports(current, parsed.items);
  const items = await repositorySaveTradeLogs(merged, userId);
  await invalidateDailySnapshot(`review:${userId ?? "local"}`);
  await invalidateDailySnapshot(`review:v2:${userId ?? "local"}`);

  return NextResponse.json({
    items,
    imported: parsed.items.length,
    provider: parsed.provider,
    errors: parsed.errors
  });
}
