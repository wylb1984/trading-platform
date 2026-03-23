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
