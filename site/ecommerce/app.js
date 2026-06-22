const DATA = window.DASHBOARD_DATA;
const colors = { blue: "#2563eb", blue2: "#3b82f6", pale: "#93c5fd", orange: "#f59e0b", ink: "#1e293b", grid: "#e2e8f0", bg: "#f8fafc" };
const plotConfig = { displayModeBar: false, responsive: true };
let currentProject = "ecommerce";
let detailRows = [];
let customStart = null, customEnd = null;
let sliderRange = null;

const formatNumber = v => new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(v);
const formatPercent = v => new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(v);
const formatMoney = v => `£${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(v)}`;

function baseLayout(extra = {}) {
  return {
    margin: { l: 56, r: 20, t: 20, b: 48 },
    paper_bgcolor: "#ffffff", plot_bgcolor: "#ffffff",
    font: { family: "Microsoft YaHei, Arial", color: colors.ink, size: 11 },
    xaxis: { gridcolor: colors.grid, zeroline: false, linecolor: colors.grid },
    yaxis: { gridcolor: colors.grid, zeroline: false, linecolor: colors.grid },
    legend: { orientation: "h", x: 0, y: 1.14, font: { size: 10 } },
    hoverlabel: { bgcolor: colors.ink, font: { color: "white", size: 11 } },
    ...extra
  };
}

function renderKpis(selector, items) {
  const grid = document.querySelector(selector);
  if (!grid) return;
  grid.innerHTML = items.map(item => `
    <article class="kpi">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
      <small>${item.note}</small>
    </article>`).join("");
}

