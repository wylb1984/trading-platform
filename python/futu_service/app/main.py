from __future__ import annotations

from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query

from .futu_client import FutuUnavailableError, get_history_deals, get_history_orders, list_accounts
from .models import AccountResponse, DealResponse, HealthResponse, OrderResponse

app = FastAPI(title="Futu Bridge", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
def health():
    return {"ok": True}


@app.get("/accounts", response_model=List[AccountResponse])
def accounts(trd_env: Optional[str] = Query(default=None)):
    try:
        return [AccountResponse(**item) for item in list_accounts(trd_env=trd_env)]
    except FutuUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/history-deals", response_model=List[DealResponse])
def history_deals(
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    acc_id: Optional[str] = Query(default=None),
    trd_env: Optional[str] = Query(default=None),
):
    try:
        return [DealResponse(**item) for item in get_history_deals(start=start, end=end, acc_id=acc_id, trd_env=trd_env)]
    except FutuUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/history-orders", response_model=List[OrderResponse])
def history_orders(
    start: str = Query(..., description="YYYY-MM-DD"),
    end: str = Query(..., description="YYYY-MM-DD"),
    acc_id: Optional[str] = Query(default=None),
    trd_env: Optional[str] = Query(default=None),
):
    try:
        return [OrderResponse(**item) for item in get_history_orders(start=start, end=end, acc_id=acc_id, trd_env=trd_env)]
    except FutuUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
