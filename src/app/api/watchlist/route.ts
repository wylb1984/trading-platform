import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { invalidateDailySnapshot } from "@/lib/daily-snapshots";
import { repositoryGetWatchlist, repositorySaveWatchlist } from "@/lib/repositories";
import { WatchlistItem } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  return NextResponse.json({ items: await repositoryGetWatchlist(userId) });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const body = (await request.json()) as { item?: Omit<WatchlistItem, "createdAt"> & { createdAt?: string } };
  if (!body.item?.symbol || !body.item.market) {
    return NextResponse.json({ error: "symbol and market are required" }, { status: 400 });
  }

  const current = await repositoryGetWatchlist(userId);
  const next = [
    body.item.createdAt
      ? (body.item as WatchlistItem)
      : { ...body.item, createdAt: new Date().toISOString() }
  ];
  const merged = [...current.filter((item) => item.symbol !== body.item?.symbol), ...next];
  const items = await repositorySaveWatchlist(merged, userId);
  await invalidateDailySnapshot(`watchlist-signals:${userId ?? "local"}`);
  return NextResponse.json({ items });
}

export async function PATCH(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as { symbol?: string; note?: string; market?: WatchlistItem["market"] };
  if (!body.symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const current = await repositoryGetWatchlist(userId);
  const existing = current.find((item) => item.symbol === body.symbol);
  if (!existing) {
    return NextResponse.json({ error: "watchlist item not found" }, { status: 404 });
  }

  const next = current.map((item) =>
    item.symbol === body.symbol
      ? {
          ...item,
          market: body.market ?? item.market,
          note: body.note?.trim() ? body.note.trim() : undefined
        }
      : item
  );

  const items = await repositorySaveWatchlist(next, userId);
  await invalidateDailySnapshot(`watchlist-signals:${userId ?? "local"}`);
  return NextResponse.json({ items });
}

export async function PUT(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as { items?: WatchlistItem[] };
  if (!body.items || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }

  const items = await repositorySaveWatchlist(body.items, userId);
  await invalidateDailySnapshot(`watchlist-signals:${userId ?? "local"}`);
  return NextResponse.json({ items });
}

export async function DELETE(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const current = await repositoryGetWatchlist(userId);
  const filtered = current.filter((item) => item.symbol !== symbol);
  const items = await repositorySaveWatchlist(filtered, userId);
  await invalidateDailySnapshot(`watchlist-signals:${userId ?? "local"}`);
  return NextResponse.json({ items });
}
