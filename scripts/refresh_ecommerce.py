"""云端检查 Retailrocket 版本；变化时自动下载并重建紧凑 Web 看板数据。"""

from __future__ import annotations

import io
import json
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import requests


ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / "ecommerce_source_state.json"
SITE_DATA = ROOT / "site" / "ecommerce" / "data.js"
METADATA_URL = "https://www.kaggle.com/api/v1/datasets/view/retailrocket/ecommerce-dataset"
DOWNLOAD_URL = "https://www.kaggle.com/api/v1/datasets/download/retailrocket/ecommerce-dataset"
HEADERS = {"User-Agent": "PengKai-Portfolio-GitHub-Actions/1.0"}


def metadata() -> dict:
    response = requests.get(METADATA_URL, timeout=60, headers=HEADERS)
    response.raise_for_status()
    return response.json()


def build_category_map(paths: list[Path]) -> dict[int, int]:
    """分块保留每个商品时间最新的 categoryid。"""
    latest: dict[int, tuple[int, int]] = {}
    for path in paths:
        for chunk in pd.read_csv(path, chunksize=500_000):
            part = chunk.loc[chunk["property"].eq("categoryid"), ["timestamp", "itemid", "value"]].copy()
            part["category_id"] = pd.to_numeric(part["value"], errors="coerce")
            part = part.dropna(subset=["category_id"])
            part["category_id"] = part["category_id"].astype(int)
            part = part.sort_values("timestamp").groupby("itemid", as_index=False).tail(1)
            for row in part.itertuples(index=False):
                old = latest.get(int(row.itemid))
                candidate = (int(row.timestamp), int(row.category_id))
                if old is None or candidate[0] > old[0]:
                    latest[int(row.itemid)] = candidate
    return {item: value[1] for item, value in latest.items()}


def temporal_auc(events: pd.DataFrame) -> float:
    """仅用前 7 天行为预测第 8—30 天交易。"""
    from sklearn.linear_model import LogisticRegression
    from sklearn.metrics import roc_auc_score
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler

    first = events.groupby("visitorid")["timestamp"].min().rename("first_ts")
    max_ts = int(events["timestamp"].max())
    eligible = first[first <= max_ts - 30 * 86_400_000]
    part = events.loc[events["visitorid"].isin(eligible.index)].join(eligible, on="visitorid")
    delta = part["timestamp"] - part["first_ts"]
    feature_events = part.loc[delta < 7 * 86_400_000]
    labels = part.loc[
        delta.ge(7 * 86_400_000) & delta.lt(30 * 86_400_000)
    ].assign(is_purchase=lambda x: x["event"].eq("transaction")).groupby("visitorid")["is_purchase"].max()
    features = feature_events.groupby("visitorid").agg(
        views=("event", lambda x: int(x.eq("view").sum())),
        cart_events=("event", lambda x: int(x.eq("addtocart").sum())),
        unique_items=("itemid", "nunique"),
        active_days=("event_date", "nunique"),
        weekend_share=("is_weekend", "mean"),
    ).join(labels.rename("purchased")).fillna({"purchased": False})
    features = features.loc[features["purchased"] | (features.index % 25 == 0)].copy()
    features["log_views"] = np.log1p(features["views"])
    features["log_unique_items"] = np.log1p(features["unique_items"])
    features["log_active_days"] = np.log1p(features["active_days"])
    features["has_cart"] = features["cart_events"].gt(0).astype(int)
    columns = ["log_views", "log_unique_items", "log_active_days", "weekend_share", "has_cart"]
    x_train, x_test, y_train, y_test = train_test_split(
        features[columns],
        features["purchased"].astype(int),
        test_size=.25,
        random_state=42,
        stratify=features["purchased"].astype(int),
    )
    scaler = StandardScaler()
    model = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)
    model.fit(scaler.fit_transform(x_train), y_train)
    return float(roc_auc_score(y_test, model.predict_proba(scaler.transform(x_test))[:, 1]))


