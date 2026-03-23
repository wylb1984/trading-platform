import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { invalidateDailySnapshot } from "@/lib/daily-snapshots";
import { repositoryGetCashFlows, repositorySaveCashFlows } from "@/lib/repositories";
import { CashFlowItem } from "@/lib/types";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  return NextResponse.json({ items: await repositoryGetCashFlows(userId) });
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as { item?: Omit<CashFlowItem, "id"> & { id?: string } };
  if (!body.item?.flowDate || !body.item.type || !Number.isFinite(body.item.amount)) {
    return NextResponse.json({ error: "flowDate, type and amount are required" }, { status: 400 });
  }

  const current = await repositoryGetCashFlows(userId);
  const nextItem: CashFlowItem = {
    ...body.item,
    id: body.item.id ?? crypto.randomUUID()
  };
  const items = [nextItem, ...current.filter((item) => item.id !== nextItem.id)];
  const saved = await repositorySaveCashFlows(items, userId);
  await invalidateDailySnapshot(`review:${userId ?? "local"}`);
  await invalidateDailySnapshot(`review:v2:${userId ?? "local"}`);
  return NextResponse.json({ items: saved });
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

  const current = await repositoryGetCashFlows(userId);
  const items = current.filter((item) => item.id !== id);
  const saved = await repositorySaveCashFlows(items, userId);
  await invalidateDailySnapshot(`review:${userId ?? "local"}`);
  await invalidateDailySnapshot(`review:v2:${userId ?? "local"}`);
  return NextResponse.json({ items: saved });
}
