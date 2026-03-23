# Trading Platform

一个面向个人投资研究和交易复盘的全栈平台，当前重点覆盖：

- 美股
- 港股
- A 股

系统目标不是做高频交易终端，而是做一套盘后分析、跨市场观察、自选跟踪、交易复盘和账户总结工具。

## 核心功能

### 1. 自选股工作台

- 搜索并添加自选股
- 支持中文名、英文简称、代码、港股代码别名搜索
- 自选列表展示：
  - 中文名
  - 代码
  - 最新价格
  - 涨跌幅
  - 当前交易信号
- 点击单个标的可查看完整分析

### 2. 市场概览

- 美股、港股、A 股分栏展示
- 当前默认指数：
  - 美股：纳斯达克综合指数、标普 500
  - 港股：恒生指数、恒生科技指数
  - A 股：上证指数、深证成指
- 展示最新指数值、涨跌幅、多空判断、日期与数据源

### 3. 自选股交易信号分析

基于盘后数据，对自选股做统一分析，核心维度包括：

- 技术面
- 情绪面
- 缠论结构
- 基本面信号
- 反身性理论框架

单标的详情目前包含：

- 当前执行判断
- 结论与动作
- 关键价位
- 基本面信号
- 机会与催化
- 风险与失效条件
- 反身性框架
- 重要新闻

### 4. 交易复盘

- 手工录入交易
- CSV 导入交易
- 富途 OpenD 自动同步历史成交
- 按市场拆分复盘
- 月度 / 年度收益率
- 交易风格画像
- 优势 / 短板分析
- 交易覆盖区间与数据质量提示

### 5. 账户分析

- 交易日志驱动持仓推导
- 现金流水管理
- 账户净值路径
- 收益率与回撤摘要

### 6. OpenClaw 通知

- 支持通过 `openclaw message send` 发送盘后重要信号
- 支持“测试通知”和“推送重要信号”
- 自动按盘后批次去重，避免同一批结果重复提醒
- 重要信号当前默认包括：
  - `偏多 / 偏空` 且置信度达到阈值
  - `反身性加强 / 反身性转空`
  - `基本面偏强 / 基本面偏弱`

## 当前系统架构

主应用：

- `Next.js 15`
- `React 19`
- `TypeScript`
- `App Router + Route Handlers`

数据桥接：

- `AKShare` Python 服务
- `OpenBB` Python 服务
- `Futu OpenD` Python 服务

持久化：

- 本地 JSON
- 或 `Supabase Postgres`

## 目录结构

```text
src/
  app/
    api/                  # Next.js API
    dashboard/            # 受保护页面
  components/
    market-workbench.tsx  # 主工作台
  lib/
    market-data.ts        # 行情与历史数据路由
    symbol-analysis.ts    # 单标的分析
    trading-review.ts     # 交易复盘与收益分析
    trade-import.ts       # CSV / 券商导入
    instruments.ts        # 本地标的词典
python/
  akshare_service/        # A股 / 港股桥接
  openbb_service/         # 研究增强桥接
  futu_service/           # 富途 OpenD 桥接
supabase/
  schema.sql             # 数据库表结构
```

## 数据源策略

当前默认是“免费、低频、盘后分析”模式。

默认市场路由：

- `US`: `Twelve Data -> Alpha Vantage -> OpenBB -> Finnhub -> EODHD -> demo`
- `HK`: `AKShare -> OpenBB -> Alpha Vantage -> Finnhub -> EODHD -> demo`
- `CN`: `AKShare -> OpenBB -> Alpha Vantage -> EODHD -> demo`

实际定位：

- 美股：以免费日线数据为主
- 港股 / A 股：以 AKShare 桥接为主
- 搜索：本地词典 + 外部扩展搜索
- 页面优先展示真实盘后数据，不再默认回退假行情

## 本地启动

建议使用 `Node 22 LTS`。

安装依赖：

```bash
npm install
```

普通本机启动：

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:3000
```

## 局域网访问

如果你想让同一 Wi‑Fi 下的手机或其他电脑访问：

```bash
npm run dev:lan
```

它会监听：

```text
0.0.0.0:3000
```

然后在本机查看局域网 IP，例如 macOS：

```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

假设本机 IP 是：

```text
<your-lan-ip>
```

则其他设备访问：

```text
http://<your-lan-ip>:3000
```

注意：

- 其他设备只访问 Next.js 主应用即可
- `AKShare / OpenBB / Futu` 这些桥接服务保持本机 `127.0.0.1` 即可
- 如果 macOS 防火墙弹窗，请允许 Node.js 接收局域网连接

## 环境变量

先复制：

```bash
cp .env.example .env.local
```

核心变量：

