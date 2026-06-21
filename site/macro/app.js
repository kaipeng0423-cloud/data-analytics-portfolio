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
  const max = new Date(rows.at(-1).observation_date), min = new Date(max);
  min.setFullYear(max.getFullYear() - n);
  return rows.filter(r => new Date(r.observation_date) >= min);
}

function renderKpisWin() {
  const d = windowFilter(D.daily, years);
  const isFiltered = customStart || customEnd;
  const last = d.at(-1);
  const risk = last ? fmt(last.risk_score, 1) : "—";
  const regime = last ? last.risk_regime : "—";
  const vixVal = last ? fmt(last.vix, 1) : "—";
  const spread = last ? fmt(last.yield_spread, 2) : "—";
  const hySpread = last ? fmt(last.high_yield_spread, 2) : "—";
  const sp500 = last ? fmt(last.sp500, 0) : "—";
  document.querySelector("#kpis-window").innerHTML = [
    ["窗口末综合风险", risk, `${isFiltered ? "筛选窗口" : years + "年窗口"} · ${regime}`],
    ["窗口末 VIX", vixVal, "波动率指数"],
    ["窗口末期限利差", `${spread}%`, "10Y — 2Y"],
    ["窗口末高收益债利差", `${hySpread}%`, "信用风险压力"],
    ["窗口末标普500", sp500, "指数点位"],
    ["窗口天数", d.length, isFiltered ? `已筛选：${d[0]?.observation_date || "—"} — ${d.at(-1)?.observation_date || "—"}` : "全量数据"],
  ].map(x => `<article class="kpi"><span>${x[0]}</span><strong>${x[1]}</strong><small>${x[2]}</small></article>`).join("");
}

function renderKpisGlobal() {
  const l = D.latest;
  document.querySelector("#kpis-global").innerHTML = [
    ["综合风险（最新）", fmt(l.riskScore, 1), l.riskRegime],
    ["VIX（最新）", fmt(l.vix, 1), `20日风险变化 ${l.riskChange20d >= 0 ? "+" : ""}${fmt(l.riskChange20d)}`],
    ["期限利差（最新）", `${fmt(l.yieldSpread, 2)}%`, l.yieldSpread < 0 ? "收益率曲线倒挂" : "收益率曲线为正"],
    ["高收益债利差（最新）", `${fmt(l.highYieldSpread, 2)}%`, "信用风险压力"],
    ["标普500（最新）", fmt(l.sp500, 0), `20日收益 ${pct(l.sp500Return20d)}`],
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

function insights() {
  const l = D.latest, a = [];
  a.push(l.riskScore >= 75 ? "综合风险处于高风险区间，市场压力指标同时偏高。" : l.riskScore >= 55 ? "综合风险偏高，需关注信用利差和波动率是否继续上升。" : "综合风险未进入高位区间，但仍需观察单项指标变化。");
  a.push(l.yieldSpread < 0 ? "期限利差为负，收益率曲线仍处于倒挂状态。" : "期限利差为正，曲线倒挂信号已解除。");
  a.push(l.sp500Return20d < 0 ? "标普500近20日收益为负，风险偏好走弱。" : "标普500近20日收益为正，风险资产表现相对稳定。");
  document.querySelector("#insights").innerHTML = a.map(x => `<li>${x}</li>`).join("");
  document.querySelector("#method").textContent = D.method.riskScore;
}

function freshness() {
  const head = "<thead><tr><th>序列</th><th>名称</th><th>频率</th><th>最新观测</th><th>记录数</th></tr></thead>";
  const body = D.freshness.map(x => `<tr><td>${x.series_id}</td><td>${x.series_name}</td><td>${x.frequency === "daily" ? "日频" : "月频"}</td><td>${x.latest_observation}</td><td>${fmt(x.observations, 0)}</td></tr>`).join("");
  document.querySelector("#freshness-table").innerHTML = head + `<tbody>${body}</tbody>`;
}

function decision() {
  const a = D.decisionAnalysis, r = a.regimes;
  Plotly.react("regime-chart", [{
    x: r.map(x => x.risk_regime), y: r.map(x => x.avg_forward_return),
    type: "bar", marker: { color: r.map(x => x.avg_forward_return >= 0 ? C.blue : C.orange) },
    text: r.map(x => pct(x.avg_forward_return)), textposition: "outside"
  }], layout({ showlegend: false, yaxis: { tickformat: ".1%", gridcolor: C.grid }, margin: { l: 58, r: 24, t: 24, b: 46 } }), config);
  const e = a.rateHikeEventStudy;
  document.querySelector("#event-study").innerHTML = `<div class="event-kpis"><div><strong>${fmt(e.events, 0)}</strong><span>风险跃升事件</span></div><div><strong>${pct(e.avgForwardReturn20d)}</strong><span>平均后续20日收益</span></div><div><strong>${pct(e.negativeProbability)}</strong><span>后续收益为负概率</span></div></div><p class="assumption">${e.note}</p>`;
  document.querySelector("#decision-rules").innerHTML = a.rules.map(x => `<li>${x}</li>`).join("");
}

function status() {
  const r = D.refresh, b = document.querySelector("#refresh-status");
  b.textContent = r.status === "success" ? "最近刷新成功" : r.status === "partial" ? "部分序列刷新成功" : "刷新状态异常";
  b.className = "badge " + r.status;
  document.querySelector("#latest-date").textContent = `最近一次任务：${r.finishedAt || "—"} · 写入/复核 ${fmt(r.rowsUpserted, 0)} 行`;
}

async function refresh() {
  const b = document.querySelector("#refresh-button");
  if (!["127.0.0.1", "localhost"].includes(location.hostname)) { location.reload(); return; }
  b.disabled = true; b.textContent = "正在抓取官方数据…";
  try {
    const r = await fetch("/api/refresh", { method: "POST" }), j = await r.json();
    if (!r.ok) throw new Error(j.message || "刷新失败");
    location.reload();
  } catch (e) {
    alert(`刷新失败：${e.message}\n仍可查看上次成功缓存。`);
    b.disabled = false; b.textContent = "立即刷新数据";
  }
}

function applyCustomDates() {
  const s = document.querySelector("#start-date").value, e = document.querySelector("#end-date").value;
  if (!s || !e) return;
  if (s > e) { alert("开始日期不能晚于结束日期"); return; }
  customStart = s; customEnd = e;
  document.querySelector("#window-filter").value = "5";
  charts();
}

document.querySelector("#window-filter").addEventListener("change", e => {
  years = Number(e.target.value); customStart = null; customEnd = null;
  document.querySelector("#start-date").value = ""; document.querySelector("#end-date").value = "";
  charts();
});
document.querySelector("#start-date").addEventListener("change", applyCustomDates);
document.querySelector("#end-date").addEventListener("change", applyCustomDates);
document.querySelector("#refresh-button").addEventListener("click", refresh);

if (!["127.0.0.1", "localhost"].includes(location.hostname)) document.querySelector("#refresh-button").textContent = "重新载入最新数据";
document.querySelector("#start-date").min = D.daily[0].observation_date;
document.querySelector("#start-date").max = D.latest.date;
document.querySelector("#end-date").min = D.daily[0].observation_date;
document.querySelector("#end-date").max = D.latest.date;

renderKpisWin(); renderKpisGlobal(); charts(); insights(); decision(); freshness(); status();