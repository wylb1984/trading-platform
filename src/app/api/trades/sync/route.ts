import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId, requiresSupabaseAuth } from "@/lib/auth";
import { invalidateDailySnapshot } from "@/lib/daily-snapshots";
import { importTradesFromCsv, mergeTradeImports } from "@/lib/trade-import";
import { repositoryGetTradeLogs, repositorySaveTradeLogs } from "@/lib/repositories";
import { createSyncJob, getSyncJob, updateSyncJob } from "@/lib/sync-jobs";
import { Market, TradeLogItem } from "@/lib/types";

const providerEnvMap = {
  futu: "FUTU_SYNC_TOKEN",
  ib: "IB_SYNC_TOKEN"
} as const;

type FutuDeal = {
  deal_id: string;
  order_id?: string | null;
  code: string;
  stock_name?: string | null;
  trd_side: string;
  qty: number;
  price: number;
  create_time: string;
  deal_market?: string | null;
  fee?: number | null;
  currency?: string | null;
  status?: string | null;
};

type FutuAccount = {
  acc_id: string;
  trd_env: string;
  acc_type?: string | null;
  card_num?: string | null;
  uni_card_num?: string | null;
  security_firm?: string | null;
};

type FutuEarliestProbe = {
  acc_id: string;
  trd_env: string;
  acc_type?: string | null;
  card_num?: string | null;
  uni_card_num?: string | null;
  earliestTradeDate: string | null;
  sampleSymbol?: string | null;
  status: "found" | "empty" | "skipped" | "error";
  message?: string;
};

function inferFutuMarket(code: string, market?: string | null): Market {
  const normalizedCode = code.trim().toUpperCase();
  const upperMarket = (market ?? "").toUpperCase();
  if (upperMarket.includes("HK")) {
    return "HK";
  }
  if (upperMarket.includes("US")) {
    return "US";
  }
  if (upperMarket.includes("SH") || upperMarket.includes("SZ") || upperMarket.includes("CN")) {
    return "CN";
  }
  if (normalizedCode.startsWith("HK.")) {
    return "HK";
  }
  if (normalizedCode.startsWith("SH.") || normalizedCode.startsWith("SZ.")) {
    return "CN";
  }
  if (normalizedCode.startsWith("US.")) {
    return "US";
  }
  if (code.includes(".HK")) {
    return "HK";
  }
  if (code.includes(".SH") || code.includes(".SZ")) {
    return "CN";
  }
  return "US";
}

function normalizeFutuSymbol(code: string, market: Market) {
  const trimmed = code.trim().toUpperCase();
  if (market === "HK") {
    const base = trimmed.replace(/^HK\./, "").replace(/\.HK$/, "");
    if (!/^\d+$/.test(base)) {
      return trimmed;
    }
    return `${base.padStart(4, "0")}.HK`;
  }
  if (market === "CN") {
    const normalized = trimmed.replace(/^((SH|SZ)\.)/, "").replace(/\.(SH|SZ)$/, "");
    if (trimmed.startsWith("SH.") || normalized.startsWith("6")) {
      return `${normalized}.SH`;
    }
    return `${normalized}.SZ`;
  }
  return trimmed.replace(/^US\./, "");
}

function normalizeFutuSide(side: string): TradeLogItem["side"] {
  const normalized = side.toUpperCase();
  return normalized.includes("SELL") ? "SELL" : "BUY";
}

