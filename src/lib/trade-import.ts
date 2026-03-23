import { Market, TradeLogItem } from "@/lib/types";

type TradeImportProvider = "generic" | "futu" | "ib";

type CsvRow = Record<string, string>;

export interface TradeImportResult {
  provider: TradeImportProvider;
  items: TradeLogItem[];
  errors: string[];
}

const providerHeaderHints: Record<Exclude<TradeImportProvider, "generic">, string[]> = {
  futu: ["股票名称", "证券代码", "成交方向", "成交均价", "成交数量"],
  ib: ["Symbol", "Date/Time", "Quantity", "T. Price", "Comm/Fee"]
};

const genericAliases = {
  symbol: ["symbol", "ticker", "code", "证券代码", "代码", "Symbol"],
  market: ["market", "市场", "Market"],
  side: ["side", "成交方向", "买卖", "action", "Action"],
  quantity: ["quantity", "qty", "成交数量", "数量", "Quantity"],
  price: ["price", "成交均价", "trade_price", "T. Price", "成交价格"],
  fee: ["fee", "commission", "手续费", "Comm/Fee", "费用"],
  tradeDate: ["tradeDate", "date", "成交时间", "成交日期", "Date/Time", "日期时间"],
  note: ["note", "remarks", "备注", "description", "Description"]
} as const;

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }
    if (char === "," && !insideQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseCsv(csv: string) {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]!).map((item) => item.replace(/^\uFEFF/, "").trim());
  return lines.slice(1).map((line) => {
    const columns = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, columns[index] ?? ""]));
  });
}

function detectProvider(rows: CsvRow[]): TradeImportProvider {
  const headers = Object.keys(rows[0] ?? {});
  for (const [provider, hints] of Object.entries(providerHeaderHints) as Array<[Exclude<TradeImportProvider, "generic">, string[]]>) {
    if (hints.every((hint) => headers.includes(hint))) {
      return provider;
    }
  }
  return "generic";
}

function readField(row: CsvRow, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== "") {
      return value.trim();
    }
  }
  return "";
}

