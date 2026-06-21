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