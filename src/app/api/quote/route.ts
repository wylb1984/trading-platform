import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/market-data";
import { Market } from "@/lib/types";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  const market = (request.nextUrl.searchParams.get("market") as Market | null) ?? undefined;
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const snapshot = await getQuote(symbol, market);
  if (!snapshot) {
    return NextResponse.json({ error: "instrument not found" }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}
