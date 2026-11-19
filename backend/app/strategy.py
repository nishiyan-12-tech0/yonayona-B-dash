"""StrategyData の組み立て（設計書 6-3・7章）と、申請・進捗・確定の保存（6-4〜6-7）。

画面の計算（道筋の進み・DXの段階など）はフロントの logic.ts が行うので、ここでは
DB の内容を画面と同じ形に並べ替えるだけにする。
"""

from __future__ import annotations

import copy
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from . import models as m
from . import open_data
from .schemas import (
    ConfirmIn,
    InitiativeProgressIn,
    ObjectiveIn,
    ObjectiveProgressIn,
    StrategyIn,
)

JST = ZoneInfo("Asia/Tokyo")
EXEC = ["検討中", "試行中", "実行中", "中止"]
NOW_LABEL = "現在"
MAX_VERSIONS = 6


def now() -> datetime:
    """日本時間の今（DBにはタイムゾーンなしで入れる）"""
    return datetime.now(JST).replace(tzinfo=None)


def _iso(d: date | datetime | None) -> str:
    return d.isoformat() if d else ""


def _put(d: dict, key: str, value: Any) -> None:
    """値があるときだけ入れる（フロントの型で「?」の項目は undefined にしておくため）"""
    if value is not None:
        d[key] = value


# ================================================================ 読む


def _latest_confirmation(s: Session, cid: int) -> m.ProgressConfirmation | None:
    return s.scalars(
        select(m.ProgressConfirmation)
        .where(m.ProgressConfirmation.company_id == cid)
        .order_by(m.ProgressConfirmation.as_of.desc(), m.ProgressConfirmation.confirmed_at.desc())
        .limit(1)
    ).first()


def _index_body(body: dict | None) -> tuple[dict[str, dict], dict[str, dict]]:
    """確定版の中身から、目標と施策をIDで引けるようにする"""
    if not body:
        return {}, {}
    objs = {body["corp"]["fin"]["id"]: body["corp"]["fin"]}
    for b in body.get("bus", []):
        for o in b.get("objs", []):
            objs[o["id"]] = o
    inits = {i["id"]: i for i in body.get("inits", [])}
    return objs, inits


def _objective_dict(o: m.Objective, prog: m.ObjectiveProgress | None) -> dict:
    d: dict[str, Any] = {
        "id": o.id,
        "persp": o.persp,
        "name": o.name,
        "kpi": o.kpi,
        "base": o.base,
        "target": o.target,
        "due": o.due,
        "owner": o.owner,
    }
    d["partner"] = o.partner
    _put(d, "theme", o.theme_id)
    _put(d, "cap", o.cap)
    _put(d, "kind", o.fin_kind)
    if prog is not None:
        d["cur"] = prog.value
        d["progress"] = {
            "at": _iso(prog.at),
            "reason": prog.reason,
            "memo": prog.memo,
            "author": prog.author,
            "updatedAt": _iso(prog.updated_at),
        }
    return d


