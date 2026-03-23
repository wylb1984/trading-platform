import { AppSettings, CashFlowItem, PortfolioHolding, TradeLogItem, WatchlistItem } from "@/lib/types";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  getPortfolioDraft as getLocalPortfolioDraft,
  getCashFlows as getLocalCashFlows,
  getSettings as getLocalSettings,
  getTradeLogs as getLocalTradeLogs,
  getWatchlist as getLocalWatchlist,
  savePortfolioDraft as saveLocalPortfolioDraft,
  saveCashFlows as saveLocalCashFlows,
  saveSettings as saveLocalSettings,
  saveTradeLogs as saveLocalTradeLogs,
  saveWatchlist as saveLocalWatchlist
} from "@/lib/storage";

type StorageProvider = "local" | "supabase";

function getStorageProvider(): StorageProvider {
  return (process.env.APP_STORAGE_PROVIDER ?? "local") as StorageProvider;
}

async function getSupabaseWatchlistForUser(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }

  return data.map((item) => ({
    symbol: item.symbol as string,
    market: item.market as WatchlistItem["market"],
    note: (item.note as string | null) ?? undefined,
    createdAt: item.created_at as string
  }));
}

async function putSupabaseWatchlistForUser(userId: string, items: WatchlistItem[]) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  await client.from("watchlist_items").delete().eq("user_id", userId);
  const payload = items.map((item) => ({
    user_id: userId,
    symbol: item.symbol,
    market: item.market,
    note: item.note ?? null,
    created_at: item.createdAt
  }));
  const { error } = await client.from("watchlist_items").insert(payload);
  if (error) {
    throw error;
  }

  return items;
}

async function getSupabasePortfolioDraftForUser(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.from("portfolio_draft_items").select("*").eq("user_id", userId).order("symbol");
  if (error) {
    throw error;
  }

  return data.map((item) => ({
    symbol: item.symbol as string,
    market: item.market as PortfolioHolding["market"],
    quantity: Number(item.quantity),
    averageCost: Number(item.average_cost)
  }));
}

async function putSupabasePortfolioDraftForUser(userId: string, items: PortfolioHolding[]) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  await client.from("portfolio_draft_items").delete().eq("user_id", userId);
  const payload = items.map((item) => ({
    user_id: userId,
    symbol: item.symbol,
    market: item.market,
    quantity: item.quantity,
    average_cost: item.averageCost
  }));
  const { error } = await client.from("portfolio_draft_items").insert(payload);
  if (error) {
    throw error;
  }

  return items;
}

async function getSupabaseSettingsForUser(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.from("app_settings").select("*").eq("user_id", userId).limit(1).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  return {
    marketDataProvider: data.market_data_provider as string,
    aiProvider: data.ai_provider as string,
    defaultMarkets: (data.default_markets as AppSettings["defaultMarkets"]) ?? ["US", "HK", "CN"],
    riskProfile: (data.risk_profile as AppSettings["riskProfile"]) ?? "balanced"
  };
}

async function putSupabaseSettingsForUser(userId: string, settings: AppSettings) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { error } = await client.from("app_settings").upsert({
    user_id: userId,
    market_data_provider: settings.marketDataProvider,
    ai_provider: settings.aiProvider,
    default_markets: settings.defaultMarkets,
    risk_profile: settings.riskProfile
  });
  if (error) {
    throw error;
  }

  return settings;
}

async function getSupabaseTradeLogsForUser(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.from("trade_logs").select("*").eq("user_id", userId).order("trade_date", { ascending: false });
  if (error) {
    throw error;
  }

  return data.map((item) => ({
    id: item.id as string,
    symbol: item.symbol as string,
    market: item.market as TradeLogItem["market"],
    side: item.side as TradeLogItem["side"],
    quantity: Number(item.quantity),
    price: Number(item.price),
    fee: Number(item.fee ?? 0),
    tradeDate: item.trade_date as string,
    note: (item.note as string | null) ?? undefined
  }));
}

