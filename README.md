# 彭凯 · 数据分析作品集

> **在线主页**：[https://kaipeng0423-cloud.github.io/data-analytics-portfolio/](https://kaipeng0423-cloud.github.io/data-analytics-portfolio/)

两个真实数据项目，涵盖数据自动抓取与清洗、SQL/HiveSQL 建表、统计分析与机器学习、Power BI 看板和响应式 Web 看板。网站由 GitHub Actions 每天自动刷新数据并部署。

---

## 项目一：宏观经济与金融风险监控

`macro-risk-monitor/`

- 每日抓取 FRED 官方利率（联邦基金利率、10年期国债、TIPS 盈亏平衡通胀率）和就业数据
- 自动计算风险综合指数（利率倒挂、实际利率、失业率变化三个维度）
- 交互式数据看板：快捷/自定义日期范围联动、风险区间动态计算、跃升事件检测
- 响应式设计：手机/电脑/打印自适应
- **看板**：[https://kaipeng0423-cloud.github.io/data-analytics-portfolio/macro/](https://kaipeng0423-cloud.github.io/data-analytics-portfolio/macro/)

## 项目二：电商用户行为与转化分析

`ecommerce-funnel-analysis/`

- 基于 Retailrocket 275.6 万条真实行为事件
- 数据清洗 → SQLite 建库 + 7 项核心 SQL → STL 时序分解 → 滚动起点回测 → 逻辑回归转化模型（AUC 0.795）→ 倾向得分因果推断
- Web 交互看板：下拉选择/滑块/自定义日期三控件联动，KPI/图表全部随窗口实时计算
- 工程化交付：Power BI 星型模型、HiveSQL（ODS/DWD 分层）、Flask Web 服务、Dockerfile
- **看板**：[https://kaipeng0423-cloud.github.io/data-analytics-portfolio/ecommerce/](https://kaipeng0423-cloud.github.io/data-analytics-portfolio/ecommerce/)

---

## 环境要求

| 工具 | 版本/用途 |
|------|-----------|
| Python | 3.12+（推荐 Anaconda） |
| 依赖包 | pandas, numpy, scikit-learn, statsmodels, matplotlib, seaborn, flask, plotly, requests, openpyxl |
| SQLite | 内置模块，无需安装 |

```powershell
pip install -r requirements.txt
```

---

## 技术栈

| 类别 | 工具 |
|------|------|
| 语言 | Python 3.12 |
| 数据处理 | pandas · pathlib |
| 数据库 | SQLite3 |
| 统计分析 | statsmodels (STL) · numpy |
| 机器学习 | scikit-learn (LogisticRegression) |
| 可视化 | matplotlib · seaborn · plotly · openpyxl |
| Web | Flask · Plotly.js |
| 调度 | GitHub Actions · Windows 计划任务 |
| BI | Power BI (DAX · Power Query M) |
| 大数据 | HiveSQL (ODS/DWD 分层 · ORC) |
| 测试 | tests.py（电商 19 项 / 宏观 16 项） |
| 容器化 | Dockerfile |

---

## 复现步骤

```powershell
# 克隆仓库
git clone https://github.com/kaipeng0423-cloud/data-analytics-portfolio.git
cd data-analytics-portfolio

# 安装依赖
pip install -r requirements.txt

# === 宏观项目 ===
cd macro-risk-monitor
python pipeline.py          # 运行完整流程
python tests.py             # 运行测试（16 项）

# === 电商项目 ===
cd ecommerce-funnel-analysis
python source_refresh.py    # 主控：自动下载/清洗/分析/发布
python app.py               # 启动本地看板 → http://127.0.0.1:8060
python tests.py             # 运行测试（19 项）
```

---

## 文件夹结构

```
data-analytics-portfolio/
├── site/                        # GitHub Pages 部署文件
│   ├── index.html               # 作品集主页
│   ├── ecommerce/               # 电商看板（app.js, data.js, index.html, styles.css）
│   └── macro/                   # 宏观看板（app.js, data.js, index.html, styles.css）
├── ecommerce-funnel-analysis/   # 电商项目完整代码
├── macro-risk-monitor/          # 宏观项目完整代码
├── scripts/                     # 自动化脚本
├── requirements.txt             # Python 依赖
└── README.md                    # 本文件
```

---

## License

MIT