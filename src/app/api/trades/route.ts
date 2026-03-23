import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { repositoryGetTradeLogs, repositorySaveTradeLogs } from "@/lib/repositories";
import { TradeLogItem } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  return NextResponse.json({ items: await repositoryGetTradeLogs(userId) });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as { item?: Omit<TradeLogItem, "id"> & { id?: string } };
  if (!body.item?.symbol || !body.item.market || !body.item.side) {
    return NextResponse.json({ error: "symbol, market and side are required" }, { status: 400 });
  }

  const current = await repositoryGetTradeLogs(userId);
  const nextItem: TradeLogItem = {
    ...body.item,
    id: body.item.id ?? crypto.randomUUID()
  };
  const items = [nextItem, ...current.filter((item) => item.id !== nextItem.id)];
  return NextResponse.json({ items: await repositorySaveTradeLogs(items, userId) });
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const current = await repositoryGetTradeLogs(userId);
  const items = current.filter((item) => item.id !== id);
  return NextResponse.json({ items: await repositorySaveTradeLogs(items, userId) });
}
