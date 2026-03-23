# OpenBB Service

这是给主应用配套的 Python 微服务，负责通过 OpenBB 拉取研究型金融数据，再以 HTTP API 形式提供给 Next.js 主应用。

## 建议运行环境

- Python `3.11`
- 独立虚拟环境

## 安装

```bash
cd python/openbb_service
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 启动

```bash
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 5050 --reload
```

## 环境变量

```bash
export OPENBB_LOG_DIR=/tmp/openbb-logs
export OPENBB_OUTPUT_DIR=/tmp/openbb-data
```

如果你的本机 OpenBB 默认日志目录没有权限，建议显式设置这两个目录。
