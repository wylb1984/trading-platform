from typing import Any, Literal

from pydantic import BaseModel


class QuoteResponse(BaseModel):
    symbol: str
    name: str
    market: str
    price: float
    change: float
    change_pct: float
    volume: float | int | None = None
    source: str = "openbb"
    raw: dict[str, Any] | None = None


class CandleResponse(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float | int | None = None


class NewsResponse(BaseModel):
    id: str
    title: str
    source: str
    published_at: str
    url: str
    summary: str
    sentiment: Literal["positive", "neutral", "negative"] = "neutral"


class SymbolAnalysisResponse(BaseModel):
    symbol: str
    market: str
    quote: QuoteResponse
    candles: list[CandleResponse]
    news: list[NewsResponse]
    notes: list[str]


class SearchResultResponse(BaseModel):
    symbol: str
    name: str
    market: str
    assetClass: str | None = None
    exchange: str | None = None
