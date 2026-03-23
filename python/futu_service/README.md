# Futu Bridge

这个服务用于把 `富途 OpenD + futu-api` 暴露成一组稳定的 HTTP 接口，供主应用调用。

## 依赖

1. 本机已安装并启动 `OpenD`
2. `OpenD` 已登录到你的富途账号
3. Python 环境安装依赖

```bash
cd python/futu_service
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 5070 --reload
```

## 环境变量

```bash
FUTU_OPEND_HOST=127.0.0.1
FUTU_OPEND_PORT=11111
FUTU_TRD_ENV=REAL
```

## 接口

- `GET /health`
- `GET /accounts?trd_env=REAL`
- `GET /history-deals?start=2026-03-01&end=2026-03-17&acc_id=...&trd_env=REAL`
- `GET /history-orders?start=2026-03-01&end=2026-03-17&acc_id=...&trd_env=REAL`

## 主应用接入

主应用配置：

```bash
FUTU_SERVICE_URL=http://127.0.0.1:5070
FUTU_TRD_ENV=REAL
FUTU_ACC_ID=
```

然后调用：

- `GET /api/trades/sync?provider=futu`
- `POST /api/trades/sync`

其中 `POST` 可传：

```json
{
  "provider": "futu",
  "start": "2026-03-01",
  "end": "2026-03-17",
  "accId": 123456789
}
```

如果不传 `accId`，主应用会优先用 `FUTU_ACC_ID`。
