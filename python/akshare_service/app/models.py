from typing import Literal, Optional, Union

from pydantic import BaseModel


class QuoteResponse(BaseModel):
    symbol: str
    name: str
    market: str
    price: float
    change: float
    change_pct: float
    volume: Optional[Union[float, int]] = None
    source: str = "akshare"


class SearchResultResponse(BaseModel):
    symbol: str
    name: str
    market: str
    assetClass: Optional[str] = None
    exchange: Optional[str] = None


class NewsResponse(BaseModel):
    id: str
    title: str
    source: str
    published_at: str
    url: str
    summary: str
    sentiment: Literal["positive", "neutral", "negative"] = "neutral"


class CandleResponse(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: Optional[Union[float, int]] = None
