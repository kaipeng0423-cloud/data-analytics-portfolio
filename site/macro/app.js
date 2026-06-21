const D = window.MACRO_DATA;
const C = { blue: "#315d80", blue2: "#6385a0", pale: "#a3befa", orange: "#c97852", ink: "#263442", grid: "#e6e8f0" };
let years = 5, customStart = null, customEnd = null;

const fmt = (v, d = 1) => v == null ? "—" : new Intl.NumberFormat("zh-CN", { maximumFractionDigits: d }).format(v);
const pct = v => v == null ? "—" : new Intl.NumberFormat("zh-CN", { style: "percent", maximumFractionDigits: 1 }).format(v);
const config = { displayModeBar: false, responsive: true };

const layout = x => ({
  margin: { l: 58, r: 28, t: 28, b: 48 },
  paper_bgcolor: "#fff", plot_bgcolor: "#fff",
  font: { family: "Microsoft YaHei,Arial", color: C.ink, size: 11 },
  xaxis: { gridcolor: C.grid }, yaxis: { gridcolor: C.grid },
  legend: { orientation: "h", x: 0, y: 1.13 },
  hoverlabel: { bgcolor: "#142f49", font: { color: "#fff" } },
  ...x
});

function windowFilter(rows, n) {
  if (customStart && customEnd) return rows.filter(r => r.observation_date >= customStart && r.observation_date <= customEnd);
  const maxDate = new Date(rows.at(-1).observation_date), minDate = new Date(maxDate);
  minDate.setFullYear(maxDate.getFullYear() - n);
  return rows.filter(r => new Date(r.observation_date) >= minDate);
}

