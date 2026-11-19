"""StrategyData の組み立てと、申請・作成中の申請・日々の進捗・版の保存（設計書 v0.4 の 5章・6章）。

- 戦略のテーブル（事業・テーマ・目標・つながり・施策）と進捗のテーブルには、現在の申請だけを入れる
- 過去の申請は strategy_application（申請の内容）と map_version（版）に JSON で残る
- 画面の計算（道筋の進み・DXの段階など）はフロントの logic.ts が行うので、ここでは
  DB の内容を画面と同じ形に並べ替えるだけにする
"""

from __future__ import annotations

import copy
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from . import models as m
from . import open_data
from .schemas import (
    InitiativeProgressIn,
    ObjectiveIn,
    ObjectiveProgressIn,
    StrategyIn,
    VersionIn,
)

JST = ZoneInfo("Asia/Tokyo")
MAX_VERSIONS = 6
START_LABEL = "作成時点"
END_LABEL = "置き換え時点"

# 戦略と日々の進捗のテーブル（消す順）
STRATEGY_TABLES = [
    m.ObjectiveProgress,
    m.InitiativeProgress,
    m.InitiativeObjective,
    m.Initiative,
    m.Link,
    m.Objective,
    m.Theme,
    m.BusinessUnit,
]


def now() -> datetime:
    """日本時間の今（DBにはタイムゾーンなしで入れる）"""
    return datetime.now(JST).replace(tzinfo=None)


def _iso(d: date | datetime | None) -> str:
    if d is None:
        return ""
    if isinstance(d, datetime):
        return d.replace(microsecond=0).isoformat()
    return d.isoformat()


def _put(d: dict, key: str, value: Any) -> None:
    """値があるときだけ入れる（フロントの型で「?」の項目は undefined にしておくため）"""
    if value is not None:
        d[key] = value


def _company(s: Session, cid: int) -> m.Company:
    company = s.get(m.Company, cid)
    if company is None:
        raise HTTPException(404, "会社のデータがありません（初期データが入っていません）")
    return company


def empty_strategy(company: m.Company) -> dict:
    """空の申請（全社の財務目標の枠だけ。事業は0件）"""
    return {
        "company": {"name": company.name, "industry": company.industry},
        "corp": {
            "fin": {
                "id": "cfin",
                "persp": "fi",
                "name": "",
                "kpi": "",
                "base": "",
                "target": "",
                "due": "",
                "owner": "mgmt",
                "partner": "",
            }
        },
        "bus": [],
        "inits": [],
    }


# ================================================================ 読む


def current_application(s: Session, cid: int) -> m.StrategyApplication | None:
    return s.scalars(
        select(m.StrategyApplication)
        .where(m.StrategyApplication.company_id == cid, m.StrategyApplication.replaced_at.is_(None))
        .order_by(m.StrategyApplication.id.desc())
        .limit(1)
    ).first()


def _app_ref(a: m.StrategyApplication | None) -> dict | None:
    return {"id": a.id, "submittedAt": _iso(a.submitted_at)} if a else None


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
    # 今の値：担当者が入れていなければ、今（申請時点）の値
    d["cur"] = prog.value if prog is not None else o.base
    if prog is not None:
        d["progress"] = {
            "at": _iso(prog.at),
            "reason": prog.reason,
            "memo": prog.memo,
            "author": prog.author,
            "updatedAt": _iso(prog.updated_at),
        }
    return d


def current_data(s: Session, cid: int) -> dict | None:
    """現在の申請の戦略と日々の進捗。申請がなければ None"""
    company = _company(s, cid)
    oprog = {p.objective_id: p for p in s.scalars(select(m.ObjectiveProgress).where(m.ObjectiveProgress.company_id == cid))}
    iprog = {p.initiative_id: p for p in s.scalars(select(m.InitiativeProgress).where(m.InitiativeProgress.company_id == cid))}

    objs = s.scalars(
        select(m.Objective)
        .where(m.Objective.company_id == cid, m.Objective.deleted_at.is_(None))
        .order_by(m.Objective.sort_order)
    ).all()
    corp = next((o for o in objs if o.bu_id is None), None)
    if corp is None:
        return None

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
            "exec": p.exec if p else i.exec0,
            "verify": p.verify if p else 0,
            "checks": {"condition": i.chk_condition, "review": i.chk_review},
        }
        cur = p.kpi_cur if p is not None and p.kpi_cur else i.base
        if cur:
            d["cur"] = cur
        if p is not None and (p.did or p.author):
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
    }