def rebuild(zip_path: Path) -> None:
    """从新版本源文件重建看板所需聚合。"""
    extract = zip_path.parent / "extract"
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(extract)
    events_path = next(extract.rglob("events.csv"))
    property_paths = sorted(extract.rglob("item_properties_part*.csv"))
    category_map = build_category_map(property_paths)
    events = pd.read_csv(events_path)
    events = events.drop_duplicates()
    events["event_time"] = pd.to_datetime(events["timestamp"], unit="ms")
    events["event_date"] = events["event_time"].dt.strftime("%Y-%m-%d")
    events["event_hour"] = events["event_time"].dt.hour
    events["is_weekend"] = events["event_time"].dt.dayofweek.ge(5).astype(int)
    events["category_id"] = events["itemid"].map(category_map)

    daily = events.groupby("event_date").agg(
        views=("event", lambda x: int(x.eq("view").sum())),
        cart_events=("event", lambda x: int(x.eq("addtocart").sum())),
        transaction_events=("event", lambda x: int(x.eq("transaction").sum())),
        visitors=("visitorid", "nunique"),
    )
    buyers = events.loc[events["event"].eq("transaction")].groupby("event_date")["visitorid"].nunique()
    daily["buyers"] = buyers
    daily = daily.fillna(0).reset_index()

    funnel = []
    for event_name in ["view", "addtocart", "transaction"]:
        part = events.loc[events["event"].eq(event_name)]
        funnel.append({
            "event": event_name,
            "event_count": int(len(part)),
            "visitors": int(part["visitorid"].nunique()),
            "items": int(part["itemid"].nunique()),
        })
    hourly = events.groupby("event_hour").agg(
        views=("event", lambda x: int(x.eq("view").sum())),
        cart_events=("event", lambda x: int(x.eq("addtocart").sum())),
        transaction_events=("event", lambda x: int(x.eq("transaction").sum())),
    ).reset_index()
    category = events.dropna(subset=["category_id"]).groupby("category_id").agg(
        views=("event", lambda x: int(x.eq("view").sum())),
        cart_events=("event", lambda x: int(x.eq("addtocart").sum())),
        transaction_events=("event", lambda x: int(x.eq("transaction").sum())),
    )
    category = category.loc[category["views"] >= 1000].assign(
        conversion=lambda x: x["transaction_events"] / x["views"]
    ).nlargest(30, "views").reset_index()
    category["category_id"] = category["category_id"].astype(int)

    visitor = events.groupby("visitorid").agg(
        views=("event", lambda x: int(x.eq("view").sum())),
        cart_events=("event", lambda x: int(x.eq("addtocart").sum())),
        transaction_events=("event", lambda x: int(x.eq("transaction").sum())),
    )
    visitor["segment"] = np.select(
        [
            visitor["transaction_events"].gt(0),
            visitor["cart_events"].gt(0),
            visitor["views"].ge(5),
        ],
        ["已交易", "加购未交易", "深度浏览未交易"],
        default="低活跃浏览",
    )
    segments = visitor.groupby("segment").size().rename("visitors").reset_index()
    buyer_events = visitor.loc[visitor["transaction_events"].gt(0), "transaction_events"]
    repeat_rate = float(buyer_events.ge(2).mean())
    auc = temporal_auc(events)
    series = daily.set_index(pd.to_datetime(daily["event_date"]))["visitors"]
    test = series.iloc[-14:]
    forecast = series.shift(7).loc[test.index]
    forecast_mape = float(np.mean(np.abs((test - forecast) / test)) * 100)
    fmap = {row["event"]: row for row in funnel}
    payload = {
        "ecommerce": {
            "daily": json.loads(daily.to_json(orient="records")),
            "funnel": funnel,
            "hourly": json.loads(hourly.to_json(orient="records")),
            "category": json.loads(category.to_json(orient="records")),
            "segments": json.loads(segments.to_json(orient="records", force_ascii=False)),
            "metrics": {
                "events": sum(x["event_count"] for x in funnel),
                "visitors": fmap["view"]["visitors"],
                "buyers": fmap["transaction"]["visitors"],
                "buyerRate": fmap["transaction"]["visitors"] / fmap["view"]["visitors"],
                "highIntent": int(visitor["segment"].eq("加购未交易").sum()),
                "repeatRate": repeat_rate,
                "auc": auc,
                "forecastMape": forecast_mape,
            },
        }
    }
    SITE_DATA.write_text(
        "window.DASHBOARD_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";",
        encoding="utf-8",
    )


def main() -> None:
    response = requests.get(METADATA_URL, timeout=60, headers=HEADERS)
    response.raise_for_status()
    info = response.json()
    previous = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
    changed = (
        previous.get("currentVersionNumber") != info["currentVersionNumber"]
        or previous.get("lastUpdated") != info["lastUpdated"]
    )
    if changed:
        with tempfile.TemporaryDirectory() as temp:
            zip_path = Path(temp) / "retailrocket.zip"
            with requests.get(DOWNLOAD_URL, stream=True, timeout=300, headers=HEADERS) as download:
                download.raise_for_status()
                with zip_path.open("wb") as handle:
                    for chunk in download.iter_content(1024 * 1024):
                        if chunk:
                            handle.write(chunk)
            rebuild(zip_path)
    current = {
        "currentVersionNumber": info["currentVersionNumber"],
        "lastUpdated": info["lastUpdated"],
        "totalBytes": info.get("totalBytes"),
        "licenseName": info.get("licenseName"),
        "checkedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "rebuilt": changed,
    }
    if changed or not STATE.exists():
        STATE.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(current, ensure_ascii=False))


if __name__ == "__main__":
    main()
