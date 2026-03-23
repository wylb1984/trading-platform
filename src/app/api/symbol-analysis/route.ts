import { NextRequest, NextResponse } from "next/server";
import { getSymbolAnalysis } from "@/lib/symbol-analysis";
import { Market } from "@/lib/types";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const market = request.nextUrl.searchParams.get("market") as Market | null;

  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const analysis = await getSymbolAnalysis(symbol, market ?? undefined);
  if (!analysis) {
    return NextResponse.json({ error: "instrument not found" }, { status: 404 });
  }

  return NextResponse.json(analysis);
}
