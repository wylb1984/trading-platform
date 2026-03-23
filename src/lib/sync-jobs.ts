type SyncJobStatus = "running" | "completed" | "failed";

export interface SyncJobState {
  id: string;
  provider: string;
  label: string;
  status: SyncJobStatus;
  progress: {
    completed: number;
    total: number;
  };
  message: string;
  imported?: number;
  includedAccounts?: Array<{ acc_id: string; trd_env: string; acc_type?: string | null; card_num?: string | null; uni_card_num?: string | null }>;
  startedAt: string;
  finishedAt?: string;
}

type SyncJobStore = Map<string, SyncJobState>;

function getStore(): SyncJobStore {
  const scope = globalThis as typeof globalThis & { __syncJobs__?: SyncJobStore };
  if (!scope.__syncJobs__) {
    scope.__syncJobs__ = new Map();
  }
  return scope.__syncJobs__;
}

export function createSyncJob(input: Pick<SyncJobState, "provider" | "label" | "message"> & { total: number }) {
  const id = crypto.randomUUID();
  const job: SyncJobState = {
    id,
    provider: input.provider,
    label: input.label,
    status: "running",
    progress: {
      completed: 0,
      total: input.total
    },
    message: input.message,
    startedAt: new Date().toISOString()
  };
  getStore().set(id, job);
  return job;
}

export function updateSyncJob(id: string, patch: Partial<Omit<SyncJobState, "id" | "provider" | "label" | "startedAt">>) {
  const store = getStore();
  const current = store.get(id);
  if (!current) {
    return null;
  }
  const next: SyncJobState = {
    ...current,
    ...patch,
    progress: patch.progress ? { ...current.progress, ...patch.progress } : current.progress
  };
  store.set(id, next);
  return next;
}

export function getSyncJob(id: string) {
  return getStore().get(id) ?? null;
}
