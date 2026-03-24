import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { OpenClawNotificationSettings } from "@/lib/types";

const execFileAsync = promisify(execFile);

export interface OpenClawSendInput {
  account?: string;
  channel: string;
  target: string;
  message: string;
  dryRun?: boolean;
}

export interface OpenClawResolvedTarget {
  id: string;
  name?: string;
  kind?: string;
  channel?: string;
  account?: string;
}

export function getOpenClawNotificationConfig(): OpenClawNotificationSettings {
  return {
    enabled: process.env.OPENCLAW_NOTIFY_ENABLED === "true",
    account: process.env.OPENCLAW_NOTIFY_ACCOUNT ?? "",
    channel: process.env.OPENCLAW_NOTIFY_CHANNEL ?? "",
    target: process.env.OPENCLAW_NOTIFY_TARGET ?? "",
    minConfidence: Number(process.env.OPENCLAW_NOTIFY_MIN_CONFIDENCE ?? 60)
  };
}

export async function sendOpenClawMessage(input: OpenClawSendInput) {
  const args = ["message", "send", "--channel", input.channel];
  if (input.account) {
    args.push("--account", input.account);
  }
  args.push("--target", input.target, "--message", input.message, "--json");
  if (input.dryRun) {
    args.push("--dry-run");
  }

  const { stdout, stderr } = await execFileAsync("openclaw", args, {
    env: { ...process.env, PAGER: "cat" },
    maxBuffer: 1024 * 1024 * 4
  });

  const text = stdout.trim();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text || null;
  }

  return {
    ok: true,
    result: parsed,
    stderr: stderr.trim() || undefined
  };
}

export async function runOpenClaw(args: string[]) {
  const { stdout, stderr } = await execFileAsync("openclaw", args, {
    env: { ...process.env, PAGER: "cat" },
    maxBuffer: 1024 * 1024 * 4
  });

  return {
    stdout: stdout.trim(),
    stderr: stderr.trim()
  };
}

function extractLastJson(text: string) {
  const trimmed = text.trim();
  const starts = ["{", "["];

  for (let index = trimmed.length - 1; index >= 0; index -= 1) {
    if (!starts.includes(trimmed[index] ?? "")) {
      continue;
    }
    const candidate = trimmed.slice(index);
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      continue;
    }
  }

  return null;
}

export async function runOpenClawJson(args: string[]) {
  const result = await runOpenClaw(args);
  const parsed = extractLastJson([result.stdout, result.stderr].filter(Boolean).join("\n"));
  return {
    ...result,
    parsed
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

export async function detectOpenClawSelf(channel: "feishu" | "openclaw-weixin", account?: string) {
  const args = ["directory", "self", "--channel", channel, "--json"];
  if (account) {
    args.push("--account", account);
  }
  const result = await runOpenClawJson(args);
  const object = asObject(result.parsed);
  if (!object) {
    return null;
  }

  const id = String(object.open_id ?? object.user_id ?? object.id ?? object.target ?? "").trim();
  if (!id) {
    return null;
  }

  return {
    id,
    name: String(object.name ?? object.display_name ?? object.nickname ?? "").trim() || undefined,
    account
  };
}

export async function resolveOpenClawTarget(
  channel: "feishu" | "openclaw-weixin",
  candidates: string[],
  account?: string
) {
  for (const candidate of candidates) {
    const args = ["channels", "resolve", "--channel", channel, "--json", candidate];
    if (account) {
      args.splice(3, 0, "--account", account);
    }
    const result = await runOpenClawJson(args);
    const array = asArray(result.parsed);
    const entry = asObject(array[0]) ?? asObject(result.parsed);
    if (!entry) {
      continue;
    }

    const id = String(entry.id ?? entry.target ?? entry.targetId ?? "").trim();
    if (!id) {
      continue;
    }

    return {
      id,
      name: String(entry.name ?? entry.label ?? candidate).trim() || candidate,
      kind: String(entry.kind ?? "").trim() || undefined,
      channel,
      account
    } satisfies OpenClawResolvedTarget;
  }

  return null;
}

export async function startOpenClawWeixinLoginInTerminal() {
  const command = 'tell application "Terminal" to do script "openclaw channels login --channel openclaw-weixin --verbose"';
  await execFileAsync("osascript", ["-e", command], {
    env: { ...process.env, PAGER: "cat" },
    maxBuffer: 1024 * 1024
  });
}