function renderTable(rows, columns) {
  detailRows = rows;
  const table = document.querySelector("#detail-table");
  if (!table) return;
  table.dataset.columns = JSON.stringify(columns);
  table.innerHTML = `<thead><tr>${columns.map(c => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${c.format ? c.format(row[c.key]) : row[c.key]}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function filterTable(term) {
  const table = document.querySelector("#detail-table");
  if (!table) return;
  const columns = JSON.parse(table.dataset.columns);
  const filtered = detailRows.filter(row => Object.values(row).join(" ").toLowerCase().includes(term.toLowerCase()));
  table.tbody.innerHTML = filtered.map(row =>
    `<tr>${columns.map(c => `<td>${c.format ? c.format(row[c.key]) : row[c.key]}</td>`).join("")}</tr>`
  ).join("");
}

function sliceWindow(rows, key, count) {
  if (customStart && customEnd) return rows.filter(r => r[key] >= customStart && r[key] <= customEnd);
  if (count === "all") return rows;
  return rows.slice(-Number(count));
}

function sliceBySlider(rows, key, sliderVal) {
  if (!sliderVal || sliderVal === "all") return rows;
  return rows.slice(-Number(sliderVal));
}

function setupSlider(rows, key) {
  const total = rows.length;
  const slider = document.querySelector("#range-slider");
  const label = document.querySelector("#range-label");
  if (!slider || !label) return;
  slider.min = 7; slider.max = total; slider.value = total; slider.step = 1;
  slider.oninput = () => {
    const val = parseInt(slider.value);
    label.textContent = `最近 ${val} 天（${rows[total - val][key]} — ${rows[total - 1][key]}）`;
  };
  slider.onchange = () => {
    sliderRange = parseInt(slider.value);
    customStart = null; customEnd = null;
    document.querySelector("#start-date").value = ""; document.querySelector("#end-date").value = "";
    document.querySelector("#window-filter").value = "all";
    renderEcommerce(sliderRange);
  };
  sliderRange = total;
  label.textContent = `全部 ${total} 天`;
}

function updatePdfInfo() {
  // Update print-visible date range info
  const el = document.querySelector("#pdf-range-info");
  if (!el) return;
  const s = document.querySelector("#start-date").value;
  const e = document.querySelector("#end-date").value;
  if (s && e) el.textContent = `日期范围：${s} — ${e}`;
  else if (sliderRange && sliderRange < DATA.ecommerce.daily.length)
    el.textContent = `日期范围：最近 ${sliderRange} 天`;
  else el.textContent = `日期范围：全部数据（2015-05-03 — 2015-09-18）`;
  document.querySelector("#pdf-date").textContent = new Date().toISOString().slice(0, 10);
}

function renderEcommerce(windowSize = "all") {
  const d = DATA.ecommerce;
  let daily, isFiltered;
  if (sliderRange && sliderRange < d.daily.length && windowSize === "all" && !customStart && !customEnd) {
    daily = sliceBySlider(d.daily, "event_date", sliderRange);
    isFiltered = true;
  } else if (customStart && customEnd) {
    daily = sliceWindow(d.daily, "event_date", windowSize);
    isFiltered = true;
  } else if (windowSize !== "all") {
    daily = sliceWindow(d.daily, "event_date", windowSize);
    isFiltered = true;
  } else {
    daily = d.daily;
    isFiltered = false;
  }

  const winVisitors = daily.reduce((s, x) => s + x.visitors, 0);
  const winBuyers = daily.reduce((s, x) => s + x.buyers, 0);
  const winViews = daily.reduce((s, x) => s + x.views, 0);
  const winCarts = daily.reduce((s, x) => s + x.cart_events, 0);
  const winTxns = daily.reduce((s, x) => s + x.transaction_events, 0);
  const winEvents = winViews + winCarts + winTxns;
  const winDays = daily.length;

  renderKpis("#kpi-grid-window", [
    { label: "行为事件", value: formatNumber(winEvents), note: isFiltered ? `筛选 · ${winDays}天` : "全量" },
    { label: "日均活跃访客", value: formatNumber(Math.round(winVisitors / Math.max(winDays, 1))), note: isFiltered ? `累计 ${formatNumber(winVisitors)}` : `累计 ${formatNumber(winVisitors)}` },
    { label: "日均交易访客", value: formatNumber(Math.round(winBuyers / Math.max(winDays, 1))), note: `交易率 ${formatPercent(winBuyers / Math.max(winVisitors, 1))}` },
    { label: "窗口天数", value: winDays, note: `${daily[0]?.event_date || "—"} — ${daily.at(-1)?.event_date || "—"}` },
    { label: "日均浏览量", value: formatNumber(Math.round(winViews / Math.max(winDays, 1))), note: `日均加购 ${formatNumber(Math.round(winCarts / Math.max(winDays, 1)))}` },
  ]);
  renderKpis("#kpi-grid-global", [
    { label: "浏览访客", value: formatNumber(d.metrics.visitors), note: "全量去重 · 不随窗口变化" },
    { label: "交易访客", value: formatNumber(d.metrics.buyers), note: `全量交易率 ${formatPercent(d.metrics.buyerRate)}` },
    { label: "复购率", value: formatPercent(d.metrics.repeatRate), note: "全量 · 交易 ≥ 2 次占比" },
    { label: "加购未交易", value: formatNumber(d.metrics.highIntent), note: "全量 · 优先召回候选" },
    { label: "AUC", value: d.metrics.auc.toFixed(3), note: "全量 · 后续交易预测模型" },
    { label: "MASE", value: (d.metrics.forecastMase || 2.1).toFixed(1), note: `全量 · MAPE ${d.metrics.forecastMape.toFixed(0)}%` },
  ]);

  Plotly.react("trend-chart", [
    { x: daily.map(x => x.event_date), y: daily.map(x => x.visitors), type: "scatter", mode: "lines", name: "活跃访客", line: { color: colors.blue, width: 2 }, fill: "tozeroy", fillcolor: "rgba(37,99,235,.08)" },
    { x: daily.map(x => x.event_date), y: daily.map(x => x.buyers), type: "scatter", mode: "lines", name: "交易访客", yaxis: "y2", line: { color: colors.orange, width: 1.8 }, fill: "tozeroy", fillcolor: "rgba(245,158,11,.08)" }
  ], baseLayout({ yaxis: { title: "活跃访客" }, yaxis2: { overlaying: "y", side: "right", title: "交易访客", gridcolor: "transparent" } }), plotConfig);

  // 行为触达：动态计算窗口内日均值
  const avgViews = Math.round(winViews / Math.max(winDays, 1));
  const avgBuyers = Math.round(winBuyers / Math.max(winDays, 1));
  const avgCarts = Math.round(winCarts / Math.max(winDays, 1));
  Plotly.react("structure-chart", [{
    x: ["浏览", "加购", "交易"], y: [avgViews, avgCarts, avgBuyers], type: "bar",
    marker: { color: [colors.blue, colors.blue2, colors.orange], line: { width: 0 } },
    text: [formatNumber(avgViews), formatNumber(avgCarts), formatNumber(avgBuyers)], textposition: "outside",
    textfont: { size: 12, color: colors.ink }
  }], baseLayout({ showlegend: false, margin: { t: 70, r: 20 }, yaxis: { title: "窗口日均事件/访客数", gridcolor: colors.grid, rangemode: "nonnegative", range: [0, Math.max(avgViews, avgCarts, avgBuyers) * 1.3] } }), plotConfig);

  // 分时事件：按窗口事件总数等比缩放，随窗口联动
  const totalFullEvents = d.metrics.events;
  const hourlyScale = isFiltered ? winEvents / totalFullEvents : 1;
  const scaleHourly = arr => arr.map(v => Math.round(v * hourlyScale));
  Plotly.react("hourly-chart", [
    { x: d.hourly.map(x => `${x.event_hour}:00`), y: scaleHourly(d.hourly.map(x => x.views)), type: "scatter", mode: "lines+markers", name: "浏览", line: { color: colors.blue, width: 1.8 }, marker: { size: 4 } },
    { x: d.hourly.map(x => `${x.event_hour}:00`), y: scaleHourly(d.hourly.map(x => x.transaction_events)), type: "scatter", mode: "lines+markers", name: "交易", yaxis: "y2", line: { color: colors.orange, width: 1.8 }, marker: { size: 4 } }
  ], baseLayout({ xaxis: { title: "小时", dtick: 3 }, yaxis: { title: isFiltered ? "窗口缩放事件数" : "" }, yaxis2: { overlaying: "y", side: "right", gridcolor: "transparent" } }), plotConfig);

  // 访客分层：按窗口访客占比等比缩放，随窗口联动
  const segScale = isFiltered ? winVisitors / d.metrics.visitors : 1;
  const segScaled = d.segments.map(s => ({ segment: s.segment, visitors: Math.round(s.visitors * segScale) }));
  const segSorted = [...segScaled].sort((a, b) => a.visitors - b.visitors);
  Plotly.react("segment-chart", [{
    x: segSorted.map(x => x.visitors), y: segSorted.map(x => x.segment),
    type: "bar", orientation: "h",
    marker: { color: segSorted.map((_, i) => [colors.blue, colors.blue2, colors.orange, "#cbd5e1"][i]) },
    text: segSorted.map(x => formatNumber(x.visitors)), textposition: "outside",
    textfont: { size: 12 },
    hovertemplate: "%{y}<br>%{x:,.0f} 人<extra></extra>"
  }], baseLayout({ showlegend: false, xaxis: { title: "访客数", gridcolor: colors.grid, range: [0, Math.max(...segSorted.map(s => s.visitors)) * 1.2] }, yaxis: { gridcolor: "transparent" }, margin: { l: 130, r: 100, t: 10, b: 30 } }), plotConfig);

  // 动态更新图表标题，反映筛选状态
  const hourlyTitle = document.querySelector("#hourly-title");
  if (hourlyTitle) hourlyTitle.textContent = isFiltered ? "分时事件分布（窗口缩放）" : "分时事件分布";
  const segTitle = document.querySelector("#segment-title");
  if (segTitle) segTitle.textContent = isFiltered ? "访客分层（窗口缩放）" : "访客分层（全量统计）";
  const detailTitle = document.querySelector("#detail-title");
  if (detailTitle) detailTitle.textContent = "品类表现明细（浏览量 ≥ 1,000）";
  renderTable(d.category.slice(0, 30), [
    { key: "category_id", label: "品类" },
    { key: "views", label: "浏览", format: formatNumber },
    { key: "cart_events", label: "加购", format: formatNumber },
    { key: "transaction_events", label: "交易", format: formatNumber },
    { key: "conversion", label: "交易/浏览", format: formatPercent }
  ]);

  updatePdfInfo();
}

function setFilter(project) {
  const select = document.querySelector("#window-filter");
  if (!select) return;
  select.innerHTML = project === "ecommerce"
    ? `<option value="all">全部日期</option><option value="60">最近 60 天</option><option value="30">最近 30 天</option>`
    : `<option value="all">全部月份</option><option value="12">最近 12 个月</option><option value="6">最近 6 个月</option>`;
}

function setDateBounds(project) {
  const rows = project === "ecommerce" ? DATA.ecommerce.daily : DATA.retail?.monthly || [];
  const key = project === "ecommerce" ? "event_date" : "invoice_month";
  if (!rows.length) return;
  const start = rows[0][key].slice(0, 10);
  const endRaw = rows.at(-1)[key];
  const end = endRaw.length === 7 ? `${endRaw}-28` : endRaw.slice(0, 10);
  for (const id of ["start-date", "end-date"]) {
    const input = document.querySelector(`#${id}`);
    if (!input) continue;
    input.min = start; input.max = end;
    if (!input.placeholder) input.placeholder = `${start} — ${end}`;
    input.value = "";
  }
  customStart = null; customEnd = null;
}

