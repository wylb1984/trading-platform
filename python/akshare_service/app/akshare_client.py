from __future__ import annotations

from datetime import datetime
import time
from typing import Any, Dict, List, Optional


class AkshareUnavailableError(RuntimeError):
    pass


_CACHE_TTL_SECONDS = 60
_cache: Dict[str, tuple[float, Any]] = {}


def _cache_get(key: str):
    item = _cache.get(key)
    if not item:
        return None
    expires_at, value = item
    if expires_at < time.time():
        _cache.pop(key, None)
        return None
    return value


def _cache_set(key: str, value: Any, ttl: int = _CACHE_TTL_SECONDS):
    _cache[key] = (time.time() + ttl, value)
    return value


def _import_akshare():
    try:
        import akshare as ak
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise AkshareUnavailableError(f"akshare unavailable: {exc}") from exc
    return ak


def _normalize_change_pct(value: Any) -> float:
    if value is None:
        return 0.0
    return float(str(value).replace("%", "").strip())


def _get_cn_spot(ak):
    cache_key = "spot:cn"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    return _cache_set(cache_key, ak.stock_zh_a_spot_em())


def _get_cn_index_spot(ak, category: str):
    cache_key = f"spot:cn:index:{category}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    return _cache_set(cache_key, ak.stock_zh_index_spot_em(symbol=category))


def _get_hk_spot(ak):
    cache_key = "spot:hk"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    return _cache_set(cache_key, ak.stock_hk_spot_em())


def _get_hk_index_spot(ak):
    cache_key = "spot:hk:index"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    return _cache_set(cache_key, ak.stock_hk_index_spot_em())


def _get_us_spot(ak):
    cache_key = "spot:us"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    return _cache_set(cache_key, ak.stock_us_spot_em())


def get_quote(symbol: str, market: Optional[str] = None) -> Dict[str, Any]:
    cache_key = f"quote:{market or ''}:{symbol}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ak = _import_akshare()
    resolved_market = market or ("CN" if symbol.endswith((".SH", ".SZ")) else "HK" if symbol.endswith(".HK") else "US")

    try:
        if symbol in ("000001.SH", "399001.SZ"):
            category = "深证系列指数" if symbol == "399001.SZ" else "上证系列指数"
            spot = _get_cn_index_spot(ak, category)
            code = symbol.split(".")[0]
            row = spot.loc[spot["代码"].astype(str) == code].iloc[0]
            return _cache_set(
                cache_key,
                {
                    "symbol": symbol,
                    "name": str(row["名称"]),
                    "market": "CN",
                    "price": float(row["最新价"]),
                    "change": float(row.get("涨跌额", 0) or 0),
                    "change_pct": _normalize_change_pct(row.get("涨跌幅", 0)),
                    "volume": float(row.get("成交量", 0) or 0),
                },
            )

        if symbol in ("HSI", "HSTECH"):
            spot = _get_hk_index_spot(ak)
            keyword = "恒生指数" if symbol == "HSI" else "恒生科技指数"
            rows = spot[spot["名称"].astype(str).str.contains(keyword, case=False, na=False)]
            row = rows.iloc[0]
            return _cache_set(
                cache_key,
                {
                    "symbol": symbol,
                    "name": str(row["名称"]),
                    "market": "HK",
                    "price": float(row["最新价"]),
                    "change": float(row.get("涨跌额", 0) or 0),
                    "change_pct": _normalize_change_pct(row.get("涨跌幅", 0)),
                    "volume": float(row.get("成交量", 0) or 0),
                },
            )

        if resolved_market == "CN":
            spot = _get_cn_spot(ak)
            code = symbol.split(".")[0]
            row = spot.loc[spot["代码"] == code].iloc[0]
            return _cache_set(
                cache_key,
                {
                "symbol": symbol,
                "name": str(row["名称"]),
                "market": "CN",
                "price": float(row["最新价"]),
                "change": float(row.get("涨跌额", 0) or 0),
                "change_pct": _normalize_change_pct(row.get("涨跌幅", 0)),
                "volume": float(row.get("成交量", 0) or 0),
                },
            )

        if resolved_market == "HK":
            spot = _get_hk_spot(ak)
            code = symbol.replace(".HK", "")
            row = spot.loc[spot["代码"] == code].iloc[0]
            return _cache_set(
                cache_key,
                {
                "symbol": symbol,
                "name": str(row["名称"]),
                "market": "HK",
                "price": float(row["最新价"]),
                "change": float(row.get("涨跌额", 0) or 0),
                "change_pct": _normalize_change_pct(row.get("涨跌幅", 0)),
                "volume": float(row.get("成交量", 0) or 0),
                },
            )

        spot = _get_us_spot(ak)
        row = spot.loc[spot["代码"] == symbol].iloc[0]
        return _cache_set(
            cache_key,
            {
            "symbol": symbol,
            "name": str(row["名称"]),
            "market": "US",
            "price": float(row["最新价"]),
            "change": float(row.get("涨跌额", 0) or 0),
            "change_pct": _normalize_change_pct(row.get("涨跌幅", 0)),
            "volume": float(row.get("成交量", 0) or 0),
            },
        )
    except Exception as exc:  # pragma: no cover - runtime/data dependency
        raise AkshareUnavailableError(f"akshare quote unavailable for {symbol}: {exc}") from exc


