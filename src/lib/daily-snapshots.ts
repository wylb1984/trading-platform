import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

interface SnapshotEnvelope<T = unknown> {
  token: string;
  value: T;
  updatedAt: string;
}

type SnapshotStore = Record<string, SnapshotEnvelope>;

const dataDir = path.join(process.cwd(), "data");
const snapshotPath = path.join(dataDir, "daily-snapshots.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(snapshotPath, "utf-8");
  } catch {
    await writeFile(snapshotPath, JSON.stringify({}, null, 2), "utf-8");
  }
}

async function readStore(): Promise<SnapshotStore> {
  await ensureStore();
  try {
    const raw = await readFile(snapshotPath, "utf-8");
    return JSON.parse(raw) as SnapshotStore;
  } catch {
    return {};
  }
}

async function writeStore(store: SnapshotStore) {
  await ensureStore();
  const temp = `${snapshotPath}.tmp`;
  await writeFile(temp, JSON.stringify(store, null, 2), "utf-8");
  await rename(temp, snapshotPath);
}

function getShanghaiDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const read = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    hour: Number(read("hour"))
  };
}

function formatDateOffset(parts: { year: number; month: number; day: number }, offsetDays: number) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc.toISOString().slice(0, 10);
}

export function getMarketSnapshotToken(scope: "HKCN" | "US" | "MIXED") {
  const parts = getShanghaiDateParts();
  const hkcnSessionDate = parts.hour >= 17 ? formatDateOffset(parts, 0) : formatDateOffset(parts, -1);
  const usSessionDate = parts.hour >= 6 ? formatDateOffset(parts, -1) : formatDateOffset(parts, -2);

  if (scope === "HKCN") {
    return `HKCN:${hkcnSessionDate}`;
  }
  if (scope === "US") {
    return `US:${usSessionDate}`;
  }
  return `MIXED:${hkcnSessionDate}:${usSessionDate}`;
}

export async function getDailySnapshot<T>(key: string, token: string): Promise<T | null> {
  const store = await readStore();
  const record = store[key];
  if (!record) {
    return null;
  }
  if (record.token !== token) {
    return null;
  }
  return record.value as T;
}

export async function setDailySnapshot<T>(key: string, token: string, value: T) {
  const store = await readStore();
  store[key] = {
    token,
    value,
    updatedAt: new Date().toISOString()
  };
  await writeStore(store);
}

export async function invalidateDailySnapshot(key: string) {
  const store = await readStore();
  if (key in store) {
    delete store[key];
    await writeStore(store);
  }
}