def build_strategy(s: Session, cid: int) -> dict:
    """A-2：現在の申請の戦略と日々の進捗。申請がなければ、事業が空の形で返す"""
    d = current_data(s, cid)
    app = current_application(s, cid)
    if d is None or app is None:
        d = empty_strategy(_company(s, cid))
        d["application"] = None
        return d
    d["application"] = _app_ref(app)
    return d


def _version_meta(v: m.MapVersion) -> dict:
    return {
        "id": v.id,
        "no": v.no,
        "label": v.label,
        "asOf": _iso(v.as_of),
        "kind": v.kind,
        "createdBy": v.created_by,
        "createdAt": _iso(v.created_at),
    }


def _versions(s: Session, app_id: int) -> list[m.MapVersion]:
    return s.scalars(
        select(m.MapVersion).where(m.MapVersion.application_id == app_id).order_by(m.MapVersion.no.desc())
    ).all()


def list_applications(s: Session, cid: int) -> list[dict]:
    """A-3：申請の一覧と、申請ごとの版の一覧（どちらも新しい順）"""
    apps = s.scalars(
        select(m.StrategyApplication)
        .where(m.StrategyApplication.company_id == cid)
        .order_by(m.StrategyApplication.id.desc())
    ).all()
    return [
        {
            "id": a.id,
            "submittedAt": _iso(a.submitted_at),
            "replacedAt": _iso(a.replaced_at) or None,
            "current": a.replaced_at is None,
            "versions": [_version_meta(v) for v in _versions(s, a.id)],
        }
        for a in apps
    ]


def _get_app(s: Session, cid: int, app_id: int) -> m.StrategyApplication:
    a = s.get(m.StrategyApplication, app_id)
    if a is None or a.company_id != cid:
        raise HTTPException(404, "申請が見つかりません")
    return a


def get_application(s: Session, cid: int, app_id: int) -> dict:
    """A-4：その申請の内容"""
    a = _get_app(s, cid, app_id)
    return {
        "id": a.id,
        "submittedAt": _iso(a.submitted_at),
        "replacedAt": _iso(a.replaced_at) or None,
        "current": a.replaced_at is None,
        "body": a.body,
    }


def _version_data(v: m.MapVersion, app: m.StrategyApplication) -> dict:
    data = copy.deepcopy(v.body)
    data["application"] = _app_ref(app)
    return data


def application_versions(s: Session, cid: int, app_id: int) -> dict:
    """A-12：その申請の版（戦略マップのJSONつき）。新しい順に最大6つ"""
    a = _get_app(s, cid, app_id)
    rows = _versions(s, a.id)[:MAX_VERSIONS]
    return {"versions": [_version_meta(v) | {"data": _version_data(v, a)} for v in rows]}


def _get_version(s: Session, cid: int, vid: int) -> m.MapVersion:
    v = s.get(m.MapVersion, vid)
    if v is None or v.company_id != cid:
        raise HTTPException(404, "版が見つかりません")
    return v


def get_version(s: Session, cid: int, vid: int) -> dict:
    """A-14：その版の戦略マップ"""
    v = _get_version(s, cid, vid)
    a = s.get(m.StrategyApplication, v.application_id)
    return _version_meta(v) | {"applicationId": v.application_id, "data": _version_data(v, a)}


def version_open_rows(s: Session, cid: int, vid: int) -> list[dict]:
    """その版を作ったときの抽象化の断面"""
    return _get_version(s, cid, vid).open_body or []


# ================================================================ 作成中の申請（A-6〜A-9）


def _strip_progress(body: dict) -> dict:
    """戦略マップのJSONから、日々の進捗の項目を外して申請の形にする"""
    b = copy.deepcopy(body)
    b.pop("application", None)
    for o in [b["corp"]["fin"]] + [o for bu in b.get("bus", []) for o in bu.get("objs", [])]:
        for k in ("cur", "prev", "progress"):
            o.pop(k, None)
    for i in b.get("inits", []):
        for k in ("cur", "prev", "progress", "verify"):
            i.pop(k, None)
    return b


