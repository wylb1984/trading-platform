import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/market-data";
import { Market } from "@/lib/types";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") ?? undefined;
  const market = (request.nextUrl.searchParams.get("market") as Market | null) ?? undefined;
  return NextResponse.json({ items: await getNews(symbol, market) });
}