def _current(s: Session, cid: int) -> dict:
    """今の戦略と保存中の進捗（比べる時点・変わったことは入れない）"""
    company = s.get(m.Company, cid)
    if company is None:
        raise HTTPException(404, "会社のデータがありません（初期データが入っていません）")

    oprog = {p.objective_id: p for p in s.scalars(select(m.ObjectiveProgress).where(m.ObjectiveProgress.company_id == cid))}
    iprog = {p.initiative_id: p for p in s.scalars(select(m.InitiativeProgress).where(m.InitiativeProgress.company_id == cid))}

    objs = s.scalars(
        select(m.Objective)
        .where(m.Objective.company_id == cid, m.Objective.deleted_at.is_(None))
        .order_by(m.Objective.sort_order)
    ).all()
    corp = next((o for o in objs if o.bu_id is None), None)
    if corp is None:
        raise HTTPException(500, "全社の目標がありません")

    themes = s.scalars(
        select(m.Theme).where(m.Theme.company_id == cid, m.Theme.deleted_at.is_(None)).order_by(m.Theme.sort_order)
    ).all()
    links = s.scalars(select(m.Link).where(m.Link.company_id == cid).order_by(m.Link.sort_order)).all()
    bus = s.scalars(
        select(m.BusinessUnit)
        .where(m.BusinessUnit.company_id == cid, m.BusinessUnit.deleted_at.is_(None))
        .order_by(m.BusinessUnit.sort_order)
    ).all()

    bus_out = []
    for b in bus:
        bus_out.append(
            {
                "id": b.id,
                "name": b.name,
                "industry": b.industry,
                "share": b.share,
                "owner": b.owner_name,
                "cvp": b.cvp,
                "customer": b.customer,
                "future": b.future,
                "gap": b.gap,
                "growth": b.growth,
                "confBy": b.conf_by,
                "confAt": _iso(b.conf_at),
                "themes": [{"id": t.id, "name": t.name, "hz": t.hz} for t in themes if t.bu_id == b.id],
                "objs": [_objective_dict(o, oprog.get(o.id)) for o in objs if o.bu_id == b.id],
                "links": [
                    {
                        "from": lk.from_id,
                        "to": lk.to_id,
                        "reason": lk.reason,
                        "cond": lk.cond,
                        "check": lk.check_text,
                        "date": lk.check_date,
                    }
                    for lk in links
                    if lk.bu_id == b.id
                ],
            }
        )

    attach: dict[str, list[str]] = {}
    for a in s.scalars(
        select(m.InitiativeObjective)
        .where(m.InitiativeObjective.company_id == cid)
        .order_by(m.InitiativeObjective.sort_order)
    ):
        attach.setdefault(a.initiative_id, []).append(a.objective_id)

    inits_out = []
    for i in s.scalars(
        select(m.Initiative)
        .where(m.Initiative.company_id == cid, m.Initiative.deleted_at.is_(None))
        .order_by(m.Initiative.sort_order)
    ):
        p = iprog.get(i.id)
        d: dict[str, Any] = {
            "id": i.id,
            "name": i.name,
            "attach": attach.get(i.id, []),
            "owner": i.owner,
            "partner": i.partner,
            "digital": i.digital,
            "ipa": i.ipa if i.digital else None,
            "ev": i.ev,
            "kpi": i.kpi,
            "base": i.base,
            "target": i.target,
            "exec": p.exec if p else 0,
            "verify": p.verify if p else 0,
            "checks": {"condition": i.chk_condition, "review": i.chk_review},
        }
        if p is not None:
            if p.kpi_cur:
                d["cur"] = p.kpi_cur
            d["progress"] = {
                "did": p.did,
                "result": p.result,
                "author": p.author,
                "updatedAt": _iso(p.updated_at),
            }
        inits_out.append(d)

    return {
        "company": {"name": company.name, "industry": company.industry},
        "corp": {"fin": _objective_dict(corp, oprog.get(corp.id))},
        "bus": bus_out,
        "inits": inits_out,
        "diffs": [],
    }


def _diffs(cur: dict, conf: m.ProgressConfirmation, notes: list[str]) -> list[str]:
    """直近の確定版から変わったこと（設計書 7-2）。確定のあとに保存した進捗だけを見る"""
    bobjs, binits = _index_body(conf.body)
    after = conf.confirmed_at.isoformat()
    lines: list[tuple[str, str]] = []

    all_objs = [cur["corp"]["fin"]] + [o for b in cur["bus"] for o in b["objs"]]
    for o in all_objs:
        p = o.get("progress")
        if not p or p["updatedAt"] <= after or not o.get("kpi"):
            continue
        old = bobjs.get(o["id"], {}).get("cur")
        new = o.get("cur")
        if old != new:
            lines.append((p["updatedAt"], f"{o['name']}：{o['kpi']} {old or '未測定'} → {new}"))

    for i in cur["inits"]:
        p = i.get("progress")
        if not p or p["updatedAt"] <= after:
            continue
        b = binits.get(i["id"], {})
        if "exec" in b and b["exec"] != i["exec"]:
            lines.append((p["updatedAt"], f"{i['name']}：{EXEC[b['exec']]} → {EXEC[i['exec']]}"))
        if p["did"] and p["did"] != (b.get("progress") or {}).get("did"):
            lines.append((p["updatedAt"], f"{i['name']}：{p['did']}"))

    lines.sort(key=lambda x: x[0], reverse=True)
    return [t for _, t in lines] + notes


