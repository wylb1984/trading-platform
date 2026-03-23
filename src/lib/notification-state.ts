import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

interface NotificationRecord {
  hash: string;
  sentAt: string;
  summary: string;
}

type NotificationStore = Record<string, NotificationRecord>;

const dataDir = path.join(process.cwd(), "data");
const statePath = path.join(dataDir, "notification-state.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(statePath, "utf-8");
  } catch {
    await writeFile(statePath, JSON.stringify({}, null, 2), "utf-8");
  }
}

async function readStore(): Promise<NotificationStore> {
  await ensureStore();
  try {
    return JSON.parse(await readFile(statePath, "utf-8")) as NotificationStore;
  } catch {
    return {};
  }
}

async function writeStore(store: NotificationStore) {
  await ensureStore();
  const temp = `${statePath}.tmp`;
  await writeFile(temp, JSON.stringify(store, null, 2), "utf-8");
  await rename(temp, statePath);
}

export async function getNotificationRecord(key: string) {
  const store = await readStore();
  return store[key] ?? null;
}

export async function setNotificationRecord(key: string, record: NotificationRecord) {
  const store = await readStore();
  store[key] = record;
  await writeStore(store);
}