function mapFutuDealsToTrades(deals: FutuDeal[]): TradeLogItem[] {
  return deals
    .filter((item) => item.code && item.create_time && Number.isFinite(item.qty) && Number.isFinite(item.price))
    .map((item) => {
      const market = inferFutuMarket(item.code, item.deal_market);
      return {
        id: `futu-${item.deal_id}`,
        symbol: normalizeFutuSymbol(item.code, market),
        market,
        side: normalizeFutuSide(item.trd_side),
        quantity: Number(item.qty),
        price: Number(item.price),
        fee: Number(item.fee ?? 0),
        tradeDate: item.create_time.slice(0, 10),
        note: item.stock_name ?? undefined
      };
    });
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `upstream ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function splitDateWindows(start: string, end: string, windowDays = 90) {
  const windows: Array<{ start: string; end: string }> = [];
  let cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);

  while (cursor <= last) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + windowDays - 1);
    if (windowEnd > last) {
      windowEnd.setTime(last.getTime());
    }

    windows.push({
      start: windowStart.toISOString().slice(0, 10),
      end: windowEnd.toISOString().slice(0, 10)
    });

    cursor = new Date(windowEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return windows;
}

function dedupeFutuDeals(deals: FutuDeal[]) {
  return Array.from(new Map(deals.map((item) => [item.deal_id, item] as const)).values());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findFutuEarliestTradeDates(input: {
  serviceUrl: string;
  trdEnv: string;
  start: string;
  end: string;
}) {
  const accounts = (
    await fetchJson<FutuAccount[]>(
      `${input.serviceUrl}/accounts?trd_env=${encodeURIComponent(input.trdEnv)}`
    )
  ).filter((item) => item.acc_type !== "CASH");

  const yearlyWindows = splitDateWindows(input.start, input.end, 365);
  const results: FutuEarliestProbe[] = [];

  for (let accountIndex = 0; accountIndex < accounts.length; accountIndex += 1) {
    const account = accounts[accountIndex];
    let result: FutuEarliestProbe = {
      acc_id: account.acc_id,
      trd_env: account.trd_env,
      acc_type: account.acc_type,
      card_num: account.card_num,
      uni_card_num: account.uni_card_num,
      earliestTradeDate: null,
      sampleSymbol: null,
      status: "empty",
      message: "在探测区间内未找到成交"
    };

    for (let index = 0; index < yearlyWindows.length; index += 1) {
      if ((accountIndex * yearlyWindows.length + index) > 0 && (accountIndex * yearlyWindows.length + index) % 8 === 0) {
        await sleep(26_000);
      }

      const window = yearlyWindows[index];
      const batchQuery = new URLSearchParams({
        start: window.start,
        end: window.end,
        trd_env: input.trdEnv,
        acc_id: account.acc_id
      });

      try {
        const deals = await fetchJson<FutuDeal[]>(`${input.serviceUrl}/history-deals?${batchQuery.toString()}`);
        if (deals.length > 0) {
          const earliestDeal = deals
            .filter((item) => item.create_time)
            .sort((left, right) => left.create_time.localeCompare(right.create_time))[0];
          result = {
            acc_id: account.acc_id,
            trd_env: account.trd_env,
            acc_type: account.acc_type,
            card_num: account.card_num,
            uni_card_num: account.uni_card_num,
            earliestTradeDate: earliestDeal?.create_time?.slice(0, 10) ?? null,
            sampleSymbol: earliestDeal?.code ?? null,
            status: "found",
            message: `最早成交出现在 ${window.start} 至 ${window.end}`
          };
          break;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("does not support querying historical deal lists")) {
          result = {
            acc_id: account.acc_id,
            trd_env: account.trd_env,
            acc_type: account.acc_type,
            card_num: account.card_num,
            uni_card_num: account.uni_card_num,
            earliestTradeDate: null,
            sampleSymbol: null,
            status: "skipped",
            message: "该账户不支持历史成交查询"
          };
          break;
        }
        result = {
          acc_id: account.acc_id,
          trd_env: account.trd_env,
          acc_type: account.acc_type,
          card_num: account.card_num,
          uni_card_num: account.uni_card_num,
          earliestTradeDate: null,
          sampleSymbol: null,
          status: "error",
          message
        };
        break;
      }
    }

    results.push(result);
  }

  return results;
}

async function runFutuSync(input: {
  serviceUrl: string;
  start: string;
  end: string;
  accId?: string;
  trdEnv: string;
  userId?: string;
  jobId?: string;
}) {
  const windows = splitDateWindows(input.start, input.end, 90);
  let accounts = input.accId
    ? [{ acc_id: input.accId, trd_env: input.trdEnv }]
    : (
        await fetchJson<FutuAccount[]>(
          `${input.serviceUrl}/accounts?trd_env=${encodeURIComponent(input.trdEnv)}`
        )
      ).filter((item) => item.acc_type !== "CASH");

  let skippedEmptyAccounts = 0;
  let includedAccounts = accounts;
  if (!input.accId && input.start <= "2020-01-01") {
    const earliestProbe = await findFutuEarliestTradeDates({
      serviceUrl: input.serviceUrl,
      trdEnv: input.trdEnv,
      start: input.start,
      end: input.end
    });
    const eligibleAccounts = earliestProbe
      .filter((item) => item.status === "found" && item.earliestTradeDate)
      .sort((left, right) => (left.earliestTradeDate ?? "").localeCompare(right.earliestTradeDate ?? ""))
      .map((item) => item.acc_id);
    if (eligibleAccounts.length > 0) {
      skippedEmptyAccounts = Math.max(0, accounts.length - eligibleAccounts.length);
      accounts = accounts.filter((item) => eligibleAccounts.includes(item.acc_id));
      includedAccounts = accounts;
    }
  }
  const accountIds = Array.from(new Set(accounts.map((item) => item.acc_id)));
  const allDeals: FutuDeal[] = [];
  const totalSteps = Math.max(1, accountIds.length * windows.length);
  let completedSteps = 0;
  let skippedAccounts = 0;

  for (let accountIndex = 0; accountIndex < accountIds.length; accountIndex += 1) {
    const currentAccId = accountIds[accountIndex];
    for (let index = 0; index < windows.length; index += 1) {
      if (completedSteps > 0 && completedSteps % 8 === 0) {
        await sleep(26_000);
      }
      const window = windows[index];
      updateSyncJob(input.jobId ?? "", {
        message: `正在拉取账户 ${accountIndex + 1}/${accountIds.length} 的第 ${index + 1}/${windows.length} 段：${window.start} 至 ${window.end}`,
        progress: {
          completed: completedSteps,
          total: totalSteps
        }
      });

      const batchQuery = new URLSearchParams({
        start: window.start,
        end: window.end,
        trd_env: input.trdEnv,
        acc_id: currentAccId
      });
      let deals: FutuDeal[] = [];
      try {
        deals = await fetchJson<FutuDeal[]>(`${input.serviceUrl}/history-deals?${batchQuery.toString()}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!input.accId && message.includes("does not support querying historical deal lists")) {
          skippedAccounts += 1;
          completedSteps += windows.length - index;
          updateSyncJob(input.jobId ?? "", {
            progress: {
              completed: completedSteps,
              total: totalSteps
            },
            message: `已跳过不支持历史成交的账户，继续同步剩余账户（${completedSteps}/${totalSteps}）`
          });
          break;
        }
        throw error;
      }
      allDeals.push(...deals);
      completedSteps += 1;
      updateSyncJob(input.jobId ?? "", {
        progress: {
          completed: completedSteps,
          total: totalSteps
        },
        message: `已完成 ${completedSteps}/${totalSteps} 段历史成交拉取`
      });
    }
  }

  const deals = dedupeFutuDeals(allDeals);
  const importedTrades = mapFutuDealsToTrades(deals);
  const current = await repositoryGetTradeLogs(input.userId);
  const merged = mergeTradeImports(current, importedTrades);
  const items = await repositorySaveTradeLogs(merged, input.userId);
  await invalidateDailySnapshot(`review:${input.userId ?? "local"}`);
  await invalidateDailySnapshot(`review:v2:${input.userId ?? "local"}`);

  return {
    windows: totalSteps,
    accounts: accountIds.length,
    skippedAccounts,
    skippedEmptyAccounts,
    includedAccounts,
    importedTrades,
    items
  };
}