def get_draft(s: Session, cid: int) -> dict | None:
    row = s.get(m.StrategyDraft, cid)
    if row is None:
        return None
    return {"body": row.body, "savedAt": _iso(row.updated_at), "carryFrom": row.carry_from}


def put_draft(s: Session, cid: int, body: dict) -> dict:
    """A-7：作成中の申請を上書き（中身は作成のときに確かめる）"""
    if not isinstance(body, dict) or "corp" not in body or "bus" not in body or "inits" not in body:
        raise HTTPException(422, "申請の形が正しくありません")
    row = s.get(m.StrategyDraft, cid)
    if row is None:
        if current_application(s, cid) is not None:
            raise HTTPException(409, "作成中の申請がありません。「新しい戦略マップを作る」から始めてください")
        row = m.StrategyDraft(company_id=cid, body={}, carry_from=None)
        s.add(row)
    row.body = _strip_progress(body)
    row.updated_at = now()
    s.flush()
    return {"savedAt": _iso(row.updated_at)}


def start_draft(s: Session, cid: int, carry_over: bool) -> dict:
    """A-8：作り直しを始める。
    はい：現在の申請の内容をコピーする。今（申請時点）と申請時点の状態は、日々の進捗の最新の値にする
    いいえ：空の申請から始める"""
    if s.get(m.StrategyDraft, cid) is not None:
        raise HTTPException(409, "作成中の申請がすでにあります")
    app = current_application(s, cid)
    if app is None:
        raise HTTPException(409, "まだ申請がありません")
    if carry_over:
        cur = current_data(s, cid) or app.body
        body = copy.deepcopy(cur)
        for o in [body["corp"]["fin"]] + [o for bu in body["bus"] for o in bu["objs"]]:
            if o.get("cur"):
                o["base"] = o["cur"]
        for i in body["inits"]:
            if i.get("cur"):
                i["base"] = i["cur"]
            i["exec"] = 1 if i.get("exec") == 1 else 0
        body = _strip_progress(body)
    else:
        body = empty_strategy(_company(s, cid))
    s.add(m.StrategyDraft(company_id=cid, body=body, carry_from=app.id if carry_over else None, updated_at=now()))
    s.flush()
    return get_draft(s, cid)


def discard_draft(s: Session, cid: int) -> None:
    """A-9：作り直しをやめる"""
    if current_application(s, cid) is None:
        raise HTTPException(409, "初めての申請は捨てられません")
    row = s.get(m.StrategyDraft, cid)
    if row is not None:
        s.delete(row)
    s.flush()


# ================================================================ 戦略マップを作成（A-5）


def _apply_objective(s: Session, cid: int, o: ObjectiveIn, bu_id: str | None, order: int) -> None:
    s.add(
        m.Objective(
            company_id=cid,
            id=o.id,
            bu_id=bu_id,
            persp=o.persp,
            name=o.name,
            kpi=o.kpi or "",
            base=o.base or "",
            target=o.target or "",
            due=o.due or "",
            owner=o.owner,
            partner=o.partner or "",
            theme_id=o.theme or None,
            cap=o.cap if o.persp == "lg" else None,
            fin_kind=o.kind if o.persp == "fi" else None,
            sort_order=order,
        )
    )


