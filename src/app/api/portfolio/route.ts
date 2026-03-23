import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { summarizePortfolioWithRealQuotes } from "@/lib/portfolio-summary";
import { repositoryGetPortfolioDraft, repositorySavePortfolioDraft } from "@/lib/repositories";
import { PortfolioHolding } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const draft = await repositoryGetPortfolioDraft(userId).catch(() => [] as PortfolioHolding[]);
  return NextResponse.json(await summarizePortfolioWithRealQuotes(draft));
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const body = (await request.json()) as { holdings?: PortfolioHolding[] };
  if (!Array.isArray(body.holdings)) {
    return NextResponse.json({ error: "holdings array is required" }, { status: 400 });
  }
  const holdings = body.holdings;
  await repositorySavePortfolioDraft(holdings, userId);
  return NextResponse.json(await summarizePortfolioWithRealQuotes(holdings));
}