function parseNumber(input: string) {
  const normalized = input.replace(/[,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : NaN;
}

function normalizeSide(input: string): TradeLogItem["side"] | null {
  const value = input.trim().toUpperCase();
  if (["BUY", "B", "BOT", "买入", "证券买入"].includes(value)) {
    return "BUY";
  }
  if (["SELL", "S", "SLD", "卖出", "证券卖出"].includes(value)) {
    return "SELL";
  }
  return null;
}

function inferMarket(symbol: string, rawMarket: string) {
  const market = rawMarket.trim().toUpperCase();
  if (market === "US" || market.includes("NASDAQ") || market.includes("NYSE") || market.includes("美国")) {
    return "US" as Market;
  }
  if (market === "HK" || market.includes("HKEX") || market.includes("HONG KONG") || market.includes("香港")) {
    return "HK" as Market;
  }
  if (market === "CN" || market.includes("SSE") || market.includes("SZSE") || market.includes("上交所") || market.includes("深交所") || market.includes("中国")) {
    return "CN" as Market;
  }
  if (/\.HK$/i.test(symbol)) {
    return "HK" as Market;
  }
  if (/\.(SH|SZ)$/i.test(symbol)) {
    return "CN" as Market;
  }
  if (/^\d{4,5}$/.test(symbol)) {
    return "HK" as Market;
  }
  if (/^\d{6}$/.test(symbol)) {
    return "CN" as Market;
  }
  return "US" as Market;
}

function normalizeSymbol(symbol: string, market: Market) {
  const trimmed = symbol.trim().toUpperCase();
  if (market === "HK") {
    const base = trimmed.replace(/\.HK$/i, "");
    return /^\d+$/.test(base) ? `${base.padStart(4, "0")}.HK` : `${base}.HK`;
  }
  if (market === "CN") {
    const base = trimmed.replace(/\.(SH|SZ)$/i, "");
    if (trimmed.endsWith(".SH") || base.startsWith("6")) {
      return `${base}.SH`;
    }
    return `${base}.SZ`;
  }
  return trimmed.replace(/\.(US|NYSE|NASDAQ)$/i, "");
}

function normalizeDate(input: string) {
  const value = input.trim().replace(/\//g, "-");
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
}

function mapRow(row: CsvRow, provider: TradeImportProvider, index: number): { item?: TradeLogItem; error?: string } {
  const symbolRaw =
    provider === "futu" ? row["证券代码"] ?? row["股票代码"] ?? "" : readField(row, genericAliases.symbol);
  const marketRaw =
    provider === "futu" ? row["市场"] ?? row["Market"] ?? "" : provider === "ib" ? row["Listing Exch"] ?? row["Exchange"] ?? "" : readField(row, genericAliases.market);
  const sideRaw =
    provider === "futu" ? row["成交方向"] ?? "" : provider === "ib" ? row["Buy/Sell"] ?? row["Action"] ?? "" : readField(row, genericAliases.side);
  const quantityRaw =
    provider === "futu" ? row["成交数量"] ?? "" : provider === "ib" ? row["Quantity"] ?? "" : readField(row, genericAliases.quantity);
  const priceRaw =
    provider === "futu" ? row["成交均价"] ?? row["成交价格"] ?? "" : provider === "ib" ? row["T. Price"] ?? "" : readField(row, genericAliases.price);
  const feeRaw =
    provider === "futu" ? row["手续费"] ?? row["交易费"] ?? "" : provider === "ib" ? row["Comm/Fee"] ?? "" : readField(row, genericAliases.fee);
  const dateRaw =
    provider === "futu" ? row["成交时间"] ?? row["成交日期"] ?? "" : provider === "ib" ? row["Date/Time"] ?? "" : readField(row, genericAliases.tradeDate);
  const noteRaw =
    provider === "futu" ? row["备注"] ?? row["股票名称"] ?? "" : provider === "ib" ? row["Description"] ?? "" : readField(row, genericAliases.note);

  const side = normalizeSide(sideRaw);
  const quantity = parseNumber(quantityRaw);
  const price = parseNumber(priceRaw);
  const fee = feeRaw ? parseNumber(feeRaw) : 0;
  const tradeDate = normalizeDate(dateRaw);
  const market = inferMarket(symbolRaw, marketRaw);
  const symbol = normalizeSymbol(symbolRaw, market);

  if (!symbolRaw || !side || !Number.isFinite(quantity) || !Number.isFinite(price) || !tradeDate) {
    return {
      error: `第 ${index + 2} 行解析失败：symbol/side/quantity/price/tradeDate 至少有一项无效`
    };
  }

  return {
    item: {
      id: crypto.randomUUID(),
      symbol,
      market,
      side,
      quantity,
      price,
      fee: Number.isFinite(fee) ? Math.abs(fee) : 0,
      tradeDate,
      note: noteRaw || undefined
    }
  };
}

export function importTradesFromCsv(csv: string, requestedProvider?: TradeImportProvider): TradeImportResult {
  const rows = parseCsv(csv);
  if (!rows.length) {
    return { provider: requestedProvider ?? "generic", items: [], errors: ["CSV 至少需要表头和一行数据"] };
  }

  const provider = requestedProvider ?? detectProvider(rows);
  const mapped = rows.map((row, index) => mapRow(row, provider, index));
  const items = mapped.flatMap((entry) => (entry.item ? [entry.item] : []));
  const errors = mapped.flatMap((entry) => (entry.error ? [entry.error] : []));

  return {
    provider,
    items,
    errors
  };
}

export function mergeTradeImports(current: TradeLogItem[], imported: TradeLogItem[]) {
  const seen = new Set<string>();
  const merged: TradeLogItem[] = [];

  for (const item of [...imported, ...current]) {
    const key = [item.symbol, item.market, item.side, item.quantity, item.price, item.tradeDate].join("|");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged.sort((left, right) => right.tradeDate.localeCompare(left.tradeDate));
}
