import { NextRequest, NextResponse } from "next/server";
import { runScreener } from "@/lib/analytics";
import { AssetClass, Market } from "@/lib/types";

function parseList<T extends string>(value: string | null) {
  if (!value) {
    return undefined;
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as T[];
}

function parseNumber(value: string | null) {
  if (!value) {
    return undefined;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const data = runScreener({
    markets: parseList<Market>(params.get("markets")),
    assetClasses: parseList<AssetClass>(params.get("assetClasses")),
    sectors: parseList<string>(params.get("sectors")),
    minPrice: parseNumber(params.get("minPrice")),
    maxPrice: parseNumber(params.get("maxPrice")),
    minVolume: parseNumber(params.get("minVolume")),
    maxPe: parseNumber(params.get("maxPe")),
    minDividendYield: parseNumber(params.get("minDividendYield")),
    tags: parseList<string>(params.get("tags"))
  });

  return NextResponse.json({ items: data });
}