export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const provider = request.nextUrl.searchParams.get("provider");
  if (provider !== "futu") {
    return NextResponse.json({ error: "provider must be futu" }, { status: 400 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId");
  if (jobId) {
    const job = getSyncJob(jobId);
    if (!job) {
      return NextResponse.json({ ok: false, provider, message: "job not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, provider, job });
  }

  const serviceUrl = process.env.FUTU_SERVICE_URL;
  if (!serviceUrl) {
    return NextResponse.json({
      ok: false,
      provider,
      message: "未配置 FUTU_SERVICE_URL。请先启动 futu bridge，并连接 OpenD。"
    });
  }

  try {
    const trdEnv = request.nextUrl.searchParams.get("trdEnv") ?? process.env.FUTU_TRD_ENV ?? "REAL";
    const inspect = request.nextUrl.searchParams.get("inspect");
    if (inspect === "earliest") {
      const start = request.nextUrl.searchParams.get("start") ?? "2020-01-01";
      const end = request.nextUrl.searchParams.get("end") ?? new Date().toISOString().slice(0, 10);
      const results = await findFutuEarliestTradeDates({
        serviceUrl,
        trdEnv,
        start,
        end
      });
      return NextResponse.json({
        ok: true,
        provider,
        inspect,
        range: { start, end },
        results
      });
    }
    const accounts = await fetchJson<FutuAccount[]>(`${serviceUrl}/accounts?trd_env=${encodeURIComponent(trdEnv)}`);
    return NextResponse.json({
      ok: true,
      provider,
      accounts
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      provider,
      message: error instanceof Error ? error.message : "futu accounts lookup failed"
    });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getAuthenticatedUserId(request);
  if (requiresSupabaseAuth() && !userId) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    provider?: keyof typeof providerEnvMap;
    csv?: string;
    start?: string;
    end?: string;
    accId?: string;
    trdEnv?: string;
    async?: boolean;
  };
  const provider = body.provider;
  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  if (body.csv?.trim()) {
    const parsed = importTradesFromCsv(body.csv, provider);
    if (parsed.items.length === 0) {
      return NextResponse.json({ error: parsed.errors[0] ?? `${provider.toUpperCase()} CSV parse failed` }, { status: 400 });
    }

    const current = await repositoryGetTradeLogs(userId);
    const merged = mergeTradeImports(current, parsed.items);
    const items = await repositorySaveTradeLogs(merged, userId);
    await invalidateDailySnapshot(`review:${userId ?? "local"}`);
    await invalidateDailySnapshot(`review:v2:${userId ?? "local"}`);

    return NextResponse.json({
      ok: true,
      provider,
      imported: parsed.items.length,
      items,
      errors: parsed.errors,
      message: `${provider.toUpperCase()} CSV 已导入 ${parsed.items.length} 笔交易。`
    });
  }

  if (provider === "futu") {
    const serviceUrl = process.env.FUTU_SERVICE_URL;
    if (!serviceUrl) {
      return NextResponse.json({
        ok: false,
        provider,
        message: "未配置 FUTU_SERVICE_URL。请先启动 futu bridge，并连接 OpenD。"
      });
    }

    const start = body.start ?? new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const end = body.end ?? new Date().toISOString().slice(0, 10);
    const accId = body.accId ?? process.env.FUTU_ACC_ID;
    const trdEnv = body.trdEnv ?? process.env.FUTU_TRD_ENV ?? "REAL";
    const asyncMode = Boolean(body.async);

    try {
      let accountCount = 1;
      if (!accId) {
        const rawAccounts = (
          await fetchJson<FutuAccount[]>(
            `${serviceUrl}/accounts?trd_env=${encodeURIComponent(trdEnv)}`
          ).catch(() => [])
        ).filter((item) => item.acc_type !== "CASH");
        accountCount = rawAccounts.length || 1;
      }
      const totalWindows = splitDateWindows(start, end, 90).length * accountCount;
      if (asyncMode) {
        const job = createSyncJob({
          provider,
          label: start <= "2020-01-01" ? "富途全量同步" : "富途近端同步",
          message: "同步任务已创建，准备开始拉取历史成交…",
          total: totalWindows
        });

        void runFutuSync({
          serviceUrl,
          start,
          end,
          accId,
          trdEnv,
          userId: userId ?? undefined,
          jobId: job.id
        })
          .then((result) => {
            updateSyncJob(job.id, {
              status: "completed",
              imported: result.importedTrades.length,
              finishedAt: new Date().toISOString(),
              includedAccounts: result.includedAccounts,
              progress: {
                completed: result.windows,
                total: result.windows
              },
              message:
                result.importedTrades.length > 0
                  ? `同步完成，已导入 ${result.importedTrades.length} 笔成交。`
                  : "同步完成，但当前时间范围内没有可导入的成交记录。"
            });
          })
          .catch((error) => {
            updateSyncJob(job.id, {
              status: "failed",
              finishedAt: new Date().toISOString(),
              message: error instanceof Error ? error.message : "futu sync failed"
            });
          });

        return NextResponse.json({
          ok: true,
          provider,
          async: true,
          jobId: job.id,
          windows: totalWindows,
          message: `同步任务已启动，共 ${totalWindows} 段。`
        });
      }

          const { importedTrades, items, windows, accounts, skippedAccounts, skippedEmptyAccounts, includedAccounts } = await runFutuSync({
            serviceUrl,
            start,
            end,
            accId,
            trdEnv,
        userId: userId ?? undefined
      });
      if (importedTrades.length === 0) {
        return NextResponse.json({
          ok: true,
          provider,
          imported: 0,
          items: [],
          windows,
          message: "富途接口已连通，但当前时间范围内没有可导入的成交记录。"
        });
      }

        return NextResponse.json({
          ok: true,
          provider,
          imported: importedTrades.length,
          items,
          range: { start, end },
          windows,
          accounts,
          skippedAccounts,
          skippedEmptyAccounts,
          includedAccounts,
          accId: accId ?? null,
          trdEnv,
          message: `富途自动同步已导入 ${importedTrades.length} 笔成交${accId ? "" : `（已合并 ${accounts - skippedAccounts} 个可查询账户${skippedAccounts ? `，跳过 ${skippedAccounts} 个不支持历史成交的账户` : ""}${skippedEmptyAccounts ? `，跳过 ${skippedEmptyAccounts} 个未发现历史成交的账户` : ""}）`}。`
        });
    } catch (error) {
      return NextResponse.json({
        ok: false,
        provider,
        range: { start, end },
        accId: accId ?? null,
        trdEnv,
        message: error instanceof Error ? error.message : "futu sync failed"
      });
    }
  }

  const envKey = providerEnvMap[provider];
  if (!process.env[envKey]) {
    return NextResponse.json({
      ok: false,
      provider,
      message: `${provider.toUpperCase()} 自动同步尚未配置。你可以先把 ${provider.toUpperCase()} 导出的 CSV 粘贴到输入框，再点击同步按钮。若要接真实 API，请配置 ${envKey}。`
    });
  }

  return NextResponse.json({
    ok: true,
    provider,
    message: `${provider.toUpperCase()} 自动同步凭证已配置，下一步可以接真实 connector 拉取成交记录。`
  });
}