def _insert_strategy(s: Session, cid: int, body: StrategyIn, ts: datetime) -> None:
    """申請の内容を、空にした戦略のテーブルに入れる。施策の進捗は申請時点の状態で作る"""
    obj_ids: set[str] = {body.corp.fin.id}
    for b in body.bus:
        if len(b.themes) > 3:
            raise HTTPException(422, f"{b.name or b.id}：戦略テーマは3個までです")
        for o in b.objs:
            obj_ids.add(o.id)
    if len(obj_ids) != 1 + sum(len(b.objs) for b in body.bus):
        raise HTTPException(422, "目標のIDが重なっています")
    if len({b.id for b in body.bus}) != len(body.bus):
        raise HTTPException(422, "事業のIDが重なっています")

    _apply_objective(s, cid, body.corp.fin, None, 0)
    obj_order = 1
    theme_ids: set[str] = set()
    for bi, b in enumerate(body.bus):
        try:
            conf_at = date.fromisoformat(b.confAt) if b.confAt else None
        except ValueError:
            conf_at = None
        s.add(
            m.BusinessUnit(
                company_id=cid,
                id=b.id,
                name=b.name,
                industry=b.industry,
                share=b.share,
                owner_name=b.owner,
                cvp=b.cvp,
                customer=b.customer,
                future=b.future,
                gap=b.gap,
                growth=b.growth,
                conf_by=b.confBy,
                conf_at=conf_at,
                sort_order=bi,
            )
        )
        own_themes = set()
        for ti, t in enumerate(b.themes):
            if t.id in theme_ids:
                raise HTTPException(422, "戦略テーマのIDが重なっています")
            theme_ids.add(t.id)
            own_themes.add(t.id)
            s.add(m.Theme(company_id=cid, id=t.id, bu_id=b.id, name=t.name, hz=t.hz, sort_order=ti))

        bu_obj_ids = {o.id for o in b.objs}
        for o in b.objs:
            if o.theme and o.theme not in own_themes:
                o.theme = None  # 同じ事業にないテーマは付けない
            _apply_objective(s, cid, o, b.id, obj_order)
            obj_order += 1

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

    init_ids = set()
    for ii, i in enumerate(body.inits):
        if i.id in init_ids:
            raise HTTPException(422, "施策のIDが重なっています")
        init_ids.add(i.id)
        s.add(
            m.Initiative(
                company_id=cid,
                id=i.id,
                name=i.name,
                owner=i.owner,
                partner=i.partner or "",
                digital=i.digital,
                ipa=i.ipa if i.digital else None,
                ev=i.ev,
                chk_condition=i.checks.condition,
                chk_review=i.checks.review,
                kpi=i.kpi or "",
                base=i.base or "",
                target=i.target or "",
                exec0=i.exec,
                sort_order=ii,
            )
        )
        for ai, oid in enumerate(dict.fromkeys(i.attach)):
            if oid in obj_ids:  # ない目標への紐づけは保存しない
                s.add(m.InitiativeObjective(company_id=cid, initiative_id=i.id, objective_id=oid, sort_order=ai))
        s.add(m.InitiativeProgress(company_id=cid, initiative_id=i.id, exec=i.exec, verify=0, updated_at=ts))
    s.flush()


def _add_version(
    s: Session, cid: int, app: m.StrategyApplication, label: str, as_of: date, kind: str, by: str, ts: datetime
) -> m.MapVersion:
    """版を足す（同じ申請に同じ時点の版があれば上書き）。その時点の抽象化の断面も残す"""
    body = current_data(s, cid)
    if body is None:
        raise HTTPException(409, "戦略マップがありません")
    open_data.extract_company(s, cid)
    snap = open_data.snapshot_rows(s)
    row = s.scalars(
        select(m.MapVersion).where(m.MapVersion.application_id == app.id, m.MapVersion.label == label)
    ).first()
    if row is None:
        no = (s.scalar(select(func.max(m.MapVersion.no)).where(m.MapVersion.application_id == app.id)) or 0) + 1
        row = m.MapVersion(company_id=cid, application_id=app.id, no=no, label=label, kind=kind)
        s.add(row)
    elif row.kind != "manual":
        raise HTTPException(409, f"{label}の版は上書きできません")
    row.as_of, row.body, row.open_body = as_of, body, snap
    row.created_by, row.created_at = by, ts
    s.flush()
    return row


