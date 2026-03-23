# AKShare Service

这是给主应用配套的 Python 微服务，负责通过 AKShare 提供 A 股优先、兼顾港股和美股的补充数据。

## 建议定位

- `CN` 主力数据源
- `HK` 补充与兜底
- `US` 搜索与补充兜底，不建议单独依赖

## 建议运行环境

- Python `3.11`
- 独立虚拟环境

## 安装

```bash
cd python/akshare_service
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 启动

```bash
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 5060 --reload
```

## 当前接口

- `GET /health`
- `GET /quote?symbol=600519.SH&market=CN`
- `GET /search?query=600519.SH`
- `GET /news?symbol=600519.SH`

## 说明

当前 `news` 先是稳定占位，后面可以再接东方财富、财联社或你自己的新闻聚合层。
