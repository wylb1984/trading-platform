import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { getWatchlistSignalsSnapshot } from "@/lib/watchlist-signals";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  return NextResponse.json(await getWatchlistSignalsSnapshot(userId));
}
