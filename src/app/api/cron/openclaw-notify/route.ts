import { NextRequest, NextResponse } from "next/server";
import { dispatchOpenClawImportantSignals, NotificationScope } from "@/lib/openclaw-notifications";

function isAuthorized(request: NextRequest) {
  const configured = process.env.OPENCLAW_NOTIFY_CRON_SECRET;
  if (!configured) {
    return true;
  }
  const provided = request.headers.get("x-cron-secret") ?? request.nextUrl.searchParams.get("secret");
  return provided === configured;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      scope?: NotificationScope;
      force?: boolean;
      dryRun?: boolean;
    };

    const scope = body.scope ?? (request.nextUrl.searchParams.get("scope") as NotificationScope | null) ?? "MIXED";
    const result = await dispatchOpenClawImportantSignals({
      scope,
      force: body.force ?? false,
      dryRun: body.dryRun ?? false
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "cron openclaw notification failed" },
      { status: 500 }
    );
  }
}
