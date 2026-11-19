"""抽象化テーブル（open_business_snapshot）への抜き出しと、そこからの集計。

本番の想定：会社ごとのセキュアなDB（生データ）から、毎晩のバッチで、今の戦略と日々の進捗の
段階・進み・件数だけを抜き出し、オープンなDBに置く（企業が増えたら四半期に1回でもよい）。
他社と比べる画面と参加企業の集計画面（経産省）は、オープンなDBだけを見る。

MVP：DBは1つ。open_business_snapshot をオープンなDBの代わりにする。
- 自社：日々の進捗の保存・申請の作成・版を作るたびに、自社の今の行だけをその場で作り直す
- 版を作るときは、そのときの全社の行を断面（map_version.open_body）として残す。
  過去の版を選んだ他社比較・集計は、この断面から集計する
- 手動：python -m app.open_data（または POST /api/batch/open-data）で全社ぶんを作り直す
        （本番の毎晩のバッチにあたる）
- 他社：ダミーの41社・117事業を、初めて起動したときに入れる

計算はフロントの logic.ts（progOf・stageTop など）と同じにしている。
"""

from __future__ import annotations

import random
import re
from collections import defaultdict
from types import SimpleNamespace
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from . import models as m

JST = ZoneInfo("Asia/Tokyo")
OBS = m.OpenBusinessSnapshot

PIDX = {"lg": 1, "pr": 2, "cu": 3, "fi": 4}
IPA_STAGE = {1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 3}
STAGE = ["未到達", "デジタイゼーション", "デジタライゼーション", "DX"]
PROG = ["指標はまだ動いていない", "学習と成長", "業務プロセス", "顧客", "財務"]


def _now() -> datetime:
    return datetime.now(JST).replace(tzinfo=None)


# ================================================================ 計算（logic.ts と同じ）


def _num(v) -> float | None:
    mt = re.search(r"-?\d+(\.\d+)?", str(v if v is not None else "").replace(",", ""))
    return float(mt.group(0)) if mt else None


def _moved(o: dict) -> bool:
    """指標が基準値から目標の方向へ動いたか"""
    c, b, t = _num(o.get("cur")), _num(o.get("base")), _num(o.get("target"))
    if c is None or b is None or t is None or t == b:
        return False
    return (c - b) * (t - b) > 0


def _running(i: dict) -> bool:
    """実行中の施策か（0＝未着手、1＝実行中）"""
    return i.get("exec") == 1


def _inits_of_bu(d: dict, b: dict) -> list[dict]:
    ids = {o["id"] for o in b["objs"]}
    return [i for i in d["inits"] if any(a in ids for a in i.get("attach", []))]


def _progress(d: dict, b: dict) -> int:
    """道筋の進み（0〜4）。実行中の施策が付いた目標から、指標が順に動いたところまで"""
    reached: set[str] = set()

    def started(o: dict) -> bool:
        return any(o["id"] in i.get("attach", []) and _running(i) for i in d["inits"])

    changed = True
    while changed:
        changed = False
        for o in b["objs"]:
            if o["id"] in reached or not _moved(o):
                continue
            if started(o) or any(lk["to"] == o["id"] and lk["from"] in reached for lk in b["links"]):
                reached.add(o["id"])
                changed = True
    persp = {o["id"]: o["persp"] for o in b["objs"]}
    return max((PIDX[persp[x]] for x in reached), default=0)


def _stage(d: dict, b: dict) -> int:
    """道筋にある実行中のデジタル施策のうち、一番上の段階"""
    return max(
        (IPA_STAGE.get(i.get("ipa") or 0, 0) for i in _inits_of_bu(d, b) if i.get("digital") and _running(i)),
        default=0,
    )


def _down(b: dict, oid: str) -> set[str]:
    seen: set[str] = set()
    q = [oid]
    while q:
        c = q.pop(0)
        for lk in b["links"]:
            if lk["from"] == c and lk["to"] not in seen:
                seen.add(lk["to"])
                q.append(lk["to"])
    return seen