```bash
MARKET_DATA_PROVIDER=twelveData
APP_STORAGE_PROVIDER=local
NEXT_PUBLIC_APP_PORT=3000

OPENBB_SERVICE_URL=http://127.0.0.1:5050
AKSHARE_SERVICE_URL=http://127.0.0.1:5060
FUTU_SERVICE_URL=http://127.0.0.1:5070
FUTU_OPEND_HOST=127.0.0.1
FUTU_OPEND_PORT=11111
FUTU_TRD_ENV=REAL

TWELVE_DATA_API_KEY=
ALPHA_VANTAGE_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini

OPENCLAW_NOTIFY_ENABLED=false
OPENCLAW_NOTIFY_ACCOUNT=
OPENCLAW_NOTIFY_CHANNEL=
OPENCLAW_NOTIFY_TARGET=
OPENCLAW_NOTIFY_MIN_CONFIDENCE=60
```

如果要启用 OpenClaw 通知：

1. 本机先完成 `openclaw` 配置和消息通道登录
2. 启动系统后，在页面里的“通知配置”中填写：
   - `通道`
   - `账号（可选）`
   - `目标 ID`
   - `最低置信度`
   - `是否启用自动通知`

环境变量仍然可以保留为默认值，但推荐通过页面配置并保存到应用设置中。若你想在首次启动前预设默认值，也可以在 `.env.local` 中配置：

```bash
OPENCLAW_NOTIFY_ENABLED=true
OPENCLAW_NOTIFY_ACCOUNT=
OPENCLAW_NOTIFY_CHANNEL=feishu
OPENCLAW_NOTIFY_TARGET=<your-feishu-user-id>
OPENCLAW_NOTIFY_MIN_CONFIDENCE=60
OPENCLAW_NOTIFY_APP_URL=http://127.0.0.1:3000
OPENCLAW_NOTIFY_CRON_SECRET=
```

当前支持两种触发方式：

- 页面里点击“测试通知”
- 页面里点击“推送重要信号”

后端接口：

- `POST /api/notifications/openclaw`
  - `{"test": true}`：发送测试通知
  - `{"scope": "MIXED"}`：发送当前重要信号
- `POST /api/cron/openclaw-notify`
  - `?scope=HKCN`：推送港股 / A 股盘后重要信号
  - `?scope=US`：推送美股盘后重要信号

## 本机自动推送

如果你希望本机自动推送，而不是手动点击：

1. 确保本地 Next.js 服务常驻在 `3000` 端口
2. 在页面“通知配置”里保存好通道和目标 ID，或在 `.env.local` 里提供默认值
3. 生成本机 `launchd` 任务：

```bash
python3 scripts/install_openclaw_notification_launchd.py
```

这会生成两个 LaunchAgent：

- `ai.trading-platform.notify.hkcn`
  - 工作日 `17:10`
  - 推送港股 / A 股盘后重要信号
- `ai.trading-platform.notify.us`
  - 工作日 `06:10`
  - 推送美股盘后重要信号

再通过 `launchctl` 加载它们即可。

## 富途同步

当前已经支持通过 `OpenD + futu-api` 拉取历史成交。

能力包括：

- 刷新富途账户
- 探测最早成交日期
- 同步近 180 天成交
- 同步自 2020 年以来成交
- 合并多个子账户复盘

对应桥接服务：

- [python/futu_service/README.md](python/futu_service/README.md)

## Supabase

如果要从本地 JSON 切到正式数据库：

1. 创建 Supabase 项目
2. 执行 [schema.sql](supabase/schema.sql)
3. 配置：

```bash
APP_STORAGE_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

当前已支持：

- 基础登录
- 用户隔离
- RLS
- watchlist / settings / portfolio / trades 持久化

## API 概览

常用接口：

- `GET /api/search`
- `GET /api/quote`
- `GET /api/overview`
- `GET /api/watchlist`
- `GET /api/watchlist/signals`
- `GET /api/symbol-analysis`
- `GET /api/review`
- `GET /api/performance`
- `GET /api/trades`
- `POST /api/trades/import`
- `POST /api/trades/sync`
- `GET /api/news`

## 云部署建议

最稳的组合：

- `Vercel`：部署 Next.js 主应用
- `Railway`：部署 `AKShare / OpenBB` Python 服务
- `Supabase`：做正式数据库
- `Futu OpenD`：优先保留在本机或常驻机器

如果只做本地或局域网使用，可以先不部署云端。

## 当前已知边界

- 系统更适合盘后分析，不是高频实时交易终端
- 某些免费数据源在不同市场的覆盖和稳定性不同
- 富途同步依赖 OpenD 和本地账号状态
- 不同券商收益率口径不完全一致，复盘口径与券商展示可能仍有差异

## 推荐使用路径

1. 启动主应用
2. 搜索并添加自选股
3. 查看市场概览
4. 查看自选股信号与单标的分析
5. 导入或同步交易记录
6. 查看交易复盘与收益率

## 关键文件

- 主页面：[src/components/market-workbench.tsx](src/components/market-workbench.tsx)
- 行情层：[src/lib/market-data.ts](src/lib/market-data.ts)
- 单标的分析：[src/lib/symbol-analysis.ts](src/lib/symbol-analysis.ts)
- 交易复盘：[src/lib/trading-review.ts](src/lib/trading-review.ts)
- 交易导入：[src/lib/trade-import.ts](src/lib/trade-import.ts)
- 本地标的词典：[src/lib/instruments.ts](src/lib/instruments.ts)
