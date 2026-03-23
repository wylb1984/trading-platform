import { NextRequest, NextResponse } from "next/server";
import { searchAssets } from "@/lib/search";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({
    items: await searchAssets(query)
  });
}