def _fin_mix(d: dict, b: dict) -> int | None:
    """実態：施策ごとに、付いた目標からつながりを先へたどり、行き着く財務の目標の種類を見る
    （収益増大だけ＝収益増大に1、生産性向上だけ＝生産性向上に1、両方＝半分ずつ）。
    収益増大の割合（%）を返す。財務の目標まで行き着く施策がなければ None（logic.ts の finMix と同じ）"""
    objs = {o["id"]: o for o in b["objs"]}
    rev = prod = 0.0
    for i in _inits_of_bu(d, b):
        kinds: set[int] = set()
        for a in i.get("attach", []):
            if a not in objs:
                continue
            for x in {a} | _down(b, a):
                o = objs.get(x)
                if o and o["persp"] == "fi" and o.get("kind") is not None:
                    kinds.add(o["kind"])
        if kinds == {0}:
            rev += 1
        elif kinds == {1}:
            prod += 1
        elif kinds == {0, 1}:
            rev += 0.5
            prod += 0.5
    return round(rev / (rev + prod) * 100) if rev + prod else None


def abstract_business(d: dict, b: dict) -> dict:
    """1事業ぶんの抽象化した値（戦略の中身は持たない）"""
    persp = {o["id"]: o["persp"] for o in b["objs"]}
    non_fin = [o for o in b["objs"] if o["persp"] != "fi"]
    reach = sum(1 for o in non_fin if any(persp.get(x) == "fi" for x in _down(b, o["id"])))
    kpi = defaultdict(int)
    for o in b["objs"]:
        if o.get("kpi"):
            kpi[o["persp"]] += 1
    its = _inits_of_bu(d, b)
    return {
        "stage": _stage(d, b),
        "progress": _progress(d, b),
        "obj_total": len(non_fin),
        "obj_reach_fin": reach,
        "kpi_lg": kpi["lg"],
        "kpi_pr": kpi["pr"],
        "kpi_cu": kpi["cu"],
        "kpi_fi": kpi["fi"],
        "init_total": len(its),
        "init_condition": sum(1 for i in its if i.get("checks", {}).get("condition")),
        "init_review": sum(1 for i in its if i.get("checks", {}).get("review")),
        "init_verified": sum(1 for i in its if (i.get("verify") or 0) >= 2),
        "mix_plan": b.get("growth"),
        "mix_actual": _fin_mix(d, b),
    }


# ================================================================ 抜き出し（毎晩のバッチにあたる）

NOW_LABEL = "現在"
SNAP_FIELDS = [
    "company_id", "company_name", "company_industry", "bu_id", "bu_name", "bu_industry",
    "as_of_label", "stage", "progress", "obj_total", "obj_reach_fin",
    "kpi_lg", "kpi_pr", "kpi_cu", "kpi_fi", "init_total", "init_condition", "init_review", "init_verified",
    "mix_plan", "mix_actual",
]


def extract_company(s: Session, cid: int) -> int:
    """1社ぶんの今の行を作り直す：現在の申請の戦略と日々の進捗から、事業ごとに1行。
    申請がなければ行を消すだけ。作った行数を返す"""
    from .strategy import current_data  # strategy が open_data を使うので、ここで読む

    s.flush()
    s.execute(delete(OBS).where(OBS.company_id == cid))
    company = s.get(m.Company, cid)
    d = current_data(s, cid) if company is not None else None
    if company is None or d is None:
        s.flush()
        return 0
    ts = _now()
    for b in d.get("bus", []):
        s.add(
            OBS(
                company_id=cid,
                company_name=company.name,
                company_industry=company.industry,
                bu_id=b["id"],
                bu_name=b.get("name", ""),
                bu_industry=b.get("industry", "") or company.industry,
                as_of_label=NOW_LABEL,
                as_of=ts.date(),
                confirmed_at=ts,
                extracted_at=ts,
                **abstract_business(d, b),
            )
        )
    s.flush()
    return len(d.get("bus", []))


def snapshot_rows(s: Session) -> list[dict]:
    """今の抽象化テーブル（全社の行）を、版に残す断面の形（JSON）にする"""
    s.flush()
    out = []
    for r in s.scalars(select(OBS).order_by(OBS.company_id, OBS.id)):
        d = {k: getattr(r, k) for k in SNAP_FIELDS}
        d["confirmed_at"] = r.confirmed_at.isoformat()
        d["extracted_at"] = r.extracted_at.isoformat()
        out.append(d)
    return out


def rows_from_snapshot(snap: list[dict]) -> list[SimpleNamespace]:
    """版に残した断面を、テーブルの行と同じように読める形に戻す（あとから足した列がない古い断面は None）"""
    rows = []
    for d in snap:
        x = {"mix_plan": None, "mix_actual": None} | dict(d)
        x["confirmed_at"] = datetime.fromisoformat(x["confirmed_at"])
        x["extracted_at"] = datetime.fromisoformat(x["extracted_at"])
        rows.append(SimpleNamespace(**x))
    return rows