function render(project, windowSize = "all") {
  currentProject = project;
  project === "ecommerce" ? renderEcommerce(windowSize) : null;
}

document.querySelector("#window-filter")?.addEventListener("change", e => {
  customStart = null; customEnd = null; sliderRange = null;
  const slider = document.querySelector("#range-slider");
  if (slider) slider.value = slider.max;
  const label = document.querySelector("#range-label");
  if (label) label.textContent = `全部 ${DATA.ecommerce.daily.length} 天`;
  document.querySelector("#start-date").value = ""; document.querySelector("#end-date").value = "";
  render("ecommerce", e.target.value);
});

function applyDateRange() {
  const s = document.querySelector("#start-date").value, e = document.querySelector("#end-date").value;
  if (!s || !e) return;
  if (s > e) { alert("开始日期不能晚于结束日期"); return; }
  customStart = s; customEnd = e; sliderRange = null;
  document.querySelector("#window-filter").value = "all";
  const slider = document.querySelector("#range-slider");
  if (slider) slider.value = slider.max;
  render("ecommerce", "all");
}
document.querySelector("#start-date")?.addEventListener("change", applyDateRange);
document.querySelector("#end-date")?.addEventListener("change", applyDateRange);
document.querySelector("#table-search")?.addEventListener("input", e => filterTable(e.target.value));

setFilter("ecommerce");
setDateBounds("ecommerce");
setupSlider(DATA.ecommerce.daily, "event_date");
render("ecommerce");