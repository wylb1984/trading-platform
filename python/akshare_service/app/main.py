from __future__ import annotations

from typing import Optional

from fastapi import FastAPI, HTTPException, Query

from .akshare_client import AkshareUnavailableError, get_candles, get_news, get_quote, search_symbols
from .models import CandleResponse, NewsResponse, QuoteResponse, SearchResultResponse

app = FastAPI(title="AKShare Bridge", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/quote", response_model=QuoteResponse)
def quote(symbol: str = Query(...), market: Optional[str] = Query(default=None)):
    try:
        return QuoteResponse(**get_quote(symbol, market))
    except AkshareUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/search", response_model=list[SearchResultResponse])
def search(query: str = Query(...)):
    try:
        return [SearchResultResponse(**item) for item in search_symbols(query)]
    except AkshareUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/candles", response_model=list[CandleResponse])
def candles(symbol: str = Query(...), market: Optional[str] = Query(default=None), limit: int = Query(default=180)):
    try:
        return [CandleResponse(**item) for item in get_candles(symbol, market, limit=limit)]
    except AkshareUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/news", response_model=list[NewsResponse])
def news(symbol: str = Query(...)):
    try:
        return [NewsResponse(**item) for item in get_news(symbol)]
    except AkshareUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
