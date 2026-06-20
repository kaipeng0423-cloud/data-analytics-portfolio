"""GitHub Actions 云端每日抓取 FRED，并生成静态宏观看板 data.js。"""

from __future__ import annotations

import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site" / "macro"
SERIES = {
    "DGS2": ("美国2年期国债收益率", "daily", "%"),
    "DGS10": ("美国10年期国债收益率", "daily", "%"),
    "T10Y2Y": ("10年-2年期限利差", "daily", "%"),
    "VIXCLS": ("VIX波动率指数", "daily", "index"),
    "BAMLH0A0HYM2": ("美国高收益债利差", "daily", "%"),
    "SP500": ("标普500指数", "daily", "index"),
    "DFF": ("联邦基金有效利率", "daily", "%"),
    "UNRATE": ("美国失业率", "monthly", "%"),
    "CPIAUCSL": ("美国CPI指数", "monthly", "index"),
}


def fetch(series_id: str) -> pd.DataFrame:
    response = requests.get(
        "https://fred.stlouisfed.org/graph/fredgraph.csv",
        params={"id": series_id, "cosd": "2000-01-01"},
        headers={"User-Agent": "PengKai-Portfolio-GitHub-Actions/1.0"},
        timeout=90,
    )
    response.raise_for_status()
    frame = pd.read_csv(io.BytesIO(response.content))
    frame.columns = ["date", series_id]
    frame["date"] = pd.to_datetime(frame["date"])
    frame[series_id] = pd.to_numeric(frame[series_id], errors="coerce")
    return frame.dropna(subset=[series_id]).set_index("date")


def percentile_rank(series: pd.Series, window: int = 1260) -> pd.Series:
    def rank_last(values: np.ndarray) -> float:
        clean = values[np.isfinite(values)]
        return np.nan if len(clean) < 60 else float(np.mean(clean <= clean[-1]))
    return series.rolling(window, min_periods=60).apply(rank_last, raw=True)


def clean_records(frame: pd.DataFrame) -> list[dict]:
    return json.loads(frame.to_json(orient="records", force_ascii=False))


def main() -> None:
    frames = [fetch(series_id) for series_id in SERIES]
    wide = pd.concat(frames, axis=1).sort_index()
    daily = wide[["DGS2","DGS10","T10Y2Y","VIXCLS","BAMLH0A0HYM2","SP500","DFF"]].ffill(limit=5)
    daily["sp500_return_20d"] = daily["SP500"].pct_change(20)
    daily["sp500_volatility_20d"] = daily["SP500"].pct_change().rolling(20).std() * math.sqrt(252)
    daily["risk_score"] = (
        .28*percentile_rank(daily["VIXCLS"]) +
        .25*percentile_rank(daily["BAMLH0A0HYM2"]) +
        .18*percentile_rank(daily["sp500_volatility_20d"]) +
        .16*percentile_rank(-daily["sp500_return_20d"]) +
        .13*percentile_rank((-daily["T10Y2Y"]).clip(lower=0))
    )*100
    daily["risk_regime"] = pd.cut(daily["risk_score"],[-np.inf,35,55,75,np.inf],labels=["低风险","中性","偏高","高风险"]).astype("string")
    daily = daily.dropna(subset=["risk_score"]).reset_index().rename(columns={
        "date":"observation_date","DGS2":"dgs2","DGS10":"dgs10","T10Y2Y":"yield_spread",
        "VIXCLS":"vix","BAMLH0A0HYM2":"high_yield_spread","SP500":"sp500","DFF":"fed_funds_rate"
    })
    daily["observation_date"] = daily["observation_date"].dt.strftime("%Y-%m-%d")
    monthly = wide[["UNRATE","CPIAUCSL"]].dropna(how="all").resample("MS").last()
    monthly["cpi_yoy"] = monthly["CPIAUCSL"].pct_change(12,fill_method=None)*100
    monthly = monthly.reset_index().rename(columns={"date":"observation_date","UNRATE":"unemployment_rate","CPIAUCSL":"cpi_index"})
    monthly["observation_date"] = monthly["observation_date"].dt.strftime("%Y-%m-%d")
    latest, previous = daily.iloc[-1], daily.iloc[-21]
    freshness = []
    for sid,(name,freq,unit) in SERIES.items():
        part = wide[sid].dropna()
        freshness.append({"series_id":sid,"series_name":name,"frequency":freq,"unit":unit,"latest_observation":part.index.max().strftime("%Y-%m-%d"),"observations":len(part)})
    payload = {
        "latest":{"date":latest.observation_date,"riskScore":round(latest.risk_score,1),"riskRegime":latest.risk_regime,
                  "vix":round(latest.vix,2),"yieldSpread":round(latest.yield_spread,2),
                  "highYieldSpread":round(latest.high_yield_spread,2),"sp500":round(latest.sp500,2),
                  "sp500Return20d":round(latest.sp500_return_20d,4),"riskChange20d":round(latest.risk_score-previous.risk_score,1)},
        "daily":clean_records(daily.tail(2600)),"monthly":clean_records(monthly.tail(240)),"freshness":freshness,
        "refresh":{"finishedAt":datetime.now(timezone.utc).replace(microsecond=0).isoformat(),"status":"success","rowsUpserted":sum(x["observations"] for x in freshness),"seriesSucceeded":9,"seriesFailed":0},
        "method":{"riskScore":"VIX 28% + 高收益债利差 25% + 20日波动率 18% + 20日负收益 16% + 收益率曲线倒挂 13%；各项使用滚动历史百分位归一化。","source":"Federal Reserve Economic Data (FRED)"}
    }
    SITE.mkdir(parents=True,exist_ok=True)
    (SITE/"data.js").write_text("window.MACRO_DATA = "+json.dumps(payload,ensure_ascii=False,separators=(",",":"))+";",encoding="utf-8")


if __name__ == "__main__":
    main()
