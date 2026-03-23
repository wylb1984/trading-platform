import { NextRequest, NextResponse } from "next/server";
import { backtestMovingAverageCrossFromCandles } from "@/lib/analytics";
import { getHistoricalCandles } from "@/lib/market-data";
import { BacktestRequest } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as BacktestRequest;
  const candles = await getHistoricalCandles(body.symbol, body.market);
  const result = backtestMovingAverageCrossFromCandles(body, candles);
  if (!result) {
    return NextResponse.json({ error: "instrument not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}
