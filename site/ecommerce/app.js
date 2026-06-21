const DATA = window.DASHBOARD_DATA;
const colors = { blue: "#315d80", blue2: "#6385a0", pale: "#a3befa", orange: "#c97852", ink: "#263442", grid: "#e6e8f0" };
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
    margin: { l: 62, r: 24, t: 24, b: 54 },
    paper_bgcolor: "#ffffff", plot_bgcolor: "#ffffff",
    font: { family: "Microsoft YaHei, Arial", color: colors.ink, size: 11 },
    xaxis: { gridcolor: colors.grid, zeroline: false },
    yaxis: { gridcolor: colors.grid, zeroline: false },
    legend: { orientation: "h", x: 0, y: 1.12 },
    hoverlabel: { bgcolor: "#17324d", font: { color: "white" } },
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

function renderEcommerce(windowSize = "all") {
  const d = DATA.ecommerce;
  let daily;
  if (sliderRange && sliderRange < d.daily.length && windowSize === "all" && !customStart && !customEnd) {
    daily = sliceBySlider(d.daily, "event_date", sliderRange);
  } else {
    daily = sliceWindow(d.daily, "event_date", windowSize);
  }
  const kicker = document.querySelector("#project-kicker"); if (kicker) kicker.textContent = "RETAILROCKET · ECOMMERCE DATA DASHBOARD";

  const winVisitors = daily.reduce((s, x) => s + x.visitors, 0);
  const winBuyers = daily.reduce((s, x) => s + x.buyers, 0);
  const winViews = daily.reduce((s, x) => s + x.views, 0);
  const winCarts = daily.reduce((s, x) => s + x.cart_events, 0);
  const winTxns = daily.reduce((s, x) => s + x.transaction_events, 0);
  const winEvents = winViews + winCarts + winTxns;
  const isFiltered = windowSize !== "all" || customStart || customEnd || (sliderRange && sliderRange < d.daily.length);

  renderKpis("#kpi-grid-window", [
    { label: "行为事件", value: formatNumber(winEvents), note: "浏览、加购和交易" },
    { label: "日均活跃访客", value: formatNumber(Math.round(winVisitors / Math.max(daily.length, 1))), note: "日均去重访客" },
    { label: "日均交易访客", value: formatNumber(Math.round(winBuyers / Math.max(daily.length, 1))), note: `交易率 ${formatPercent(winBuyers / Math.max(winVisitors, 1))}` },
    { label: "窗口天数", value: daily.length, note: `${daily[0]?.event_date || "—"} — ${daily.at(-1)?.event_date || "—"}` },
    { label: "窗口内交易率", value: formatPercent(winBuyers / Math.max(winVisitors, 1)), note: "交易访客 / 活跃访客" },
  ]);
  renderKpis("#kpi-grid-global", [
    { label: "浏览访客", value: formatNumber(d.metrics.visitors), note: "观察期去重访客" },
    { label: "交易访客", value: formatNumber(d.metrics.buyers), note: `访客交易率 ${formatPercent(d.metrics.buyerRate)}` },
    { label: "复购率", value: formatPercent(d.metrics.repeatRate), note: "交易 ≥ 2 次占比" },
    { label: "加购未交易", value: formatNumber(d.metrics.highIntent), note: "优先召回候选" },
    { label: "AUC", value: d.metrics.auc.toFixed(3), note: "后续交易预测模型" },
    { label: "MASE / MAPE", value: `${(d.metrics.forecastMase || 2.1).toFixed(1)} / ${d.metrics.forecastMape.toFixed(0)}%`, note: "预测误差指标" },
  ]);

  Plotly.react("trend-chart", [
    { x: daily.map(x => x.event_date), y: daily.map(x => x.visitors), type: "scatter", mode: "lines", name: "活跃访客", line: { color: colors.blue, width: 2 } },
    { x: daily.map(x => x.event_date), y: daily.map(x => x.buyers), type: "scatter", mode: "lines", name: "交易访客", yaxis: "y2", line: { color: colors.orange, width: 1.5 } }
  ], baseLayout({ yaxis: { title: "活跃访客" }, yaxis2: { overlaying: "y", side: "right", title: "交易访客", gridcolor: "transparent" } }), plotConfig);

  Plotly.react("structure-chart", [{
    x: d.funnel.map(x => ({ view: "浏览", addtocart: "加购", transaction: "交易" })[x.event]),
    y: d.funnel.map(x => x.visitors), type: "bar",
    marker: { color: [colors.blue, colors.pale, colors.orange] },
    text: d.funnel.map(x => formatNumber(x.visitors)), textposition: "outside"
  }], baseLayout({ showlegend: false, yaxis: { title: "访客数", gridcolor: colors.grid, rangemode: "tozero" } }), plotConfig);

  Plotly.react("hourly-chart", [
    { x: d.hourly.map(x => x.event_hour), y: d.hourly.map(x => x.views), type: "scatter", mode: "lines+markers", name: "浏览", line: { color: colors.blue } },
    { x: d.hourly.map(x => x.event_hour), y: d.hourly.map(x => x.transaction_events), type: "scatter", mode: "lines+markers", name: "交易", yaxis: "y2", line: { color: colors.orange } }
  ], baseLayout({ xaxis: { title: "小时", dtick: 3 }, yaxis2: { overlaying: "y", side: "right", gridcolor: "transparent" } }), plotConfig);

  Plotly.react("segment-chart", [{
    labels: d.segments.map(x => x.segment), values: d.segments.map(x => x.visitors),
    type: "pie", hole: .55, marker: { colors: [colors.blue, colors.pale, colors.orange, "#d8e0e5"] },
    textinfo: "label+percent", hovertemplate: "%{label}<br>%{value:,.0f}人<br>%{percent}<extra></extra>"
  }], baseLayout({ margin: { l: 16, r: 16, t: 16, b: 16 }, showlegend: false }), plotConfig);

  const detailTitle = document.querySelector("#detail-title");
  if (detailTitle) detailTitle.textContent = "品类表现明细（浏览量 ≥ 1,000）";
  renderTable(d.category.slice(0, 30), [
    { key: "category_id", label: "品类 ID" },
    { key: "views", label: "浏览", format: formatNumber },
    { key: "cart_events", label: "加购", format: formatNumber },
    { key: "transaction_events", label: "交易", format: formatNumber },
    { key: "conversion", label: "交易/浏览", format: formatPercent }
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
    input.min = start; input.max = end;
    if (input && !input.placeholder) input.placeholder = `${start} — ${end}`;
    input.value = "";
  }
  customStart = null; customEnd = null;
}

function render(project, windowSize = "all") {
  currentProject = project;
  project === "ecommerce" ? renderEcommerce(windowSize) : renderRetail(windowSize);
}

document.querySelector("#window-filter")?.addEventListener("change", e => {
  customStart = null; customEnd = null; sliderRange = null;
  document.querySelector("#range-slider").value = document.querySelector("#range-slider").max;
  document.querySelector("#range-label").textContent = `全部 ${DATA.ecommerce.daily.length} 天`;
  document.querySelector("#start-date").value = ""; document.querySelector("#end-date").value = "";
  render(currentProject, e.target.value);
});

function applyDateRange() {
  const s = document.querySelector("#start-date").value, e = document.querySelector("#end-date").value;
  if (!s || !e) return;
  if (s > e) { alert("开始日期不能晚于结束日期"); return; }
  customStart = s; customEnd = e; sliderRange = null;
  document.querySelector("#window-filter").value = "all";
  document.querySelector("#range-slider").value = document.querySelector("#range-slider").max;
  render(currentProject, "all");
}
document.querySelector("#start-date")?.addEventListener("change", applyDateRange);
document.querySelector("#end-date")?.addEventListener("change", applyDateRange);
document.querySelector("#table-search")?.addEventListener("input", e => filterTable(e.target.value));

setFilter("ecommerce");
setDateBounds("ecommerce");
setupSlider(DATA.ecommerce.daily, "event_date");
render("ecommerce");