def search_symbols(query: str) -> List[Dict[str, Any]]:
    cache_key = f"search:{query.upper()}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ak = _import_akshare()
    upper = query.upper()

    def _rows_to_items(rows, symbol_key: str, name_key: str, market: str, exchange: str):
        results: List[Dict[str, Any]] = []
        for _, row in rows.head(10).iterrows():
            symbol = str(row[symbol_key]).strip()
            if market == "CN":
                suffix = ".SH" if symbol.startswith(("5", "6", "9")) else ".SZ"
                symbol = f"{symbol}{suffix}"
            elif market == "HK":
                symbol = f"{symbol}.HK"
            results.append(
                {
                    "symbol": symbol,
                    "name": str(row[name_key]).strip(),
                    "market": market,
                    "assetClass": "stock",
                    "exchange": exchange,
                }
            )
        return results

    try:
        if upper.endswith(".HK") or upper.isdigit() and len(upper) <= 5:
            spot = _get_hk_spot(ak)
            rows = spot[spot["代码"].astype(str).str.contains(upper.replace(".HK", ""), case=False, na=False)]
            return _cache_set(cache_key, _rows_to_items(rows, "代码", "名称", "HK", "HKEX"))

        if upper.endswith(".SH") or upper.endswith(".SZ") or (upper.isdigit() and len(upper) == 6):
            spot = _get_cn_spot(ak)
            raw = upper.replace(".SH", "").replace(".SZ", "")
            rows = spot[
                spot["代码"].astype(str).str.contains(raw, case=False, na=False)
                | spot["名称"].astype(str).str.contains(query, case=False, na=False)
            ]
            return _cache_set(cache_key, _rows_to_items(rows, "代码", "名称", "CN", "CN"))

        spot = _get_us_spot(ak)
        rows = spot[
            spot["代码"].astype(str).str.contains(upper, case=False, na=False)
            | spot["名称"].astype(str).str.contains(query, case=False, na=False)
        ]
        return _cache_set(cache_key, _rows_to_items(rows, "代码", "名称", "US", "US"))
    except Exception as exc:  # pragma: no cover - runtime/data dependency
        raise AkshareUnavailableError(f"akshare search unavailable: {exc}") from exc


def get_news(symbol: str) -> List[Dict[str, Any]]:
    cache_key = f"news:{symbol}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    return _cache_set(cache_key, [
        {
            "id": f"{symbol}-akshare-news-0",
            "title": f"{symbol} AKShare bridge online",
            "source": "AKShare Bridge",
            "published_at": datetime.utcnow().isoformat(),
            "url": "",
            "summary": "AKShare bridge has not yet been wired to a dedicated news source. This placeholder keeps the provider chain stable.",
            "sentiment": "neutral",
        }
    ], ttl=120)


def get_candles(symbol: str, market: Optional[str] = None, limit: int = 180) -> List[Dict[str, Any]]:
    cache_key = f"candles:{market or ''}:{symbol}:{limit}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    ak = _import_akshare()
    resolved_market = market or ("CN" if symbol.endswith((".SH", ".SZ")) else "HK" if symbol.endswith(".HK") else "US")

    try:
        if resolved_market == "CN":
            period = "daily"
            adjust = "qfq"
            code = symbol.split(".")[0]
            hist = ak.stock_zh_a_hist(symbol=code, period=period, adjust=adjust)
            rows = hist.tail(limit)
            return _cache_set(
                cache_key,
                [
                    {
                        "date": str(row["日期"])[:10],
                        "open": float(row["开盘"]),
                        "high": float(row["最高"]),
                        "low": float(row["最低"]),
                        "close": float(row["收盘"]),
                        "volume": float(row.get("成交量", 0) or 0),
                    }
                    for _, row in rows.iterrows()
                ],
                ttl=300,
            )

        if resolved_market == "HK":
            code = symbol.replace(".HK", "")
            hist = ak.stock_hk_hist(symbol=code, adjust="qfq")
            rows = hist.tail(limit)
            return _cache_set(
                cache_key,
                [
                    {
                        "date": str(row["日期"])[:10],
                        "open": float(row["开盘"]),
                        "high": float(row["最高"]),
                        "low": float(row["最低"]),
                        "close": float(row["收盘"]),
                        "volume": float(row.get("成交量", 0) or 0),
                    }
                    for _, row in rows.iterrows()
                ],
                ttl=300,
            )
    except Exception as exc:  # pragma: no cover - runtime/data dependency
        raise AkshareUnavailableError(f"akshare candles unavailable for {symbol}: {exc}") from exc

    return []