function renderKpisWin() {
  const d = windowFilter(D.daily, years);
  const last = d.at(-1);
  const risk = last ? fmt(last.risk_score, 1) : "—";
  const regime = last ? last.risk_regime : "—";
  const vixVal = last ? fmt(last.vix, 1) : "—";
  const spread = last ? fmt(last.yield_spread, 2) : "—";
  const hySpread = last ? fmt(last.high_yield_spread, 2) : "—";
  const sp500 = last ? fmt(last.sp500, 0) : "—";
  document.querySelector("#kpis-window").innerHTML = [
    ["窗口末综合风险", risk, regime],
    ["窗口末 VIX", vixVal, "波动率指数"],
    ["窗口末期限利差", `${spread}%`, "10Y — 2Y"],
    ["窗口末高收益债利差", `${hySpread}%`, "信用风险压力"],
    ["窗口末标普500", sp500, "指数点位"],
    ["窗口天数", d.length, `${d[0]?.observation_date || "—"} — ${d.at(-1)?.observation_date || "—"}`],
  ].map(x => `<article class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join("");
}

function renderKpisGlobal() {
  const l = D.latest;
  document.querySelector("#kpis-global").innerHTML = [
    ["综合风险", fmt(l.riskScore, 1), l.riskRegime],
    ["VIX", fmt(l.vix, 1), `20日变化 ${l.riskChange20d >= 0 ? "+" : ""}${fmt(l.riskChange20d)}`],
    ["期限利差", `${fmt(l.yieldSpread, 2)}%`, l.yieldSpread < 0 ? "收益率曲线倒挂" : "收益率曲线为正"],
    ["高收益债利差", `${fmt(l.highYieldSpread, 2)}%`, "信用风险压力"],
    ["标普500", fmt(l.sp500, 0), `20日收益 ${pct(l.sp500Return20d)}`],
    ["数据日期", l.date, "按官方发布节奏更新"],
  ].map(x => `<article class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join("");
}

function charts() {
  const d = windowFilter(D.daily, years), m = windowFilter(D.monthly, Math.max(years, 3));
  Plotly.react("risk-chart", [{
    x: d.map(x => x.observation_date), y: d.map(x => x.risk_score),
    type: "scatter", mode: "lines", fill: "tozeroy",
    line: { color: C.blue, width: 1.5 }, fillcolor: "rgba(49,93,128,.16)", name: "风险指数"
  }], layout({ yaxis: { range: [0, 100], gridcolor: C.grid }, shapes: [{ type: "line", x0: d[0].observation_date, x1: d.at(-1).observation_date, y0: 75, y1: 75, line: { color: C.orange, dash: "dot" } }] }), config);
  Plotly.react("yield-chart", [
    { x: d.map(x => x.observation_date), y: d.map(x => x.dgs2), type: "scatter", mode: "lines", name: "2年期", line: { color: C.pale } },
    { x: d.map(x => x.observation_date), y: d.map(x => x.dgs10), type: "scatter", mode: "lines", name: "10年期", line: { color: C.blue } },
    { x: d.map(x => x.observation_date), y: d.map(x => x.yield_spread), type: "scatter", mode: "lines", name: "10Y-2Y", line: { color: C.orange } }
  ], layout({ yaxis: { ticksuffix: "%", gridcolor: C.grid }, shapes: [{ type: "line", x0: d[0].observation_date, x1: d.at(-1).observation_date, y0: 0, y1: 0, line: { color: C.ink, dash: "dot" } }] }), config);
  Plotly.react("stress-chart", [
    { x: d.map(x => x.observation_date), y: d.map(x => x.vix), type: "scatter", mode: "lines", name: "VIX", line: { color: C.orange } },
    { x: d.map(x => x.observation_date), y: d.map(x => x.high_yield_spread), type: "scatter", mode: "lines", name: "高收益债利差", yaxis: "y2", line: { color: C.blue } }
  ], layout({ yaxis2: { overlaying: "y", side: "right", ticksuffix: "%", gridcolor: "transparent" } }), config);
  Plotly.react("macro-chart", [
    { x: m.map(x => x.observation_date), y: m.map(x => x.cpi_yoy), type: "scatter", mode: "lines+markers", name: "CPI同比", line: { color: C.orange } },
    { x: m.map(x => x.observation_date), y: m.map(x => x.unemployment_rate), type: "scatter", mode: "lines+markers", name: "失业率", line: { color: C.blue } }
  ], layout({ yaxis: { ticksuffix: "%", gridcolor: C.grid } }), config);
  renderKpisWin();
}

function freshness() {
  const head = "<thead><tr><th>序列</th><th>名称</th><th>频率</th><th>最新观测</th><th>记录数</th></tr></thead>";
  const body = D.freshness.map(x => `<tr><td>${x.series_id}</td><td>${x.series_name}</td><td>${x.frequency === "daily" ? "日频" : "月频"}</td><td>${x.latest_observation}</td><td>${fmt(x.observations, 0)}</td></tr>`).join("");
  document.querySelector("#freshness-table").innerHTML = head + `<tbody>${body}</tbody>`;
}

function decisionCharts() {
  const d = windowFilter(D.daily, years);
  // 按窗口内数据的 risk_regime 分组，计算各组平均 forward_return_20d
  const groups = {};
  d.forEach(x => {
    const reg = x.risk_regime;
    if (!groups[reg]) groups[reg] = { sum: 0, n: 0 };
    if (x.forward_return_20d != null) { groups[reg].sum += x.forward_return_20d; groups[reg].n++; }
  });
  const order = ["低风险", "中性", "偏高", "高风险"];
  const r = order.filter(k => groups[k]).map(k => ({
    risk_regime: k,
    avg_forward_return: groups[k].n > 0 ? groups[k].sum / groups[k].n : 0,
    observations: groups[k].n
  }));
  Plotly.react("regime-chart", [{
    x: r.map(x => `${x.risk_regime}（${x.observations}天）`), y: r.map(x => x.avg_forward_return),
    type: "bar", marker: { color: r.map(x => x.avg_forward_return >= 0 ? C.blue : C.orange) },
    text: r.map(x => pct(x.avg_forward_return)), textposition: "outside"
  }], layout({ showlegend: false, yaxis: { tickformat: ".1%", gridcolor: C.grid }, margin: { l: 58, r: 24, t: 24, b: 46 } }), config);

  // 风险跃升事件：窗口内 risk_change_1d >= 15 的天数
  const events = d.filter((x, i) => i > 0 && x.risk_change_1d != null && x.risk_change_1d >= 15);
  const eCount = events.length;
  let avgFwd = 0, negProb = 0;
  if (eCount > 0) {
    const fwds = events.map(x => x.forward_return_20d).filter(x => x != null);
    avgFwd = fwds.reduce((a, b) => a + b, 0) / fwds.length;
    negProb = fwds.filter(x => x < 0).length / fwds.length;
  }
  const note = (customStart || customEnd) ? "筛选窗口" : `${years}年窗口`;
  document.querySelector("#event-study").innerHTML = `<div class="event-kpis"><div><strong>${eCount}</strong><span>风险跃升（${note}）</span></div><div><strong>${pct(avgFwd)}</strong><span>平均后续20日收益</span></div><div><strong>${pct(negProb)}</strong><span>后续为负概率</span></div></div>`;
  document.querySelector("#regime-title").textContent = "风险区间与后续市场表现（随窗口变化）";
}

function status() {
  const r = D.refresh, b = document.querySelector("#refresh-status");
  b.textContent = r.status === "success" ? "最近刷新成功" : r.status === "partial" ? "部分序列刷新成功" : "刷新状态异常";
  b.className = "badge " + r.status;
  document.querySelector("#latest-date").textContent = `最近一次任务：${r.finishedAt || "—"} · 写入/复核 ${fmt(r.rowsUpserted, 0)} 行`;
}

function applyCustomDates() {
  const s = document.querySelector("#start-date").value, e = document.querySelector("#end-date").value;
  if (!s || !e) return;
  if (s > e) { alert("开始日期不能晚于结束日期"); return; }
  customStart = s; customEnd = e;
  document.querySelector("#window-filter").value = "5";
  charts(); decisionCharts();
}

document.querySelector("#window-filter").addEventListener("change", e => {
  years = Number(e.target.value); customStart = null; customEnd = null;
  document.querySelector("#start-date").value = ""; document.querySelector("#end-date").value = "";
  charts(); decisionCharts();
});
document.querySelector("#start-date").addEventListener("change", applyCustomDates);
document.querySelector("#end-date").addEventListener("change", applyCustomDates);

document.querySelector("#start-date").min = D.daily[0].observation_date;
document.querySelector("#start-date").max = D.latest.date;
document.querySelector("#end-date").min = D.daily[0].observation_date;
document.querySelector("#end-date").max = D.latest.date;

renderKpisWin(); renderKpisGlobal(); charts(); decisionCharts(); freshness(); status();