def create_application(s: Session, cid: int) -> dict:
    """A-5：作成中の申請から、新しい申請と戦略マップを作る（設計書 5-4 の①〜⑦）"""
    draft = s.get(m.StrategyDraft, cid)
    if draft is None:
        raise HTTPException(409, "作成中の申請がありません")
    try:
        body = StrategyIn.model_validate(draft.body)
    except ValidationError as e:
        first = e.errors()[0] if e.errors() else {}
        where = ".".join(str(x) for x in first.get("loc", []))
        raise HTTPException(422, f"申請の内容が正しくありません（{where}：{first.get('msg', '')}）") from e
    if not body.bus:
        raise HTTPException(422, "ステップ0で事業を追加してください")
    ts = now()

    # ① 現在の申請があれば、置き換え時点の版を作ってから置き換える
    old = current_application(s, cid)
    if old is not None:
        _add_version(s, cid, old, END_LABEL, ts.date(), "end", "申請の作り直し", ts)
        old.replaced_at = ts

    # ② 戦略と日々の進捗を全部消す（前の申請との紐付きを外す）
    for model in STRATEGY_TABLES:
        s.execute(delete(model).where(model.company_id == cid))
    s.flush()

    # ③④ 申請の中身を入れる
    _insert_strategy(s, cid, body, ts)

    # ⑤ 新しい申請
    app = m.StrategyApplication(company_id=cid, submitted_at=ts, body=_strip_progress(current_data(s, cid)))
    s.add(app)
    s.flush()

    # ⑥⑦ 抽象化テーブルの自社の行を作り直し、第1版（作成時点）を作る。作成中の申請を消す
    _add_version(s, cid, app, START_LABEL, ts.date(), "start", "申請", ts)
    s.delete(draft)
    company = s.get(m.Company, cid)
    if company:
        company.updated_at = ts
    s.flush()
    return build_strategy(s, cid)


# ================================================================ 日々の進捗（A-10・A-11）


def _require_current(s: Session, cid: int) -> m.StrategyApplication:
    app = current_application(s, cid)
    if app is None:
        raise HTTPException(409, "まだ戦略マップがありません")
    return app


def save_objective_progress(s: Session, cid: int, oid: str, body: ObjectiveProgressIn) -> None:
    _require_current(s, cid)
    o = s.get(m.Objective, (cid, oid))
    if o is None or o.deleted_at is not None:
        raise HTTPException(404, "目標が見つかりません")
    row = s.get(m.ObjectiveProgress, (cid, oid))
    if row is None:
        row = m.ObjectiveProgress(company_id=cid, objective_id=oid)
        s.add(row)
    row.value, row.at, row.reason = body.value, body.at, body.reason
    row.memo, row.author, row.updated_at = body.memo, body.author, now()
    # MVP：抽象化テーブルの自社の今の行をその場で作り直す（本番は毎晩のバッチ）
    open_data.extract_company(s, cid)


def save_initiative_progress(s: Session, cid: int, iid: str, body: InitiativeProgressIn) -> None:
    _require_current(s, cid)
    i = s.get(m.Initiative, (cid, iid))
    if i is None or i.deleted_at is not None:
        raise HTTPException(404, "施策が見つかりません")
    row = s.get(m.InitiativeProgress, (cid, iid))
    if row is None:
        row = m.InitiativeProgress(company_id=cid, initiative_id=iid, exec=i.exec0)
        s.add(row)
    # 進捗を入れたら、未着手の施策は実行中になる
    row.exec = 1
    row.verify = body.verify
    row.kpi_cur = body.kpiCur or None
    row.did, row.result, row.author, row.updated_at = body.did, body.result, body.author, now()
    open_data.extract_company(s, cid)


# ================================================================ 版（A-13・A-15）


def create_version(s: Session, cid: int, body: VersionIn) -> dict:
    app = _require_current(s, cid)
    v = _add_version(s, cid, app, body.label, body.asOf, "manual", body.createdBy, now())
    return _version_meta(v)


def delete_version(s: Session, cid: int, vid: int) -> None:
    v = _get_version(s, cid, vid)
    if v.kind != "manual":
        raise HTTPException(409, "作成時点・置き換え時点の版は消せません")
    app = s.get(m.StrategyApplication, v.application_id)
    if app is None or app.replaced_at is not None:
        raise HTTPException(409, "過去の申請の版は消せません")
    no = v.no
    s.delete(v)
    s.flush()
    # 番号を詰める（第1版・第2版…が飛ばないように）
    for later in s.scalars(
        select(m.MapVersion)
        .where(m.MapVersion.application_id == app.id, m.MapVersion.no > no)
        .order_by(m.MapVersion.no)
    ):
        later.no -= 1
        s.flush()
