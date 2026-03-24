import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { repositoryGetSettings, repositorySaveSettings } from "@/lib/repositories";
import {
  detectOpenClawSelf,
  resolveOpenClawTarget,
  startOpenClawWeixinLoginInTerminal
} from "@/lib/openclaw";
import { normalizeAppSettings } from "@/lib/settings";

type ConnectChannel = "feishu" | "openclaw-weixin";

async function saveBinding(userId: string | null | undefined, channel: ConnectChannel, binding: {
  target: string;
  account?: string;
  displayName?: string;
}) {
  const current = normalizeAppSettings(await repositoryGetSettings(userId));
  current.notificationConfig = {
    ...current.notificationConfig,
    enabled: true,
    channel,
    target: binding.target,
    account: binding.account ?? "",
    displayName: binding.displayName ?? current.notificationConfig.displayName,
    connectedAt: new Date().toISOString()
  };
  return repositorySaveSettings(current, userId);
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (requiresSupabaseAuth() && !userId) {
      return NextResponse.json({ error: "authentication required" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      channel?: ConnectChannel;
      action?: "start" | "complete" | "disconnect";
    };

    const channel = body.channel;
    const action = body.action ?? "complete";

    if (!channel) {
      return NextResponse.json({ error: "channel is required" }, { status: 400 });
    }

    if (action === "disconnect") {
      const current = normalizeAppSettings(await repositoryGetSettings(userId));
      current.notificationConfig = {
        ...current.notificationConfig,
        enabled: false,
        channel: "",
        target: "",
        account: "",
        displayName: "",
        connectedAt: ""
      };
      const saved = await repositorySaveSettings(current, userId);
      return NextResponse.json({
        ok: true,
        action,
        message: "通知通道已断开。",
        settings: saved.notificationConfig
      });
    }

    if (channel === "openclaw-weixin" && action === "start") {
      await startOpenClawWeixinLoginInTerminal();
      return NextResponse.json({
        ok: true,
        action,
        channel,
        message: "已拉起微信扫码登录，请在终端完成扫码后点击“完成微信连接”。"
      });
    }

    if (channel === "feishu") {
      const self = await detectOpenClawSelf("feishu");
      if (!self) {
        return NextResponse.json(
          {
            ok: false,
            channel,
            message: "暂时无法自动识别飞书当前账号，请先确认 OpenClaw 已完成飞书授权，然后再点一次“连接飞书”。"
          },
          { status: 400 }
        );
      }

      const saved = await saveBinding(userId, "feishu", {
        target: self.id,
        account: self.account,
        displayName: self.name ? `飞书 · ${self.name}` : "飞书"
      });

      return NextResponse.json({
        ok: true,
        action,
        channel,
        message: `已连接飞书${self.name ? `：${self.name}` : ""}。`,
        settings: saved.notificationConfig
      });
    }

    const weixinTarget =
      (await resolveOpenClawTarget("openclaw-weixin", ["clawbot", "文件传输助手"])) ??
      (await resolveOpenClawTarget("openclaw-weixin", ["ClawBot", "File Transfer Assistant"]));

    if (!weixinTarget) {
      return NextResponse.json(
        {
          ok: false,
          channel,
          message: "微信账号已连上，但还没识别到可用通知目标。请先在微信里确认已能看到 clawbot 或文件传输助手，然后再点一次“完成微信连接”。"
        },
        { status: 400 }
      );
    }

    const saved = await saveBinding(userId, "openclaw-weixin", {
      target: weixinTarget.id,
      account: weixinTarget.account,
      displayName: `微信 · ${weixinTarget.name ?? "已连接"}`
    });

    return NextResponse.json({
      ok: true,
      action,
      channel,
      message: `已连接微信通知目标：${weixinTarget.name ?? weixinTarget.id}。`,
      settings: saved.notificationConfig
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "openclaw connect failed"
      },
      { status: 500 }
    );
  }
}
