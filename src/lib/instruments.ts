import { Instrument } from "@/lib/types";

export const instruments: Instrument[] = [
  {
    symbol: "IXIC",
    name: "纳斯达克综合指数",
    market: "US",
    assetClass: "index",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Index",
    tags: ["benchmark", "nasdaq", "technology"]
  },
  {
    symbol: "GSPC",
    name: "标普500指数",
    market: "US",
    assetClass: "index",
    currency: "USD",
    exchange: "SPX",
    sector: "Index",
    tags: ["benchmark", "sp500", "broad-market"]
  },
  {
    symbol: "AAPL",
    name: "苹果",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["mega-cap", "consumer-electronics", "ai", "apple"]
  },
  {
    symbol: "MSFT",
    name: "微软",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["cloud", "ai", "software", "microsoft"]
  },
  {
    symbol: "INTC",
    name: "英特尔",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["intel", "intc", "semiconductor", "cpu", "foundry"]
  },
  {
    symbol: "NVDA",
    name: "英伟达",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["ai", "semiconductor", "gpu", "nvidia"]
  },
  {
    symbol: "MU",
    name: "美光科技",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["memory", "semiconductor", "storage", "micron"]
  },
  {
    symbol: "SNDK",
    name: "闪迪",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["storage", "flash", "memory", "sandisk"]
  },
  {
    symbol: "LITE",
    name: "莱迪思科技",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Technology",
    tags: ["optical", "networking", "datacenter", "lumentum", "lite"]
  },
  {
    symbol: "TSLL",
    name: "特斯拉两倍做多ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["tsll", "tesla", "特斯拉", "两倍做多", "杠杆etf", "2x"]
  },
  {
    symbol: "LKNCY",
    name: "瑞幸咖啡ADR",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "OTC",
    sector: "Consumer Discretionary",
    tags: ["luckin", "luckin coffee", "瑞幸", "瑞幸咖啡", "lkncy"]
  },
  {
    symbol: "NVDL",
    name: "英伟达两倍做多ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["nvdl", "nvidia", "英伟达", "两倍做多", "杠杆etf", "2x"]
  },
  {
    symbol: "TSDD",
    name: "特斯拉两倍做空ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["tsdd", "tesla", "特斯拉", "两倍做空", "反向", "杠杆etf"]
  },
  {
    symbol: "YANG",
    name: "三倍做空中国ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NYSE Arca",
    sector: "Leveraged Product",
    tags: ["yang", "中国做空", "三倍做空", "反向etf", "china bear"]
  },
  {
    symbol: "GOOX",
    name: "谷歌两倍做多ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["goox", "google", "alphabet", "谷歌", "两倍做多", "杠杆etf"]
  },
  {
    symbol: "MSTU",
    name: "微策略两倍做多ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["mstu", "microstrategy", "strategy", "微策略", "两倍做多", "杠杆etf"]
  },
  {
    symbol: "SRM",
    name: "SRM娱乐",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    tags: ["srm", "srm entertainment", "娱乐"]
  },
  {
    symbol: "NIO",
    name: "蔚来",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NYSE",
    sector: "Consumer Discretionary",
    tags: ["nio", "蔚来", "新能源车", "ev"]
  },
  {
    symbol: "SQQQ",
    name: "纳指三倍做空ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["sqqq", "纳指做空", "三倍做空", "反向etf", "nasdaq bear"]
  },
  {
    symbol: "BEKE",
    name: "贝壳",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NYSE",
    sector: "Real Estate",
    tags: ["beke", "贝壳", "链家", "房产平台"]
  },
  {
    symbol: "HOOD",
    name: "Robinhood",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Financials",
    tags: ["hood", "robinhood", "券商", "交易平台"]
  },
  {
    symbol: "SBET",
    name: "SharpLink Gaming",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Communication Services",
    tags: ["sbet", "sharplink", "gaming", "博彩"]
  },
  {
    symbol: "METU",
    name: "美图",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "OTC",
    sector: "Technology",
    tags: ["metu", "meitu", "美图", "影像", "ai"]
  },
  {
    symbol: "MULL",
    name: "Mullen Automotive",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    tags: ["mull", "mullen", "ev", "电动车"]
  },
  {
    symbol: "TVIX",
    name: "两倍做多波动率ETN",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NYSE Arca",
    sector: "Volatility",
    tags: ["tvix", "vix", "波动率", "两倍做多", "恐慌指数"]
  },
  {
    symbol: "META",
    name: "Meta",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Communication Services",
    tags: ["meta", "facebook", "社交", "广告", "ai"]
  },
  {
    symbol: "PDD",
    name: "拼多多",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    tags: ["pdd", "拼多多", "电商", "temu"]
  },
  {
    symbol: "SNXX",
    name: "英伟达两倍做空ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Leveraged Product",
    tags: ["snxx", "英伟达", "nvidia", "做空", "反向etf", "杠杆etf"]
  },
  {
    symbol: "NFLX",
    name: "奈飞",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Communication Services",
    tags: ["nflx", "netflix", "奈飞", "流媒体"]
  },
  {
    symbol: "GOOGL",
    name: "谷歌A",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Communication Services",
    tags: ["search", "ads", "ai", "google", "alphabet"]
  },
  {
    symbol: "AMZN",
    name: "亚马逊",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    tags: ["cloud", "ecommerce", "ai", "amazon"]
  },
  {
    symbol: "SPY",
    name: "标普500ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NYSE Arca",
    sector: "Index",
    tags: ["broad-market", "core"]
  },
  {
    symbol: "QQQ",
    name: "纳指100ETF",
    market: "US",
    assetClass: "etf",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Index",
    tags: ["nasdaq", "technology", "core"]
  },
  {
    symbol: "GLD",
    name: "黄金ETF",
    market: "US",
    assetClass: "commodity",
    currency: "USD",
    exchange: "NYSE Arca",
    sector: "Commodity",
    tags: ["gold", "hedge"]
  },
  {
    symbol: "TSLA",
    name: "特斯拉",
    market: "US",
    assetClass: "stock",
    currency: "USD",
    exchange: "NASDAQ",
    sector: "Consumer Discretionary",
    tags: ["ev", "growth", "automation", "tesla"]
  },
  {
    symbol: "TSLA240920C250",
    name: "特斯拉2024年9月250看涨期权",
    market: "US",
    assetClass: "option",
    currency: "USD",
    exchange: "OPRA",
    sector: "Derivatives",
    tags: ["option", "growth"]
  },
  {
    symbol: "0700.HK",
    name: "腾讯控股",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Technology",
    tags: ["internet", "gaming", "platform"]
  },
  {
    symbol: "03690.HK",
    name: "美团-W",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Consumer Discretionary",
    tags: ["3690", "03690", "03690.hk", "美团", "美团-w", "meituan"]
  },
  {
    symbol: "00100.HK",
    name: "MiniMax-WP",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Technology",
    tags: ["minimax", "ai", "model", "大模型", "mini max"]
  },
  {
    symbol: "02513.HK",
    name: "智谱",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Technology",
    tags: ["智谱", "zhipu", "glm", "ai", "knowledge atlas", "大模型"]
  },
  {
    symbol: "01797.HK",
    name: "新东方在线",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Consumer Discretionary",
    tags: ["1797", "01797", "01797.hk", "东方甄选", "新东方在线", "koolearn"]
  },
  {
    symbol: "07709.HK",
    name: "两倍做多海力士",
    market: "HK",
    assetClass: "etf",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Leveraged Product",
    tags: [
      "7709",
      "07709",
      "07709.hk",
      "两倍做多海力士",
      "海力士",
      "sk hynix",
      "hynix",
      "两倍做多",
      "杠杆",
      "leveraged"
    ]
  },
  {
    symbol: "01772.HK",
    name: "赣锋锂业H",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Materials",
    tags: [
      "1772",
      "1772.hk",
      "01772",
      "01772.hk",
      "赣锋锂业",
      "赣锋锂业h",
      "赣锋",
      "ganfeng lithium",
      "ganfeng",
      "锂业",
      "锂"
    ]
  },
  {
    symbol: "01208.HK",
    name: "五矿资源",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Materials",
    tags: ["1208", "01208", "01208.hk", "五矿资源", "minmetals", "铜矿", "资源"]
  },
  {
    symbol: "9988.HK",
    name: "阿里巴巴",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Consumer Discretionary",
    tags: ["ecommerce", "platform"]
  },
  {
    symbol: "2800.HK",
    name: "盈富基金",
    market: "HK",
    assetClass: "etf",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Index",
    tags: ["hang-seng", "core"]
  },
  {
    symbol: "823.HK",
    name: "领展房产基金",
    market: "HK",
    assetClass: "reit",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Real Estate",
    tags: ["reit", "income"]
  },
  {
    symbol: "00981.HK",
    name: "中芯国际",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Technology",
    tags: ["981", "00981", "00981.hk", "中芯国际", "smic", "晶圆", "半导体"]
  },
  {
    symbol: "01024.HK",
    name: "快手-W",
    market: "HK",
    assetClass: "stock",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Communication Services",
    tags: ["1024", "01024", "01024.hk", "快手", "kuaishou", "短视频"]
  },
  {
    symbol: "HSI",
    name: "恒生指数",
    market: "HK",
    assetClass: "index",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Index",
    tags: ["benchmark"]
  },
  {
    symbol: "HSTECH",
    name: "恒生科技指数",
    market: "HK",
    assetClass: "index",
    currency: "HKD",
    exchange: "HKEX",
    sector: "Index",
    tags: ["benchmark", "technology"]
  },
  {
    symbol: "000001.SH",
    name: "上证指数",
    market: "CN",
    assetClass: "index",
    currency: "CNY",
    exchange: "SSE",
    sector: "Index",
    tags: ["benchmark", "shanghai"]
  },
  {
    symbol: "399001.SZ",
    name: "深证成指",
    market: "CN",
    assetClass: "index",
    currency: "CNY",
    exchange: "SZSE",
    sector: "Index",
    tags: ["benchmark", "shenzhen"]
  },
  {
    symbol: "600519.SH",
    name: "贵州茅台",
    market: "CN",
    assetClass: "stock",
    currency: "CNY",
    exchange: "SSE",
    sector: "Consumer Staples",
    tags: ["baijiu", "blue-chip"]
  },
  {
    symbol: "000333.SZ",
    name: "美的集团",
    market: "CN",
    assetClass: "stock",
    currency: "CNY",
    exchange: "SZSE",
    sector: "Industrials",
    tags: ["appliance", "export"]
  },
  {
    symbol: "510300.SH",
    name: "沪深300ETF",
    market: "CN",
    assetClass: "etf",
    currency: "CNY",
    exchange: "SSE",
    sector: "Index",
    tags: ["csi300", "core"]
  },
  {
    symbol: "159915.SZ",
    name: "创业板ETF",
    market: "CN",
    assetClass: "fund",
    currency: "CNY",
    exchange: "SZSE",
    sector: "Growth",
    tags: ["chinext", "growth"]
  },
  {
    symbol: "AU9999.SGE",
    name: "上金所黄金现货",
    market: "CN",
    assetClass: "commodity",
    currency: "CNY",
    exchange: "SGE",
    sector: "Commodity",
    tags: ["gold", "hedge"]
  }
];
