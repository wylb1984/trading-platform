import { createHash } from "node:crypto";
import { getMarketSnapshotToken } from "@/lib/daily-snapshots";
import { getNotificationRecord, setNotificationRecord } from "@/lib/notification-state";
import { normalizeNotificationConfig } from "@/lib/settings";
import { getOpenClawNotificationConfig, sendOpenClawMessage } from "@/lib/openclaw";
import { repositoryGetSettings } from "@/lib/repositories";
import { WatchlistSignalItem } from "@/lib/types";
import { getWatchlistSignalsSnapshot } from "@/lib/watchlist-signals";

export type NotificationScope = "US" | "HKCN" | "MIXED";

export function inNotificationScope(item: WatchlistSignalItem, scope: NotificationScope) {
  if (scope === "US") {
    return item.market === "US";
  }
  if (scope === "HKCN") {
    return item.market === "HK" || item.market === "CN";
  }
  return true;
}

export function buildTriggerReasons(item: WatchlistSignalItem, minConfidence: number) {
  const reasons: string[] = [];
  const confidence = item.confidence ?? 0;

  if (item.signal === "BUY" && confidence >= minConfidence) {
    reasons.push("偏多信号");
  }
  if (item.signal === "SELL" && confidence >= minConfidence) {
    reasons.push("偏空信号");
  }
  if (item.reflexivityTone === "reinforcing" && confidence >= Math.max(45, minConfidence - 10)) {
    reasons.push("反身性加强");
  }
  if (item.reflexivityTone === "turning-bearish" && confidence >= Math.max(45, minConfidence - 10)) {
    reasons.push("反身性转空");
  }
  if (item.fundamentalTone === "supportive" && confidence >= minConfidence) {
    reasons.push("基本面偏强");
  }
  if (item.fundamentalTone === "cautious" && confidence >= minConfidence) {
    reasons.push("基本面偏弱");
  }

  return reasons;
}

export function buildImportantSignals(items: WatchlistSignalItem[], minConfidence: number) {
  return items
    .map((item) => ({
      item,
      reasons: buildTriggerReasons(item, minConfidence)
    }))
    .filter((entry) => entry.item.available && entry.reasons.length > 0)
    .sort((left, right) => (right.item.confidence ?? 0) - (left.item.confidence ?? 0));
}

export function buildScopeLabel(scope: NotificationScope) {
  if (scope === "US") {
    return "美股盘后";
  }
  if (scope === "HKCN") {
    return "港股/A股盘后";
  }
  return "全市场盘后";
}

export function buildSignalMessage(scope: NotificationScope, entries: Array<{ item: WatchlistSignalItem; reasons: string[] }>) {
  const lines = [`【交易信号提醒｜${buildScopeLabel(scope)}】`, `共 ${entries.length} 个重要信号：`, ""];

  for (const { item, reasons } of entries.slice(0, 8)) {
    const confidence = item.confidence !== null ? `｜置信度 ${item.confidence}` : "";
    lines.push(`- ${item.name}（${item.symbol}）${item.market}｜${reasons.join(" / ")}${confidence}`);
    lines.push(`  当前：${item.signal === "BUY" ? "偏多" : item.signal === "SELL" ? "偏空" : item.signal === "HOLD" ? "持有" : "观察"}，${item.reason}`);
  }

  return lines.join("\n");
}

async function getEffectiveNotificationConfig(userId?: string | null) {
  const base = getOpenClawNotificationConfig();
  const settings = await repositoryGetSettings(userId);
  return normalizeNotificationConfig({
    ...base,
    ...settings.notificationConfig
  });
}

export async function sendOpenClawTestNotification(options?: {
  userId?: string | null;
  channel?: string;
  target?: string;
  account?: string;
  dryRun?: boolean;
}) {
  const config = await getEffectiveNotificationConfig(options?.userId);
  const channel = options?.channel ?? config.channel;
  const target = options?.target ?? config.target;
  const account = (options?.account ?? config.account) || undefined;
  if (!channel || !target) {
    throw new Error("OPENCLAW_NOTIFY_CHANNEL and OPENCLAW_NOTIFY_TARGET are required");
  }

  const message = `【交易信号提醒测试】\nOpenClaw 通知链路已连通。\n时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`;
  return {
    mode: "test" as const,
    message,
    ...(await sendOpenClawMessage({ account, channel, target, message, dryRun: options?.dryRun ?? false }))
  };
}

export async function dispatchOpenClawImportantSignals(input?: {
  userId?: string | null;
  scope?: NotificationScope;
  dryRun?: boolean;
  force?: boolean;
  channel?: string;
  target?: string;
  account?: string;
}) {
  const config = await getEffectiveNotificationConfig(input?.userId);
  const scope = input?.scope ?? "MIXED";
  const account = (input?.account ?? config.account) || undefined;
  const channel = input?.channel ?? config.channel;
  const target = input?.target ?? config.target;
  const dryRun = input?.dryRun ?? false;
  const force = input?.force ?? false;

  if (!channel || !target) {
    throw new Error("OPENCLAW_NOTIFY_CHANNEL and OPENCLAW_NOTIFY_TARGET are required");
  }
  if (!config.enabled && !dryRun) {
    throw new Error("OPENCLAW_NOTIFY_ENABLED is not enabled");
  }

  const snapshot = await getWatchlistSignalsSnapshot(input?.userId);
  const scopedItems = snapshot.items.filter((item) => inNotificationScope(item, scope));
  const important = buildImportantSignals(scopedItems, config.minConfidence);

  if (!important.length) {
    return {
      ok: true,
      mode: "dispatch" as const,
      skipped: true,
      reason: "当前没有达到通知阈值的重要信号。"
    };
  }

  const token = getMarketSnapshotToken(scope);
  const contentHash = createHash("sha256")
    .update(JSON.stringify(important.map(({ item, reasons }) => ({ symbol: item.symbol, signal: item.signal, confidence: item.confidence, reasons }))))
    .digest("hex");
  const notificationKey = `openclaw:${input?.userId ?? "local"}:${scope}:${token}`;
  const existing = await getNotificationRecord(notificationKey);
  if (!force && existing?.hash === contentHash) {
    return {
      ok: true,
      mode: "dispatch" as const,
      skipped: true,
      reason: "当前盘后批次已发送过同样的通知。",
      sentAt: existing.sentAt
    };
  }

  const message = buildSignalMessage(scope, important);
  const sent = await sendOpenClawMessage({ account, channel, target, message, dryRun });
  await setNotificationRecord(notificationKey, {
    hash: contentHash,
    sentAt: new Date().toISOString(),
    summary: `${buildScopeLabel(scope)} ${important.length} 个重要信号`
  });

  return {
    mode: "dispatch" as const,
    scope,
    important: important.length,
    message,
    ...sent
  };
}