def run_batch(s: Session) -> dict:
    """全社ぶんを作り直す（本番の毎晩のバッチにあたる。MVPで生データを持つのは company テーブルの会社だけ）"""
    out = {}
    for cid in s.scalars(select(m.Company.id)):
        out[cid] = extract_company(s, cid)
    return {"companies": len(out), "rows": sum(out.values())}


# ================================================================ 他社のダミー（41社・117事業）

DUMMY_ID_FROM = 1001
# 段階(1〜3)ごとに、道筋の進み(0〜4)の事業数（合計117。自社1事業と合わせて118事業）
DUMMY_CELLS = {1: [4, 9, 4, 1, 0], 2: [2, 13, 29, 4, 1], 3: [4, 15, 22, 7, 2]}
DUMMY_INDUSTRIES = [
    ("はん用・生産用機械", 9, "精機", ["工作機械事業", "産業ロボット事業", "建設機械事業", "搬送装置事業", "保守サービス事業"]),
    ("電気機器", 8, "電機", ["空調事業", "電子部品事業", "照明事業", "電源装置事業", "家電事業"]),
    ("輸送用機械", 6, "工業", ["駆動部品事業", "車体部品事業", "電装部品事業", "二輪事業"]),
    ("化学", 6, "化学", ["機能材料事業", "基礎化学品事業", "樹脂事業", "医薬中間体事業"]),
    ("情報サービス", 6, "システムズ", ["受託開発事業", "クラウド事業", "業務パッケージ事業", "データ分析事業"]),
    ("小売", 3, "リテール", ["店舗事業", "EC事業", "商品開発事業"]),
    ("運輸", 2, "物流", ["国内輸送事業", "倉庫事業", "国際物流事業"]),
    ("食料品", 1, "食品", ["加工食品事業", "飲料事業"]),
]
DUMMY_PREFIX = [
    "あおば", "ひかり", "さくら", "みなと", "あさひ", "こだま", "つばさ", "なぎさ", "みずほ", "かえで",
    "いぶき", "はるか", "ゆうひ", "しらゆり", "たちばな", "ひばり", "みやび", "あかね", "そよかぜ", "ことぶき",
    "やまびこ", "かすみ", "ときわ", "わかば", "しおさい", "こはる", "あけぼの", "ほたる", "すばる", "みさき",
    "たまき", "ふたば", "あやめ", "ひいらぎ", "もみじ", "さつき", "はやて", "いずみ", "かなで", "ひなた",
    "せせらぎ",
]


def dummy_mix(bu_id: str, progress: int) -> tuple[int, int | None]:
    """他社のダミーの宣言と実態。事業IDから種を作るので、何度作っても同じ値になる。
    宣言は収益増大を多めに言うが、実態の施策は生産性向上（社内の効率化）に寄りがち、という想定
    （IPA『DX動向2026』：成果指標の対象は内向きの業務改革80.0%、外向き33.5%）。
    道筋が顧客・財務まで進んだ事業ほど、宣言と実態のずれは小さい"""
    rng = random.Random(f"mix-{bu_id}")
    plan = rng.choices([20, 30, 40, 50, 60, 70, 80, 90], weights=[2, 4, 8, 14, 16, 14, 8, 4])[0]
    if rng.random() < 0.06:
        return plan, None
    bias = rng.uniform(-8, 22) if progress >= 3 else rng.uniform(5, 55)
    actual = max(0, min(100, round((plan - bias) / 5) * 5))
    return plan, actual