def build_strategy(s: Session, cid: int) -> dict:
    """A-2：戦略マップ・申請で使う StrategyData。比べる時点は直近の確定版"""
    d = _current(s, cid)
    conf = _latest_confirmation(s, cid)
    d["snap"] = {"now": NOW_LABEL, "prev": conf.label if conf else None}
    if conf is None:
        return d

    bobjs, binits = _index_body(conf.body)
    for o in [d["corp"]["fin"]] + [o for b in d["bus"] for o in b["objs"]]:
        old = bobjs.get(o["id"])
        if old is not None and old.get("cur") is not None:
            o["prev"] = old["cur"]
    for i in d["inits"]:
        old = binits.get(i["id"])
        if old is not None:
            i["prev"] = {"exec": old["exec"], "verify": old["verify"], "checks": old["checks"]}

    notes = [
        n.text
        for n in s.scalars(
            select(m.ChangeNote)
            .where(m.ChangeNote.company_id == cid, m.ChangeNote.confirmation_id == conf.id)
            .order_by(m.ChangeNote.sort_order)
        )
    ]
    d["diffs"] = _diffs(d, conf, notes)
    return d


def list_confirmations(s: Session, cid: int) -> list[dict]:
    rows = s.scalars(
        select(m.ProgressConfirmation)
        .where(m.ProgressConfirmation.company_id == cid)
        .order_by(m.ProgressConfirmation.as_of.desc(), m.ProgressConfirmation.confirmed_at.desc())
    ).all()
    return [
        {
            "id": r.id,
            "label": r.label,
            "asOf": _iso(r.as_of),
            "confirmedBy": r.confirmed_by,
            "confirmedAt": _iso(r.confirmed_at),
            "isSeed": r.is_seed,
        }
        for r in rows
    ]


def confirmed_versions(s: Session, cid: int) -> dict:
    """A-9：他社と比べる画面に出す確定版（新しい順に最大6つ）"""
    rows = s.scalars(
        select(m.ProgressConfirmation)
        .where(m.ProgressConfirmation.company_id == cid)
        .order_by(m.ProgressConfirmation.as_of.desc(), m.ProgressConfirmation.confirmed_at.desc())
        .limit(MAX_VERSIONS)
    ).all()
    out = []
    for r in rows:
        data = copy.deepcopy(r.body)
        data["snap"] = {"now": r.label, "prev": None}
        data["diffs"] = []
        out.append({"id": r.id, "label": r.label, "asOf": _iso(r.as_of), "data": data})
    return {"versions": out}


# ================================================================ 申請の保存（A-3）


def _apply_objective(s: Session, cid: int, o: ObjectiveIn, bu_id: str | None, order: int, ts: datetime) -> None:
    row = s.get(m.Objective, (cid, o.id))
    if row is None:
        row = m.Objective(company_id=cid, id=o.id)
        s.add(row)
    row.bu_id = bu_id
    row.persp = o.persp
    row.name = o.name
    row.kpi = o.kpi or ""
    row.base = o.base or ""
    row.target = o.target or ""
    row.due = o.due or ""
    row.owner = o.owner
    row.partner = o.partner or ""
    row.theme_id = o.theme or None
    row.cap = o.cap if o.persp == "lg" else None
    row.fin_kind = o.kind if o.persp == "fi" else None
    row.sort_order = order
    row.deleted_at = None


def _soft_delete_missing(s: Session, model, cid: int, keep: set[str], ts: datetime) -> None:
    for row in s.scalars(select(model).where(model.company_id == cid, model.deleted_at.is_(None))):
        if row.id not in keep:
            row.deleted_at = ts


