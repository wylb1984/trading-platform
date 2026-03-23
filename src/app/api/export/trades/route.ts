import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { repositoryGetTradeLogs } from "@/lib/repositories";

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const trades = await repositoryGetTradeLogs(userId);
  const header = ["id", "symbol", "market", "side", "quantity", "price", "tradeDate", "note"];
  const rows = trades.map((item) =>
    [item.id, item.symbol, item.market, item.side, item.quantity, item.price, item.tradeDate, item.note ?? ""]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="trade-logs.csv"'
    }
  });
}
