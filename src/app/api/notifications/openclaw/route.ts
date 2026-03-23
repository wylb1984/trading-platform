import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { NotificationScope, dispatchOpenClawImportantSignals, sendOpenClawTestNotification } from "@/lib/openclaw-notifications";

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (requiresSupabaseAuth() && !userId) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      scope?: NotificationScope;
      dryRun?: boolean;
      force?: boolean;
      test?: boolean;
      channel?: string;
      target?: string;
      account?: string;
    };

    if (body.test) {
      return NextResponse.json(
        await sendOpenClawTestNotification({
          userId,
          account: body.account,
          channel: body.channel,
          target: body.target,
          dryRun: body.dryRun
        })
      );
    }
    return NextResponse.json(
      await dispatchOpenClawImportantSignals({
        userId,
        scope: body.scope ?? "MIXED",
        dryRun: body.dryRun,
        force: body.force,
        channel: body.channel,
        target: body.target,
        account: body.account
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "openclaw notification failed" },
      { status: 500 }
    );
  }
}