async function putSupabaseTradeLogsForUser(userId: string, items: TradeLogItem[]) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  await client.from("trade_logs").delete().eq("user_id", userId);
  if (items.length === 0) {
    return items;
  }

  const payload = items.map((item) => ({
    id: item.id,
    user_id: userId,
    symbol: item.symbol,
    market: item.market,
    side: item.side,
    quantity: item.quantity,
    price: item.price,
    fee: item.fee ?? 0,
    trade_date: item.tradeDate,
    note: item.note ?? null
  }));
  const { error } = await client.from("trade_logs").insert(payload);
  if (error) {
    throw error;
  }
  return items;
}

async function getSupabaseCashFlowsForUser(userId: string) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  const { data, error } = await client.from("cash_flows").select("*").eq("user_id", userId).order("flow_date", { ascending: false });
  if (error) {
    throw error;
  }

  return data.map((item) => ({
    id: item.id as string,
    amount: Number(item.amount),
    flowDate: item.flow_date as string,
    type: item.type as CashFlowItem["type"],
    note: (item.note as string | null) ?? undefined
  }));
}

async function putSupabaseCashFlowsForUser(userId: string, items: CashFlowItem[]) {
  const client = getSupabaseAdminClient();
  if (!client) {
    return null;
  }

  await client.from("cash_flows").delete().eq("user_id", userId);
  if (items.length === 0) {
    return items;
  }

  const payload = items.map((item) => ({
    id: item.id,
    user_id: userId,
    amount: item.amount,
    flow_date: item.flowDate,
    type: item.type,
    note: item.note ?? null
  }));
  const { error } = await client.from("cash_flows").insert(payload);
  if (error) {
    throw error;
  }
  return items;
}

export async function repositoryGetWatchlist(userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return getLocalWatchlist();
    }
    return (await getSupabaseWatchlistForUser(userId)) ?? getLocalWatchlist();
  }
  return getLocalWatchlist();
}

export async function repositorySaveWatchlist(items: WatchlistItem[], userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return saveLocalWatchlist(items);
    }
    return (await putSupabaseWatchlistForUser(userId, items)) ?? saveLocalWatchlist(items);
  }
  return saveLocalWatchlist(items);
}

export async function repositoryGetPortfolioDraft(userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return getLocalPortfolioDraft();
    }
    return (await getSupabasePortfolioDraftForUser(userId)) ?? getLocalPortfolioDraft();
  }
  return getLocalPortfolioDraft();
}

export async function repositorySavePortfolioDraft(items: PortfolioHolding[], userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return saveLocalPortfolioDraft(items);
    }
    return (await putSupabasePortfolioDraftForUser(userId, items)) ?? saveLocalPortfolioDraft(items);
  }
  return saveLocalPortfolioDraft(items);
}

export async function repositoryGetSettings(userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return getLocalSettings();
    }
    return (await getSupabaseSettingsForUser(userId)) ?? getLocalSettings();
  }
  return getLocalSettings();
}

export async function repositorySaveSettings(settings: AppSettings, userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return saveLocalSettings(settings);
    }
    return (await putSupabaseSettingsForUser(userId, settings)) ?? saveLocalSettings(settings);
  }
  return saveLocalSettings(settings);
}

export async function repositoryGetTradeLogs(userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return getLocalTradeLogs();
    }
    return (await getSupabaseTradeLogsForUser(userId)) ?? getLocalTradeLogs();
  }
  return getLocalTradeLogs();
}

export async function repositorySaveTradeLogs(items: TradeLogItem[], userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return saveLocalTradeLogs(items);
    }
    return (await putSupabaseTradeLogsForUser(userId, items)) ?? saveLocalTradeLogs(items);
  }
  return saveLocalTradeLogs(items);
}

export async function repositoryGetCashFlows(userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return getLocalCashFlows();
    }
    return (await getSupabaseCashFlowsForUser(userId)) ?? getLocalCashFlows();
  }
  return getLocalCashFlows();
}

export async function repositorySaveCashFlows(items: CashFlowItem[], userId?: string | null) {
  if (getStorageProvider() === "supabase") {
    if (!userId) {
      return saveLocalCashFlows(items);
    }
    return (await putSupabaseCashFlowsForUser(userId, items)) ?? saveLocalCashFlows(items);
  }
  return saveLocalCashFlows(items);
}