def dummy_rows(ts: datetime) -> list[m.OpenBusinessSnapshot]:
    """他社のダミー。乱数の種を固定しているので、何度作っても同じ中身になる"""
    rng = random.Random(20261120)
    # 会社（業種・事業数）
    companies = []
    names = iter(DUMMY_PREFIX)
    for ind, n, suffix, pool in DUMMY_INDUSTRIES:
        for _ in range(n):
            companies.append({"industry": ind, "name": f"{next(names)}{suffix}株式会社", "pool": pool, "bus": 1})
    total = sum(sum(v) for v in DUMMY_CELLS.values())
    while sum(c["bus"] for c in companies) < total:
        c = rng.choice(companies)
        if c["bus"] < min(5, len(c["pool"])):
            c["bus"] += 1
    # 確定の日付：大半は2026年3月末の確定、一部は古い（直近1年以内に更新していない）
    for n, c in enumerate(companies):
        if n % 4 == 3:
            c["label"], c["as_of"] = "2025年9月末", date(2025, 9, 30)
            c["at"] = datetime(2025, 10, 1) + timedelta(days=rng.randint(0, 40), hours=rng.randint(9, 18))
        else:
            c["label"], c["as_of"] = "2026年3月末", date(2026, 3, 31)
            c["at"] = datetime(2026, 3, 24) + timedelta(days=rng.randint(0, 55), hours=rng.randint(9, 18))
    # 事業ごとの (段階, 進み) を配る
    cells = [(st, p) for st, row in DUMMY_CELLS.items() for p, k in enumerate(row) for _ in range(k)]
    rng.shuffle(cells)
    rows = []
    for ci, c in enumerate(companies):
        for bi, bu_name in enumerate(rng.sample(c["pool"], c["bus"])):
            st, p = cells.pop()
            obj_total = rng.randint(6, 12)
            kpi = {"lg": 1, "pr": 1, "cu": 1, "fi": 1}
            for _ in range(rng.randint(4, 10)):
                kpi[rng.choices(["lg", "pr", "cu", "fi"], weights=[36, 46, 10, 8])[0]] += 1
            init_total = rng.randint(3, 8)
            binom = lambda k, pr: sum(1 for _ in range(k) if rng.random() < pr)  # noqa: E731
            mix_plan, mix_actual = dummy_mix(f"d{ci + 1:02d}_{bi + 1}", p)
            rows.append(
                OBS(
                    company_id=DUMMY_ID_FROM + ci,
                    company_name=c["name"],
                    company_industry=c["industry"],
                    bu_id=f"d{ci + 1:02d}_{bi + 1}",
                    bu_name=bu_name,
                    bu_industry=c["industry"],
                    as_of_label=c["label"],
                    as_of=c["as_of"],
                    confirmed_at=c["at"],
                    stage=st,
                    progress=p,
                    obj_total=obj_total,
                    obj_reach_fin=binom(obj_total, 0.74),
                    kpi_lg=kpi["lg"],
                    kpi_pr=kpi["pr"],
                    kpi_cu=kpi["cu"],
                    kpi_fi=kpi["fi"],
                    init_total=init_total,
                    init_condition=binom(init_total, 0.26),
                    init_review=binom(init_total, 0.18),
                    init_verified=binom(init_total, 0.10 + 0.06 * p),
                    mix_plan=mix_plan,
                    mix_actual=mix_actual,
                    extracted_at=ts,
                )
            )
    return rows


def ensure_dummy(s: Session) -> bool:
    """他社のダミーがなければ入れる。入れたら True"""
    has = s.scalars(select(func.count()).select_from(OBS).where(OBS.company_id >= DUMMY_ID_FROM)).one()
    if has:
        return False
    s.add_all(dummy_rows(_now()))
    s.flush()
    return True


def backfill_mix(s: Session) -> None:
    """宣言と実態の列をあとから足したときの埋め戻し。
    ダミーは決まった値を入れ、生データのある会社は今の行を作り直す（すでに入っていれば何もしない）"""
    empty = s.scalars(select(OBS).where(OBS.mix_plan.is_(None))).all()
    if not empty:
        return
    own = set()
    for r in empty:
        if r.company_id >= DUMMY_ID_FROM:
            r.mix_plan, r.mix_actual = dummy_mix(r.bu_id, r.progress)
        else:
            own.add(r.company_id)
    for cid in own:
        extract_company(s, cid)
    s.flush()


# ================================================================ 集計（画面に返す形は従来と同じ）


def _pct(n: float, d: float) -> int:
    return round(n / d * 100) if d else 0


def _persp_share(rows) -> dict:
    tot = {p: sum(getattr(r, f"kpi_{p}") for r in rows) for p in ("lg", "pr", "cu", "fi")}
    all_ = sum(tot.values())
    return {p: _pct(v, all_) for p, v in tot.items()}


def _rows(s: Session, snap: list[dict] | None):
    """今の行（snap なし）か、版に残した断面の行"""
    if snap is None:
        return s.scalars(select(OBS)).all()
    return rows_from_snapshot(snap)


