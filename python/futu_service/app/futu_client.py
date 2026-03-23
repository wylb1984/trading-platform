from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Dict, List, Optional


class FutuUnavailableError(RuntimeError):
    pass


def _import_futu():
    try:
        import futu as ft
    except Exception as exc:  # pragma: no cover - runtime dependency
        raise FutuUnavailableError(
            "futu python sdk is not installed. Run `pip install futu-api` in the futu bridge environment."
        ) from exc
    return ft


def _parse_trd_env(ft, value: Optional[str]):
    normalized = (value or os.getenv("FUTU_TRD_ENV") or "REAL").upper()
    return ft.TrdEnv.SIMULATE if normalized in {"SIMULATE", "SIM", "PAPER"} else ft.TrdEnv.REAL


def _build_context(ft):
    host = os.getenv("FUTU_OPEND_HOST", "127.0.0.1")
    port = int(os.getenv("FUTU_OPEND_PORT", "11111"))
    return ft.OpenSecTradeContext(filter_trdmarket=ft.TrdMarket.NONE, host=host, port=port)


@contextmanager
def trade_context():
    ft = _import_futu()
    ctx = _build_context(ft)
    try:
        yield ft, ctx
    finally:
        ctx.close()


def _expect_ok(ft, response):
    ret, data = response
    if ret != ft.RET_OK:
        raise FutuUnavailableError(str(data))
    return data


def list_accounts(trd_env: Optional[str] = None) -> List[Dict[str, Any]]:
    with trade_context() as (ft, ctx):
        data = _expect_ok(ft, ctx.get_acc_list())
        env = _parse_trd_env(ft, trd_env)
        items: List[Dict[str, Any]] = []
        for _, row in data.iterrows():
            row_env = row.get("trd_env")
            if row_env is not None and row_env != env:
                continue
            items.append(
                {
                    "acc_id": str(row["acc_id"]),
                    "trd_env": getattr(row.get("trd_env"), "name", str(row.get("trd_env"))),
                    "acc_type": getattr(row.get("acc_type"), "name", str(row.get("acc_type")) if row.get("acc_type") is not None else None),
                    "card_num": str(row.get("card_num")) if row.get("card_num") is not None else None,
                    "uni_card_num": str(row.get("uni_card_num")) if row.get("uni_card_num") is not None else None,
                    "security_firm": getattr(row.get("security_firm"), "name", str(row.get("security_firm")) if row.get("security_firm") is not None else None),
                }
            )
        return items


def get_history_deals(
    start: str,
    end: str,
    acc_id: Optional[str] = None,
    trd_env: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with trade_context() as (ft, ctx):
        data = _expect_ok(
            ft,
            ctx.history_deal_list_query(
                start=start,
                end=end,
                acc_id=int(acc_id) if acc_id else None,
                trd_env=_parse_trd_env(ft, trd_env),
            ),
        )
        items: List[Dict[str, Any]] = []
        for _, row in data.iterrows():
            items.append(
                {
                    "deal_id": str(row.get("deal_id")),
                    "order_id": str(row.get("order_id")) if row.get("order_id") is not None else None,
                    "code": str(row.get("code")),
                    "stock_name": str(row.get("stock_name")) if row.get("stock_name") is not None else None,
                    "trd_side": getattr(row.get("trd_side"), "name", str(row.get("trd_side"))),
                    "qty": float(row.get("qty", 0) or 0),
                    "price": float(row.get("price", 0) or 0),
                    "create_time": str(row.get("create_time")),
                    "deal_market": getattr(row.get("trd_market"), "name", str(row.get("trd_market")) if row.get("trd_market") is not None else None),
                    "fee": float(row.get("fee_amount", 0) or 0) if row.get("fee_amount") is not None else None,
                    "currency": getattr(row.get("currency"), "name", str(row.get("currency")) if row.get("currency") is not None else None),
                    "status": getattr(row.get("deal_status"), "name", str(row.get("deal_status")) if row.get("deal_status") is not None else None),
                }
            )
        return items


def get_history_orders(
    start: str,
    end: str,
    acc_id: Optional[str] = None,
    trd_env: Optional[str] = None,
) -> List[Dict[str, Any]]:
    with trade_context() as (ft, ctx):
        data = _expect_ok(
            ft,
            ctx.history_order_list_query(
                start=start,
                end=end,
                acc_id=int(acc_id) if acc_id else None,
                trd_env=_parse_trd_env(ft, trd_env),
            ),
        )
        items: List[Dict[str, Any]] = []
        for _, row in data.iterrows():
            items.append(
                {
                    "order_id": str(row.get("order_id")),
                    "code": str(row.get("code")),
                    "stock_name": str(row.get("stock_name")) if row.get("stock_name") is not None else None,
                    "trd_side": getattr(row.get("trd_side"), "name", str(row.get("trd_side")) if row.get("trd_side") is not None else None),
                    "qty": float(row.get("qty", 0) or 0) if row.get("qty") is not None else None,
                    "price": float(row.get("price", 0) or 0) if row.get("price") is not None else None,
                    "create_time": str(row.get("create_time")) if row.get("create_time") is not None else None,
                    "updated_time": str(row.get("updated_time")) if row.get("updated_time") is not None else None,
                    "order_status": getattr(row.get("order_status"), "name", str(row.get("order_status")) if row.get("order_status") is not None else None),
                    "order_market": getattr(row.get("trd_market"), "name", str(row.get("trd_market")) if row.get("trd_market") is not None else None),
                }
            )
        return items