def save_strategy(s: Session, cid: int, body: StrategyIn) -> None:
    """申請の内容で戦略だけを上書きする（担当者の進捗には触らない）"""
    ts = now()

    # ---- 確かめる
    obj_ids: set[str] = {body.corp.fin.id}
    for b in body.bus:
        if len(b.themes) > 3:
            raise HTTPException(422, f"{b.name or b.id}：戦略テーマは3個までです")
        for o in b.objs:
            obj_ids.add(o.id)
    if len(obj_ids) != 1 + sum(len(b.objs) for b in body.bus):
        raise HTTPException(422, "目標のIDが重なっています")

    # ---- 事業・テーマ・目標
    _apply_objective(s, cid, body.corp.fin, None, 0, ts)
    bu_ids, theme_ids = set(), set()
    obj_order = 1
    for bi, b in enumerate(body.bus):
        bu_ids.add(b.id)
        row = s.get(m.BusinessUnit, (cid, b.id))
        if row is None:
            row = m.BusinessUnit(company_id=cid, id=b.id)
            s.add(row)
        row.name, row.industry, row.share = b.name, b.industry, b.share
        row.owner_name, row.cvp, row.customer, row.future = b.owner, b.cvp, b.customer, b.future
        row.gap, row.growth, row.conf_by = b.gap, b.growth, b.confBy
        try:
            row.conf_at = date.fromisoformat(b.confAt) if b.confAt else None
        except ValueError:
            row.conf_at = None
        row.sort_order, row.deleted_at = bi, None

        own_themes = set()
        for ti, t in enumerate(b.themes):
            theme_ids.add(t.id)
            own_themes.add(t.id)
            tr = s.get(m.Theme, (cid, t.id))
            if tr is None:
                tr = m.Theme(company_id=cid, id=t.id)
                s.add(tr)
            tr.bu_id, tr.name, tr.hz, tr.sort_order, tr.deleted_at = b.id, t.name, t.hz, ti, None

        bu_obj_ids = {o.id for o in b.objs}
        for o in b.objs:
            if o.theme and o.theme not in own_themes:
                o.theme = None  # 同じ事業にないテーマは付けない
            _apply_objective(s, cid, o, b.id, obj_order, ts)
            obj_order += 1

        # つながり：事業ごとに入れ直す（同じ事業の目標を指していないものは空にする）
        s.execute(delete(m.Link).where(m.Link.company_id == cid, m.Link.bu_id == b.id))
        for li, lk in enumerate(b.links):
            s.add(
                m.Link(
                    company_id=cid,
                    bu_id=b.id,
                    from_id=lk.from_ if lk.from_ in bu_obj_ids else "",
                    to_id=lk.to if lk.to in bu_obj_ids else "",
                    reason=lk.reason,
                    cond=lk.cond,
                    check_text=lk.check,
                    check_date=lk.date,
                    sort_order=li,
                )
            )

    s.flush()
    _soft_delete_missing(s, m.BusinessUnit, cid, bu_ids, ts)
    _soft_delete_missing(s, m.Theme, cid, theme_ids, ts)
    _soft_delete_missing(s, m.Objective, cid, obj_ids, ts)
    # 消した事業のつながりも消す
    s.execute(delete(m.Link).where(m.Link.company_id == cid, m.Link.bu_id.not_in(bu_ids or {""})))

    # ---- 施策
    # 出発点（最初の確定版）を作る前は、申請で選んだ「申請時点の状態」を施策の状態に入れる。
    # 出発点を作ったあとは、施策の状態は担当者が戦略マップで更新する（新しく足した施策だけ申請の値で始める）
    before_start = _latest_confirmation(s, cid) is None
    init_ids = set()
    s.execute(delete(m.InitiativeObjective).where(m.InitiativeObjective.company_id == cid))
    for ii, i in enumerate(body.inits):
        if i.id in init_ids:
            raise HTTPException(422, "施策のIDが重なっています")
        init_ids.add(i.id)
        row = s.get(m.Initiative, (cid, i.id))
        if row is None:
            row = m.Initiative(company_id=cid, id=i.id)
            s.add(row)
        row.name, row.owner, row.partner = i.name, i.owner, i.partner or ""
        row.digital = i.digital
        row.ipa = i.ipa if i.digital else None
        row.ev = i.ev
        row.chk_condition, row.chk_review = i.checks.condition, i.checks.review
        row.kpi, row.base, row.target = i.kpi or "", i.base or "", i.target or ""
        row.sort_order, row.deleted_at = ii, None
        for ai, oid in enumerate(dict.fromkeys(i.attach)):
            if oid in obj_ids:  # ない目標への紐づけは保存しない
                s.add(m.InitiativeObjective(company_id=cid, initiative_id=i.id, objective_id=oid, sort_order=ai))
        # 新しい施策は、申請時点の状態・「未測定」から始める
        prog = s.get(m.InitiativeProgress, (cid, i.id))
        if prog is None:
            s.add(m.InitiativeProgress(company_id=cid, initiative_id=i.id, exec=i.exec, verify=0, updated_at=ts))
        elif before_start and prog.exec != i.exec:
            prog.exec, prog.updated_at = i.exec, ts
    s.flush()
    _soft_delete_missing(s, m.Initiative, cid, init_ids, ts)

    company = s.get(m.Company, cid)
    if company:
        company.updated_at = ts


