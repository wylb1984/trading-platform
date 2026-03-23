from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class HealthResponse(BaseModel):
    ok: bool


class AccountResponse(BaseModel):
    acc_id: str
    trd_env: str
    acc_type: Optional[str] = None
    card_num: Optional[str] = None
    uni_card_num: Optional[str] = None
    security_firm: Optional[str] = None


class DealResponse(BaseModel):
    deal_id: str
    order_id: Optional[str] = None
    code: str
    stock_name: Optional[str] = None
    trd_side: str
    qty: float
    price: float
    create_time: str
    deal_market: Optional[str] = None
    fee: Optional[float] = None
    currency: Optional[str] = None
    status: Optional[str] = None


class OrderResponse(BaseModel):
    order_id: str
    code: str
    stock_name: Optional[str] = None
    trd_side: Optional[str] = None
    qty: Optional[float] = None
    price: Optional[float] = None
    create_time: Optional[str] = None
    updated_time: Optional[str] = None
    order_status: Optional[str] = None
    order_market: Optional[str] = None


class CashFlowResponse(BaseModel):
    business_time: str
    currency: Optional[str] = None
    business_type: Optional[str] = None
    amount: Optional[float] = None
    balance: Optional[float] = None
    remark: Optional[str] = None
