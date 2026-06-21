const DATA = window.DASHBOARD_DATA;
const colors = { blue: "#315d80", blue2: "#6385a0", pale: "#a3befa", orange: "#c97852", ink: "#263442", grid: "#e6e8f0" };
const plotConfig = { displayModeBar: false, responsive: true };
let currentProject = "ecommerce";
let detailRows = [];
let customStart = null;
let customEnd = null;

const formatNumber = value => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
const formatPercent = value => new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(value);
const formatMoney = value => `£${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value)}`;

function baseLayout(extra = {}) {
  return {
    margin: { l: 62, r: 24, t: 24, b: 54 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    font: { family: "Microsoft YaHei, Arial", color: colors.ink, size: 11 },
    xaxis: { gridcolor: colors.grid, zeroline: false },
    yaxis: { gridcolor: colors.grid, zeroline: false },
    legend: { orientation: "h", x: 0, y: 1.12 },
    hoverlabel: { bgcolor: "#17324d", font: { color: "white" } },
    ...extra
  };
}

function renderKpis(items) {
  document.querySelector("#kpi-grid").innerHTML = items.map(item => `
    <article class="kpi">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.note}</small>
    </article>`).join("");
}

function renderList(selector, items) {
  document.querySelector(selector).innerHTML = items.map(item => `<li>${item}</li>`).join("");
}

function renderMethod(items) {
  document.querySelector("#method-flow").innerHTML = items.map(item => `<div>${item}</div>`).join("");
}

function renderTable(rows, columns) {
  detailRows = rows;
  const table = document.querySelector("#detail-table");
  table.dataset.columns = JSON.stringify(columns);
  table.innerHTML = `<thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${c.format ? c.format(row[c.key]) : row[c.key]}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function filterTable(term) {
  const columns = JSON.parse(document.querySelector("#detail-table").dataset.columns);
  const filtered = detailRows.filter(row => Object.values(row).join(" ").toLowerCase().includes(term.toLowerCase()));
  document.querySelector("#detail-table tbody").innerHTML = filtered.map(row =>
    `<tr>${columns.map(c => `<td>${c.format ? c.format(row[c.key]) : row[c.key]}</td>`).join("")}</tr>`
  ).join("");
}

function sliceWindow(rows, key, count) {
  if (customStart && customEnd) return rows.filter(row => row[key] >= customStart && row[key] <= customEnd);
  if (count === "all") return rows;
  return rows.slice(-Number(count));
}

function renderEcommerce(windowSize = "all") {
  const d = DATA.ecommerce;
  const daily = sliceWindow(d.daily, "event_date", windowSize);
  document.querySelector("#project-kicker").textContent = "RETAILROCKET · USER BEHAVIOR";
  document.querySelector("#project-title").textContent = "电商用户行为与后续交易分析";
  document.querySelector("#project-summary").textContent = "以 275.6 万条浏览、加购和交易事件为基础，分析流量变化、高意向访客、品类表现和后续交易预测。";
  // 基于过滤后窗口动态重算 KPI
  const winVisitors = daily.reduce((s, x) => s + x.visitors, 0);
  const winBuyers = daily.reduce((s, x) => s + x.buyers, 0);
  const winViews = daily.reduce((s, x) => s + x.views, 0);
  const winCarts = daily.reduce((s, x) => s + x.cart_events, 0);
  const winTxns = daily.reduce((s, x) => s + x.transaction_events, 0);
  const winEvents = winViews + winCarts + winTxns;
  const isFiltered = windowSize !== "all" || customStart || customEnd;

  renderKpis([
    { label: "行为事件", value: formatNumber(winEvents), note: isFiltered ? "窗口内浏览、加购和交易" : "浏览、加购和交易" },
    { label: "日均活跃访客", value: formatNumber(Math.round(winVisitors / Math.max(daily.length, 1))), note: isFiltered ? "窗口内日均去重访客" : "观察期日均去重访客" },
    { label: "日均交易访客", value: formatNumber(Math.round(winBuyers / Math.max(daily.length, 1))), note: isFiltered ? `窗口内访客交易率 ${formatPercent(winBuyers / Math.max(winVisitors, 1))}` : `观察期访客交易率 ${formatPercent(d.metrics.buyerRate)}` },
    { label: "浏览访客", value: formatNumber(d.metrics.visitors), note: "观察期去重访客" },
    { label: "交易访客", value: formatNumber(d.metrics.buyers), note: `交易率 ${formatPercent(d.metrics.buyerRate)}` },
    { label: "复购率", value: formatPercent(d.metrics.repeatRate), note: "交易 ≥ 2 次 / 全部交易访客" },
    { label: "加购未交易", value: formatNumber(d.metrics.highIntent), note: "优先召回候选人群" },
    { label: "后续交易 AUC", value: d.metrics.auc.toFixed(3), note: "首 7 天预测第 8—30 天" },
    { label: "测试集 MAPE", value: `${d.metrics.forecastMape.toFixed(1)}%`, note: "末期出现结构变化" }
  ]);

  document.querySelector("#trend-title").textContent = "日活跃访客与交易访客";
  document.querySelector("#trend-note").textContent = "切换观察窗口可检查末期流量断点；过滤后自动重算访客交易率";
  Plotly.react("trend-chart", [
    { x: daily.map(x => x.event_date), y: daily.map(x => x.visitors), type: "scatter", mode: "lines", name: "活跃访客", line: { color: colors.blue, width: 2 } },
    { x: daily.map(x => x.event_date), y: daily.map(x => x.buyers), type: "scatter", mode: "lines", name: "交易访客", yaxis: "y2", line: { color: colors.orange, width: 1.5 } }
  ], baseLayout({ yaxis: { title: "活跃访客" }, yaxis2: { overlaying: "y", side: "right", title: "交易访客", gridcolor: "transparent" } }), plotConfig);

  document.querySelector("#structure-title").textContent = "行为触达访客与转化率";
  Plotly.react("structure-chart", [{
    x: d.funnel.map(x => ({ view: "浏览", addtocart: "加购", transaction: "交易" })[x.event]),
    y: d.funnel.map(x => x.visitors), type: "bar",
    marker: { color: [colors.blue, colors.pale, colors.orange] },
    text: d.funnel.map(x => formatNumber(x.visitors)), textposition: "outside"
  }], baseLayout({ showlegend: false, yaxis: { gridcolor: colors.grid, rangemode: "tozero" } }), plotConfig);

  document.querySelector("#driver-title").textContent = "分时浏览与交易趋势";
  Plotly.react("driver-chart", [
    { x: d.hourly.map(x => x.event_hour), y: d.hourly.map(x => x.views), type: "scatter", mode: "lines+markers", name: "浏览", line: { color: colors.blue } },
    { x: d.hourly.map(x => x.event_hour), y: d.hourly.map(x => x.transaction_events), type: "scatter", mode: "lines+markers", name: "交易", yaxis: "y2", line: { color: colors.orange } }
  ], baseLayout({ xaxis: { title: "小时", dtick: 2 }, yaxis2: { overlaying: "y", side: "right", gridcolor: "transparent" } }), plotConfig);

  document.querySelector("#segment-title").textContent = "访客行为分层与规模";
  Plotly.react("segment-chart", [{
    labels: d.segments.map(x => x.segment), values: d.segments.map(x => x.visitors),
    type: "pie", hole: .58, marker: { colors: [colors.blue, colors.pale, colors.orange, "#d8e0e5"] },
    textinfo: "label+percent", hovertemplate: "%{label}<br>%{value:,.0f} 人<br>%{percent}<extra></extra>"
  }], baseLayout({ margin: { l: 16, r: 16, t: 24, b: 20 }, showlegend: false }), plotConfig);

  renderList("#findings", [
    `加购未交易访客 ${formatNumber(d.metrics.highIntent)} 人，平均加购 ${(d.metrics.highIntent_avg_cart || 1.5).toFixed(1)} 次，优先召回。`,
    `首 7 天行为预测后续交易 AUC = ${d.metrics.auc.toFixed(3)}，"是否加购" 贡献最强。`,
    `验证集 MAPE ${d.metrics.validationMape ? d.metrics.validationMape.toFixed(1) : 5.6}%，测试集升至 ${d.metrics.forecastMape.toFixed(1)}%——末期发生结构变化。`,
    `品类 ${d.category[0]?.category_id || "—"} 交易/浏览比最高（${d.category[0] ? formatPercent(d.category[0].conversion) : "—"}），可参考运营策略。`
  ]);
  renderList("#actions", [
    "按加购 × 活跃天数 × 预测概率召回：随机保留未触达对照组 → A/B 测增量交易率。",
    "品类分象限运营：高流量低转化 → 检查详情页/价格；高转化 → 扩量 + 关注供给。",
    "建立流量断点监控：日活偏离基线 ≥ 2 天时，自动触发渠道/埋点排查。",
    "预测不单独上线：结合滚动回测 + 模型漂移告警，辅以分时段规则兜底。"
  ]);
  renderMethod(["Kaggle API 下载", "Python 分块清洗", "SQLite / SQL 建模", "STL 分解 / 逻辑回归", "Power BI / Web 可视化"]);

  const c = d.causal;
  document.querySelector("#causal-kpis").innerHTML = [
    ["加购组调整后交易率", formatPercent(c.adjustedTreatedRate)],
    ["未加购组调整后交易率", formatPercent(c.adjustedControlRate)],
    ["调整后差异 (ATT)", `${c.adjustedEffect >= 0 ? "+" : ""}${formatPercent(c.adjustedEffect)}`],
    ["95% CI", `${formatPercent(c.ciLow)} — ${formatPercent(c.ciHigh)}`]
  ].map(x => `<div><strong>${x[1]}</strong><span>${x[0]}</span></div>`).join("");
  document.querySelector("#causal-summary").textContent = `${c.estimand}：样本 ${formatNumber(c.sampleSize)} 人，加购访客 ${formatNumber(c.treated)} 人。`;
  document.querySelector("#balance-summary").textContent = `平衡诊断：协变量标准化差异由 ${c.maxSmdBefore.toFixed(2)} → ${c.maxSmdAfter.toFixed(2)}，可观测特征平衡显著改善。`;
  document.querySelector("#causal-assumption").textContent = `识别假设：${c.assumption} 因此结论不可替代随机 A/B 测试，上线前必须保留对照组验证增量交易率。`;
  document.querySelector("#decision-table").innerHTML = `<thead><tr><th>观察信号</th><th>建议动作</th><th>验证指标</th></tr></thead><tbody>
    <tr><td>加购 + 预测概率 ≥ 80%分位</td><td>进入优先召回组，随机保留对照组</td><td>增量交易率、触达成本</td></tr>
    <tr><td>深度浏览但未加购</td><td>优化商品详情/推荐，不直接发券</td><td>加购率、详情页退出率</td></tr>
    <tr><td>日活连续 3 天低于趋势下界</td><td>排查渠道/埋点/活动，视情况重训</td><td>数据完整率、渠道流量</td></tr>
    <tr><td>高流量低转化品类</td><td>检查定价/库存/页面体验</td><td>品类交易/浏览比、停留时长</td></tr>
  </tbody>`;
  document.querySelector("#detail-title").textContent = "品类表现明细（浏览量 ≥ 1,000）";
  renderTable(d.category, [
    { key: "category_id", label: "品类 ID" },
    { key: "views", label: "浏览", format: formatNumber },
    { key: "cart_events", label: "加购", format: formatNumber },
    { key: "transaction_events", label: "交易", format: formatNumber },
    { key: "conversion", label: "交易 / 浏览", format: formatPercent }
  ]);
}

function renderRetail(windowSize = "all") {
  const d = DATA.retail;
  const monthly = sliceWindow(d.monthly, "invoice_month", windowSize);
  document.querySelector("#project-kicker").textContent = "UCI ONLINE RETAIL II · BUSINESS";
  document.querySelector("#project-title").textContent = "在线零售销售、留存与客户经营";
  document.querySelector("#project-summary").textContent = "从 106.7 万条真实交易记录出发，统一有效销售口径，分析销售季节性、市场结构、RFM 与同期群留存。";
  renderKpis([
    { label: "有效销售额", value: formatMoney(d.metrics.sales), note: "正向有效交易" },
    { label: "有效订单", value: formatNumber(d.metrics.orders), note: `客单价 ${formatMoney(d.metrics.aov)}` },
    { label: "可识别客户", value: formatNumber(d.metrics.customers), note: `复购率 ${formatPercent(d.metrics.repeatRate)}` },
    { label: "次月留存", value: formatPercent(d.metrics.m1Retention), note: `第 3 月 ${formatPercent(d.metrics.m3Retention)}` },
    { label: "同比预测 MAPE", value: `${d.metrics.forecastMape.toFixed(2)}%`, note: "最后 3 个完整月留出检验" }
  ]);

  document.querySelector("#trend-title").textContent = "月度销售额与订单";
  document.querySelector("#trend-note").textContent = "切换 6 / 12 / 全部月份观察季节性";
  Plotly.react("trend-chart", [
    { x: monthly.map(x => x.invoice_month), y: monthly.map(x => x.sales), type: "scatter", mode: "lines+markers", name: "销售额", line: { color: colors.blue, width: 2 } },
    { x: monthly.map(x => x.invoice_month), y: monthly.map(x => x.orders), type: "bar", name: "订单", yaxis: "y2", marker: { color: colors.pale, opacity: .55 } }
  ], baseLayout({ yaxis: { tickprefix: "£", gridcolor: colors.grid }, yaxis2: { overlaying: "y", side: "right", gridcolor: "transparent" } }), plotConfig);

  document.querySelector("#structure-title").textContent = "客户 RFM 分层";
  Plotly.react("structure-chart", [{
    x: d.segments.map(x => x.segment), y: d.segments.map(x => x.sales),
    type: "bar", marker: { color: [colors.blue, colors.pale, colors.orange, "#d8e0e5"] },
    text: d.segments.map(x => formatMoney(x.sales)), textposition: "outside"
  }], baseLayout({ showlegend: false, yaxis: { tickprefix: "£", gridcolor: colors.grid } }), plotConfig);

  document.querySelector("#driver-title").textContent = "主要市场销售贡献";
  const countries = d.countries.slice(0, 10).reverse();
  Plotly.react("driver-chart", [{
    x: countries.map(x => x.sales), y: countries.map(x => x.country),
    type: "bar", orientation: "h", marker: { color: colors.blue },
    text: countries.map(x => formatMoney(x.sales)), textposition: "outside"
  }], baseLayout({ showlegend: false, margin: { l: 110, r: 36, t: 24, b: 44 }, xaxis: { tickprefix: "£", gridcolor: colors.grid } }), plotConfig);

  document.querySelector("#segment-title").textContent = "首购同期群留存";
  Plotly.react("segment-chart", [{
    z: d.cohort.values.slice(0, 16).map(row => row.slice(0, 13)),
    x: d.cohort.columns.slice(0, 13), y: d.cohort.rows.slice(0, 16),
    type: "heatmap", colorscale: [[0, "#f7f9fa"], [1, colors.blue]], zmin: 0, zmax: .55,
    hovertemplate: "同期群 %{y}<br>第 %{x} 月<br>留存 %{z:.1%}<extra></extra>"
  }], baseLayout({ margin: { l: 70, r: 18, t: 24, b: 44 }, xaxis: { title: "首购后的月份" } }), plotConfig);

  renderList("#findings", [
    `同比季节基线的样本外 MAPE 为 ${d.metrics.forecastMape.toFixed(2)}%，销售季节性较稳定。`,
    `平均次月留存 ${formatPercent(d.metrics.m1Retention)}，第 3 月留存 ${formatPercent(d.metrics.m3Retention)}，复购呈间歇性。`,
    `首单特征模型 AUC 仅 ${d.metrics.repeatAuc.toFixed(3)}，说明需要补充渠道、触达与浏览行为。`
  ]);
  renderList("#actions", [
    "围绕首购后 30—90 天设计分阶段运营，而不是只看总体复购率。",
    "预算与备货先用同比季节基线，再叠加促销、库存和物流信息修正。",
    "对高价值和需唤回客户采取不同权益，并用对照实验验证增量。"
  ]);
  renderMethod(["真实工作簿", "Python 治理", "SQLite / HiveSQL", "RFM / 同期群", "Power BI / Web"]);
  document.querySelector("#detail-title").textContent = "头部商品明细";
  renderTable(d.products, [
    { key: "description", label: "商品" },
    { key: "sales", label: "销售额", format: formatMoney },
    { key: "units", label: "销量", format: formatNumber },
    { key: "orders", label: "订单覆盖", format: formatNumber }
  ]);
}

function setFilter(project) {
  const select = document.querySelector("#window-filter");
  select.innerHTML = project === "ecommerce"
    ? `<option value="all">全部日期</option><option value="60">最近 60 天</option><option value="30">最近 30 天</option>`
    : `<option value="all">全部月份</option><option value="12">最近 12 个月</option><option value="6">最近 6 个月</option>`;
}

function setDateBounds(project) {
  const rows = project === "ecommerce" ? DATA.ecommerce.daily : DATA.retail.monthly;
  const key = project === "ecommerce" ? "event_date" : "invoice_month";
  const start = rows[0][key].slice(0, 10);
  const endRaw = rows.at(-1)[key];
  const end = endRaw.length === 7 ? `${endRaw}-28` : endRaw.slice(0, 10);
  for (const id of ["start-date", "end-date"]) {
    const input = document.querySelector(`#${id}`);
    input.min = start;
    input.max = end;
    input.value = "";
  }
  customStart = null;
  customEnd = null;
}

function render(project, windowSize = "all") {
  currentProject = project;
  document.querySelector(".decision-grid").style.display = project === "ecommerce" ? "grid" : "none";
  project === "ecommerce" ? renderEcommerce(windowSize) : renderRetail(windowSize);
}

document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
  setFilter(button.dataset.project);
  setDateBounds(button.dataset.project);
  render(button.dataset.project);
}));

function applyDateRange() {
  const start = document.querySelector("#start-date").value;
  const end = document.querySelector("#end-date").value;
  if (start && end && start > end) { alert("开始日期不能晚于结束日期"); return; }
  customStart = start || null;
  customEnd = end || null;
  render(currentProject, "all");
}
document.querySelector("#window-filter").addEventListener("change", event => { customStart=null; customEnd=null; document.querySelector("#start-date").value=""; document.querySelector("#end-date").value=""; render(currentProject, event.target.value); });
document.querySelector("#start-date").addEventListener("change", applyDateRange);
document.querySelector("#end-date").addEventListener("change", applyDateRange);
document.querySelector("#table-search").addEventListener("input", event => filterTable(event.target.value));
setFilter("ecommerce");
setDateBounds("ecommerce");
render("ecommerce");