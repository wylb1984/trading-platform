from __future__ import annotations

from fastapi import FastAPI, HTTPException, Query

from .models import CandleResponse, NewsResponse, QuoteResponse, SearchResultResponse, SymbolAnalysisResponse
from .openbb_client import OpenBBUnavailableError, get_candles, get_news, get_quote, search_symbols

app = FastAPI(title="OpenBB Bridge", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/quote", response_model=QuoteResponse)
def quote(symbol: str = Query(...), market: str | None = Query(default=None)):
    try:
        data = get_quote(symbol, market)
    except OpenBBUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return QuoteResponse(**data)


@app.get("/candles", response_model=list[CandleResponse])
def candles(
    symbol: str = Query(...),
    market: str | None = Query(default=None),
    interval: str = Query(default="1d"),
    limit: int = Query(default=120),
):
    try:
        data = get_candles(symbol, market, interval=interval, limit=limit)
    except OpenBBUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [CandleResponse(**item) for item in data]


@app.get("/news", response_model=list[NewsResponse])
def news(symbol: str = Query(...)):
    try:
        data = get_news(symbol)
    except OpenBBUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [NewsResponse(**item) for item in data]


@app.get("/search", response_model=list[SearchResultResponse])
def search(query: str = Query(...)):
    try:
        data = search_symbols(query)
    except OpenBBUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [SearchResultResponse(**item) for item in data]


@app.get("/symbol-analysis", response_model=SymbolAnalysisResponse)
def symbol_analysis(symbol: str = Query(...), market: str | None = Query(default=None)):
    try:
        quote_data = get_quote(symbol, market)
        candle_data = get_candles(symbol, market)
        news_data = get_news(symbol)
    except OpenBBUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    notes = [
        "This route is designed as a raw OpenBB-backed data bridge.",
        "The main Next.js app should enrich this payload into signals and execution views.",
    ]

    return SymbolAnalysisResponse(
        symbol=symbol,
        market=quote_data["market"],
        quote=QuoteResponse(**quote_data),
        candles=[CandleResponse(**item) for item in candle_data],
        news=[NewsResponse(**item) for item in news_data],
        notes=notes,
    )
