import { NextRequest, NextResponse } from "next/server";
import { derivePortfolioFromTrades } from "@/lib/analytics";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { revaluePortfolioDerivation, summarizePortfolioWithRealQuotes } from "@/lib/portfolio-summary";
import { repositoryGetCashFlows, repositoryGetTradeLogs } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const [trades, cashFlows] = await Promise.all([repositoryGetTradeLogs(userId), repositoryGetCashFlows(userId)]);
  const derivation = await revaluePortfolioDerivation(derivePortfolioFromTrades(trades, cashFlows));
  return NextResponse.json({
    derivation,
    summary: await summarizePortfolioWithRealQuotes(derivation.holdings)
  });
}
