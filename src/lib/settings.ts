import { AppSettings, OpenClawNotificationSettings } from "@/lib/types";

export function getDefaultNotificationConfig(): OpenClawNotificationSettings {
  return {
    enabled: process.env.OPENCLAW_NOTIFY_ENABLED === "true",
    account: process.env.OPENCLAW_NOTIFY_ACCOUNT ?? "",
    channel: process.env.OPENCLAW_NOTIFY_CHANNEL ?? "",
    target: process.env.OPENCLAW_NOTIFY_TARGET ?? "",
    minConfidence: Number(process.env.OPENCLAW_NOTIFY_MIN_CONFIDENCE ?? 60)
  };
}

export function getDefaultAppSettings(): AppSettings {
  return {
    marketDataProvider: process.env.MARKET_DATA_PROVIDER ?? "demo",
    aiProvider: process.env.OPENAI_API_KEY ? "openai" : "rules",
    defaultMarkets: ["US", "HK", "CN"],
    riskProfile: "balanced",
    notificationConfig: getDefaultNotificationConfig()
  };
}

export function normalizeNotificationConfig(
  config?: Partial<OpenClawNotificationSettings> | null
): OpenClawNotificationSettings {
  const defaults = getDefaultNotificationConfig();
  return {
    enabled: config?.enabled ?? defaults.enabled,
    account: config?.account ?? defaults.account,
    channel: config?.channel ?? defaults.channel,
    target: config?.target ?? defaults.target,
    minConfidence: Number.isFinite(config?.minConfidence) ? Number(config?.minConfidence) : defaults.minConfidence
  };
}

export function normalizeAppSettings(settings?: Partial<AppSettings> | null): AppSettings {
  const defaults = getDefaultAppSettings();
  return {
    marketDataProvider: settings?.marketDataProvider ?? defaults.marketDataProvider,
    aiProvider: settings?.aiProvider ?? defaults.aiProvider,
    defaultMarkets: settings?.defaultMarkets?.length ? settings.defaultMarkets : defaults.defaultMarkets,
    riskProfile: settings?.riskProfile ?? defaults.riskProfile,
    notificationConfig: normalizeNotificationConfig(settings?.notificationConfig)
  };
}
