import { NextRequest, NextResponse } from "next/server";
import { buildAccountPerformance } from "@/lib/analytics";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { repositoryGetCashFlows, repositoryGetTradeLogs } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const [trades, cashFlows] = await Promise.all([repositoryGetTradeLogs(userId), repositoryGetCashFlows(userId)]);
  return NextResponse.json(buildAccountPerformance(trades, cashFlows));
}