def peers(s: Session, own_cid: int, snap: list[dict] | None = None) -> dict:
    """A-16 他社と比べる：自社以外の各社の点（匿名）と平均。snap があれば、その断面から"""
    rows = [r for r in _rows(s, snap) if r.company_id != own_cid]
    return {
        "points": [{"ind": r.bu_industry, "st": r.stage, "p": r.progress} for r in rows if r.stage > 0],
        "avg": {
            "reach": _pct(sum(r.obj_reach_fin for r in rows), sum(r.obj_total for r in rows)),
            "condition": _pct(sum(r.init_condition for r in rows), sum(r.init_total for r in rows)),
            "review": _pct(sum(r.init_review for r in rows), sum(r.init_total for r in rows)),
            "verified": _pct(sum(r.init_verified for r in rows), sum(r.init_total for r in rows)),
            "persp": _persp_share(rows),
        },
    }


def _best_text(r: m.OpenBusinessSnapshot) -> str:
    tail = f"{PROG[r.progress]}まで" if r.progress else PROG[0]
    return f"{r.bu_name}：{STAGE[r.stage]}・{tail}"


def meti_summary(s: Session, own_cid: int, snap: list[dict] | None = None) -> dict:
    """A-17 参加企業の集計（経産省）：全社（自社を含む）の行から集計する。snap があれば、その断面から"""
    rows = list(_rows(s, snap))
    n = len(rows)
    by_co: dict[int, list] = defaultdict(list)
    for r in rows:
        by_co[r.company_id].append(r)
    year_ago = _now() - timedelta(days=365)
    recent = sum(1 for rs in by_co.values() if max(r.confirmed_at for r in rs) >= year_ago)
    staged = [r for r in rows if r.stage > 0]
    cells = {str(st): [_pct(sum(1 for r in staged if r.stage == st and r.progress == p), len(staged)) for p in range(5)] for st in (1, 2, 3)}

    by_ind: dict[str, list] = defaultdict(list)
    for r in rows:
        by_ind[r.bu_industry].append(r)
    # 業種別は、事業が5つ以上ある業種だけ（少ないと割合がぶれるため）
    inds = sorted(((k, v) for k, v in by_ind.items() if len(v) >= 5), key=lambda kv: -len(kv[1]))

    companies = []
    for cid, rs in by_co.items():
        best = max(rs, key=lambda r: (r.progress, r.stage))
        companies.append(
            {
                "name": rs[0].company_name,
                "industry": rs[0].company_industry,
                "buCount": len(rs),
                "best": _best_text(best),
                "updatedAt": max(r.confirmed_at for r in rs).date().isoformat(),
                "own": cid == own_cid,
            }
        )
    companies = [c for c in companies if c["own"]] + sorted(
        (c for c in companies if not c["own"]), key=lambda c: c["updatedAt"], reverse=True
    )

    # どこで詰まっているか：道筋をどこまで進んだか（k 以上の事業数）を、DXの段階で分けて
    flow = []
    for k in range(5):
        rs = [r for r in rows if r.progress >= k]
        flow.append(
            {
                "k": k,
                "n": len(rs),
                "byStage": [sum(1 for r in rs if r.stage == st) for st in range(4)],
            }
        )

    # 宣言と実態（財務の差を何で埋めるか）
    mixed = [r for r in rows if r.mix_plan is not None and r.mix_actual is not None]
    mix_pts = [
        {"plan": r.mix_plan, "actual": r.mix_actual, "p": r.progress, "st": r.stage, "own": r.company_id == own_cid}
        for r in mixed
    ]
    lean = [r for r in mixed if r.mix_actual - r.mix_plan <= -20]
    mix = {
        "points": mix_pts,
        "planAvg": round(sum(r.mix_plan for r in mixed) / len(mixed)) if mixed else 0,
        "actualAvg": round(sum(r.mix_actual for r in mixed) / len(mixed)) if mixed else 0,
        "lean": _pct(len(lean), len(mixed)),
        "leanStuck": _pct(sum(1 for r in lean if r.progress <= 2), len(lean)),
    }

    hints = _hints(rows, by_co, lean, mixed, year_ago)

    return {
        "flow": flow,
        "mix": mix,
        "hints": hints,
        "stats": [
            {"value": f"{len(by_co)}社", "label": f"参加企業（{n}事業）"},
            {"value": f"{recent}社", "label": "直近1年以内に更新"},
            {"value": f"{_pct(sum(1 for r in rows if r.progress >= 3), n)}%", "label": "顧客・財務まで道筋が進んだ事業"},
            {"value": f"{_pct(sum(1 for r in rows if r.progress == 2), n)}%", "label": "業務プロセスで止まっている事業"},
            {
                "value": f"{_pct(sum(r.init_verified for r in rows), sum(r.init_total for r in rows))}%",
                "label": "効果の検証が済んだ施策",
            },
        ],
        "cells": cells,
        "industries": [{"name": k, "reached": _pct(sum(1 for r in v if r.progress >= 3), len(v))} for k, v in inds],
        "perspRows": [{"name": "全参加企業", "persp": _persp_share(rows)}]
        + [{"name": k, "persp": _persp_share(v)} for k, v in inds[:3]],
        "companies": companies,
        "extractedAt": max((r.extracted_at for r in rows), default=None).isoformat(timespec="minutes") if rows else "",
    }


