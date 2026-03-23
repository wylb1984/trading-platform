from __future__ import annotations

import os
from datetime import datetime
from typing import Any

os.environ.setdefault("OPENBB_LOG_DIR", "/tmp/openbb-logs")
os.environ.setdefault("OPENBB_OUTPUT_DIR", "/tmp/openbb-data")

try:
    from openbb import obb
except Exception:  # pragma: no cover - runtime environment specific
    obb = None


class OpenBBUnavailableError(RuntimeError):
    pass


def _ensure_obb():
    if obb is None:
        raise OpenBBUnavailableError("OpenBB is not available in the current Python environment.")
    return obb


def _normalize_market(symbol: str, market: str | None = None) -> str:
    if market:
        return market
    if symbol.endswith(".HK"):
        return "HK"
    if symbol.endswith(".SH") or symbol.endswith(".SZ"):
        return "CN"
    return "US"


def get_quote(symbol: str, market: str | None = None) -> dict[str, Any]:
    client = _ensure_obb()
    try:
        data = client.equity.price.quote(symbol).to_dict()
        if isinstance(data, list):
            data = data[0]
        price = float(data.get("last_price") or data.get("close") or 0)
        if price <= 0:
            raise OpenBBUnavailableError(f"OpenBB did not return a valid price for {symbol}.")
        prev_close = float(data.get("prev_close") or data.get("previous_close") or price or 1)
        change = price - prev_close
        change_pct = 0.0 if prev_close == 0 else (change / prev_close) * 100
        return {
            "symbol": symbol,
            "name": data.get("name") or symbol,
            "market": _normalize_market(symbol, market),
            "price": round(price, 4),
            "change": round(change, 4),
            "change_pct": round(change_pct, 4),
            "volume": data.get("volume"),
            "source": "openbb",
            "raw": data,
        }
    except Exception as exc:
        raise OpenBBUnavailableError(f"OpenBB quote lookup failed for {symbol}.") from exc


def get_candles(symbol: str, market: str | None = None, interval: str = "1d", limit: int = 120) -> list[dict[str, Any]]:
    client = _ensure_obb()
    try:
        end_date = datetime.utcnow().date()
        data = client.equity.price.historical(symbol, start_date="2024-01-01", end_date=str(end_date), interval=interval).to_df()
        rows = []
        for index, row in data.tail(limit).iterrows():
            rows.append(
                {
                    "date": str(index)[:10],
                    "open": float(row.get("open", 0)),
                    "high": float(row.get("high", 0)),
                    "low": float(row.get("low", 0)),
                    "close": float(row.get("close", 0)),
                    "volume": float(row.get("volume", 0)) if row.get("volume") is not None else None,
                }
            )
        return rows
    except Exception:
        return []


def get_news(symbol: str) -> list[dict[str, Any]]:
    client = _ensure_obb()
    try:
        data = client.news.company(symbol).to_df().reset_index(drop=True)
        rows = []
        for idx, row in data.head(10).iterrows():
            rows.append(
                {
                    "id": f"{symbol}-{idx}",
                    "title": str(row.get("title") or ""),
                    "source": str(row.get("source") or "openbb"),
                    "published_at": str(row.get("date") or ""),
                    "url": str(row.get("url") or ""),
                    "summary": str(row.get("text") or row.get("summary") or ""),
                    "sentiment": "neutral",
                }
            )
        return rows
    except Exception:
        return []


def search_symbols(query: str) -> list[dict[str, Any]]:
    client = _ensure_obb()
    try:
        data = client.equity.search(query=query).to_df().reset_index(drop=True)
        rows = []
        for _, row in data.head(15).iterrows():
            symbol = str(row.get("symbol") or row.get("ticker") or "")
            market = _normalize_market(symbol)
            rows.append(
                {
                    "symbol": symbol,
                    "name": str(row.get("name") or symbol),
                    "market": market,
                    "assetClass": str(row.get("asset_type") or "stock"),
                    "exchange": str(row.get("exchange") or ""),
                }
            )
        return rows
    except Exception:
        return []