def save_version(s: Session, cid: int) -> dict:
    ts = now()
    row = m.StrategyVersion(company_id=cid, saved_at=ts, body=_current(s, cid))
    s.add(row)
    s.flush()
    return {"id": row.id, "savedAt": ts.replace(tzinfo=JST, microsecond=0).isoformat()}


# ================================================================ 進捗（A-5・A-6）


def save_objective_progress(s: Session, cid: int, oid: str, body: ObjectiveProgressIn) -> None:
    o = s.get(m.Objective, (cid, oid))
    if o is None or o.deleted_at is not None:
        raise HTTPException(404, "目標が見つかりません")
    row = s.get(m.ObjectiveProgress, (cid, oid))
    if row is None:
        row = m.ObjectiveProgress(company_id=cid, objective_id=oid)
        s.add(row)
    row.value, row.at, row.reason = body.value, body.at, body.reason
    row.memo, row.author, row.updated_at = body.memo, body.author, now()


def save_initiative_progress(s: Session, cid: int, iid: str, body: InitiativeProgressIn) -> None:
    i = s.get(m.Initiative, (cid, iid))
    if i is None or i.deleted_at is not None:
        raise HTTPException(404, "施策が見つかりません")
    row = s.get(m.InitiativeProgress, (cid, iid))
    if row is None:
        row = m.InitiativeProgress(company_id=cid, initiative_id=iid)
        s.add(row)
    row.exec = body.exec
    # 検討中・中止のときは、効果の検証は「未測定」にそろえる
    row.verify = body.verify if body.exec in (1, 2) else 0
    row.kpi_cur = body.kpiCur or None
    row.did, row.result, row.author, row.updated_at = body.did, body.result, body.author, now()


# ================================================================ 確定（A-8・A-12）


def confirm(s: Session, cid: int, body: ConfirmIn) -> None:
    snapshot = _current(s, cid)
    ts = now()
    row = s.scalars(
        select(m.ProgressConfirmation).where(
            m.ProgressConfirmation.company_id == cid, m.ProgressConfirmation.label == body.label
        )
    ).first()
    if row is not None and row.is_seed:
        raise HTTPException(409, f"{body.label}は出発点の確定版なので上書きできません")
    if row is None:
        row = m.ProgressConfirmation(company_id=cid, label=body.label, is_seed=False)
        s.add(row)
    row.as_of, row.body = body.asOf, snapshot
    row.confirmed_by, row.confirmed_at = body.confirmedBy, ts
    # 抽象化テーブル（オープンなDBの代わり）の自社の行を作り直す。本番は夜間バッチで行う
    open_data.extract_company(s, cid)


def submit(s: Session, cid: int) -> None:
    """A-15：申請を初めて出し終えたとき、その内容を出発点の確定版にする（2回目以降は何もしない）。
    出発点は消せない・上書きできない（is_seed）。抽象化テーブルの自社の行もここで作る"""
    if _latest_confirmation(s, cid) is not None:
        return
    ts = now()
    s.add(
        m.ProgressConfirmation(
            company_id=cid,
            label=f"{ts.year}年{ts.month}月 申請時点",
            as_of=ts.date(),
            body=_current(s, cid),
            confirmed_by="申請",
            confirmed_at=ts,
            is_seed=True,
        )
    )
    s.flush()
    open_data.extract_company(s, cid)


def delete_confirmation(s: Session, cid: int, conf_id: int) -> None:
    row = s.get(m.ProgressConfirmation, conf_id)
    if row is None or row.company_id != cid:
        raise HTTPException(404, "確定版が見つかりません")
    if row.is_seed:
        raise HTTPException(409, "出発点の確定版は消せません")
    s.execute(delete(m.ChangeNote).where(m.ChangeNote.confirmation_id == conf_id))
    s.delete(row)
    # 最新の確定版が変わるので、抽象化テーブルの自社の行も作り直す
    open_data.extract_company(s, cid)