def _hints(rows, by_co, lean, mixed, year_ago) -> list[dict]:
    """経産省の次の一手の示唆。集計の数字から、当てはまる事業が多い順に出す。
    打ち手そのものは仮説（ルールで出しているだけ）"""
    n = len(rows) or 1
    out = []
    stuck = [r for r in rows if r.progress == 2]
    out.append(
        {
            "key": "stuck",
            "where": "業務プロセス → 顧客",
            "title": "業務は変わったが、顧客の変化につながっていない",
            "n": len(stuck),
            "share": _pct(len(stuck), n),
            "unit": "事業",
            "fact": f"道筋が業務プロセスで止まっている事業が{_pct(len(stuck), n)}%",
            "move": "顧客の指標（顧客に起きる変化）の置き方の手引きと、業務→顧客がつながった事例を、同じ業種で共有する",
        }
    )
    out.append(
        {
            "key": "lean",
            "where": "財務の差の埋め方",
            "title": "収益増大を掲げているのに、施策は効率化に寄っている",
            "n": len(lean),
            "share": _pct(len(lean), len(mixed) or 1),
            "unit": "事業",
            "fact": f"実態が宣言より20ポイント以上 生産性向上に寄っている事業が{_pct(len(lean), len(mixed) or 1)}%"
            + (f"（うち{_pct(sum(1 for r in lean if r.progress <= 2), len(lean))}%は業務プロセスまでで止まっている）" if lean else ""),
            "move": "DX認定・DX銘柄の審査で、収益増大の道筋（施策→顧客の指標→売上）を描けているかを問う",
        }
    )
    tot = sum(r.init_total for r in rows) or 1
    no_review = [r for r in rows if r.init_total and r.init_review / r.init_total < 0.3]
    out.append(
        {
            "key": "review",
            "where": "施策の検証",
            "title": "施策の検証日が決まっておらず、効果が確かめられていない",
            "n": len(no_review),
            "share": _pct(len(no_review), n),
            "unit": "事業",
            "fact": f"検証日が決まっている施策は{_pct(sum(r.init_review for r in rows), tot)}%、検証が済んだ施策は{_pct(sum(r.init_verified for r in rows), tot)}%",
            "move": "施策ごとに検証日と次の判断を決める運用を、補助金の中間報告や認定の更新の条件に組み込む",
        }
    )
    no_cond = [r for r in rows if r.init_total and r.init_condition / r.init_total < 0.3]
    out.append(
        {
            "key": "condition",
            "where": "施策の実行",
            "title": "予算・工数・権限・データがそろわず、施策が動き出せない",
            "n": len(no_cond),
            "share": _pct(len(no_cond), n),
            "unit": "事業",
            "fact": f"実行条件（予算・工数・権限・データの提供者）が確保された施策は{_pct(sum(r.init_condition for r in rows), tot)}%",
            "move": "補助金・人材支援を、実行条件の確保（社内の決裁・データ提供の合意）とセットで出す",
        }
    )
    stale = [rs for rs in by_co.values() if max(r.confirmed_at for r in rs) < year_ago]
    out.append(
        {
            "key": "stale",
            "where": "更新",
            "title": "戦略マップの更新が1年以上止まっている",
            "n": len(stale),
            "share": _pct(len(stale), len(by_co) or 1),
            "unit": "社",
            "fact": f"直近1年以内に更新していない企業が{len(stale)}社",
            "move": "年1回の更新を、DX認定の継続や表彰の応募の条件にする",
        }
    )
    return sorted(out, key=lambda h: -h["share"])


def main() -> None:
    """python -m app.open_data ：全社ぶんを作り直す（毎晩のバッチの手動実行）"""
    from .db import SessionLocal, engine

    m.Base.metadata.create_all(engine)
    with SessionLocal() as s:
        ensure_dummy(s)
        r = run_batch(s)
        s.commit()
    print(f"抽象化テーブルを作り直しました（生データのある会社 {r['companies']}社・{r['rows']}事業）")


if __name__ == "__main__":
    main()
