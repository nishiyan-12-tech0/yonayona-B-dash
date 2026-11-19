"""初期データの投入（設計書 9章）。

    python -m app.seed           テーブルを作り、会社のデータがなければ初期データを入れる
    python -m app.seed --reset   会社のデータを全部消してから入れ直す（デモを初期状態に戻す）

初期データは app/seed_data.json（フロントの旧 src/mocks/seed.ts を書き出したもの）。
"""

from __future__ import annotations

import argparse
import copy
import json
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import delete, select, text
from sqlalchemy.orm import Session

from . import models as m
from . import open_data
from .config import get_settings
from .db import SessionLocal, engine
from .strategy import now

SEED_FILE = Path(__file__).with_name("seed_data.json")
SEED_LABEL = "2026年3月末"
SEED_AS_OF = date(2026, 3, 31)

# 会社ごとに持つテーブル（消す順）
COMPANY_TABLES = [
    m.ChangeNote,
    m.ProgressConfirmation,
    m.StrategyVersion,
    m.ObjectiveProgress,
    m.InitiativeProgress,
    m.InitiativeObjective,
    m.Initiative,
    m.Link,
    m.Objective,
    m.Theme,
    m.BusinessUnit,
]


def load_seed() -> dict:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def _march_body(strategy: dict) -> dict:
    """ダミーデータの prev（2026年3月末）の値で、確定版の中身を作る"""
    b = copy.deepcopy(strategy)
    objs = [b["corp"]["fin"]] + [o for bu in b["bus"] for o in bu["objs"]]
    for o in objs:
        if "prev" in o:
            o["cur"] = o["prev"]
        o.pop("prev", None)
    for i in b["inits"]:
        p = i.pop("prev", None)
        if p:
            i["exec"], i["verify"], i["checks"] = p["exec"], p["verify"], p["checks"]
    b["diffs"] = []
    return b


def _objective_row(cid: int, o: dict, bu_id: str | None, order: int) -> m.Objective:
    return m.Objective(
        company_id=cid,
        id=o["id"],
        bu_id=bu_id,
        persp=o["persp"],
        name=o.get("name", ""),
        kpi=o.get("kpi", ""),
        base=o.get("base", ""),
        target=o.get("target", ""),
        due=o.get("due", ""),
        owner=o.get("owner", "biz"),
        partner=o.get("partner", ""),
        theme_id=o.get("theme"),
        cap=o.get("cap"),
        fin_kind=o.get("kind"),
        sort_order=order,
    )


def insert_seed(s: Session, cid: int) -> None:
    seed = load_seed()
    st = seed["strategy"]
    ts = now()
    # 進捗は確定版より1秒前に保存したことにする（「変わったこと」に初期データの文だけが出るように）
    prog_ts = ts - timedelta(seconds=1)

    s.add(m.Company(id=cid, name=st["company"]["name"], industry=st["company"]["industry"], created_at=ts, updated_at=ts))
    s.flush()

    objs = [(st["corp"]["fin"], None)]
    s.add(_objective_row(cid, st["corp"]["fin"], None, 0))
    order = 1
    for bi, b in enumerate(st["bus"]):
        s.add(
            m.BusinessUnit(
                company_id=cid,
                id=b["id"],
                name=b["name"],
                industry=b["industry"],
                share=b["share"],
                owner_name=b["owner"],
                cvp=b["cvp"],
                customer=b["customer"],
                future=b["future"],
                gap=b["gap"],
                growth=b["growth"],
                conf_by=b.get("confBy", ""),
                conf_at=date.fromisoformat(b["confAt"]) if b.get("confAt") else None,
                sort_order=bi,
            )
        )
        for ti, t in enumerate(b["themes"]):
            s.add(m.Theme(company_id=cid, id=t["id"], bu_id=b["id"], name=t["name"], hz=t["hz"], sort_order=ti))
        for o in b["objs"]:
            s.add(_objective_row(cid, o, b["id"], order))
            objs.append((o, b["id"]))
            order += 1
        for li, lk in enumerate(b["links"]):
            s.add(
                m.Link(
                    company_id=cid,
                    bu_id=b["id"],
                    from_id=lk["from"],
                    to_id=lk["to"],
                    reason=lk["reason"],
                    cond=lk["cond"],
                    check_text=lk["check"],
                    check_date=lk["date"],
                    sort_order=li,
                )
            )

    # 目標の今の値は「確定前の保存」として入れる。更新時刻は確定版と同じにして、
    # 「変わったこと」には初期データの文（change_note）だけが出るようにする
    for o, _ in objs:
        if o.get("cur") is not None:
            s.add(m.ObjectiveProgress(company_id=cid, objective_id=o["id"], value=o["cur"], author="", updated_at=prog_ts))

    for ii, i in enumerate(st["inits"]):
        s.add(
            m.Initiative(
                company_id=cid,
                id=i["id"],
                name=i["name"],
                owner=i["owner"],
                partner=i.get("partner", ""),
                digital=i["digital"],
                ipa=i.get("ipa"),
                ev=i.get("ev", ""),
                chk_condition=i["checks"]["condition"],
                chk_review=i["checks"]["review"],
                kpi=i.get("kpi", ""),
                base=i.get("base", ""),
                target=i.get("target", ""),
                sort_order=ii,
            )
        )
        for ai, oid in enumerate(i["attach"]):
            s.add(m.InitiativeObjective(company_id=cid, initiative_id=i["id"], objective_id=oid, sort_order=ai))
        s.add(
            m.InitiativeProgress(
                company_id=cid,
                initiative_id=i["id"],
                exec=i["exec"],
                verify=i["verify"],
                kpi_cur=i.get("cur") or None,
                updated_at=prog_ts,
            )
        )

    conf = m.ProgressConfirmation(
        company_id=cid,
        label=SEED_LABEL,
        as_of=SEED_AS_OF,
        body=_march_body(st),
        confirmed_by="初期データ",
        confirmed_at=ts,
        is_seed=True,
    )
    s.add(conf)
    s.flush()
    for n, t in enumerate(st.get("diffs", [])):
        s.add(m.ChangeNote(company_id=cid, confirmation_id=conf.id, text=t, sort_order=n))

    for key in ("peers", "meti"):
        ref = s.get(m.ReferenceData, key)
        if ref is None:
            s.add(m.ReferenceData(key=key, body=seed[key], updated_at=ts))
        else:
            ref.body, ref.updated_at = seed[key], ts

    # 抽象化テーブル（オープンなDBの代わり）：他社のダミーと、自社の出発点の確定版から作った行
    open_data.ensure_dummy(s)
    open_data.extract_company(s, cid)


def clear_company(s: Session, cid: int) -> None:
    for model in COMPANY_TABLES:
        s.execute(delete(model).where(model.company_id == cid))
    s.execute(delete(m.Company).where(m.Company.id == cid))
    s.flush()


def reset(s: Session, cid: int) -> None:
    clear_company(s, cid)
    insert_seed(s, cid)


def ensure_seeded(cid: int) -> bool:
    """起動時：テーブルを作り、会社のデータがなければ初期データを入れる。入れたら True"""
    is_mysql = engine.dialect.name == "mysql"
    with engine.connect() as conn:
        # gunicorn の複数のワーカーが同時に入れないように、MySQL のロックを取る
        if is_mysql:
            conn.execute(text("SELECT GET_LOCK('michisuji_seed', 30)"))
        try:
            m.Base.metadata.create_all(conn)
            conn.commit()
            with Session(bind=conn) as s:
                if s.scalars(select(m.Company).where(m.Company.id == cid)).first() is not None:
                    # 会社のデータはある。抽象化テーブルが空なら（このテーブルを足す前のDBなど）ここで作る
                    open_data.ensure_dummy(s)
                    has_own = s.scalars(
                        select(m.OpenBusinessSnapshot.id).where(m.OpenBusinessSnapshot.company_id == cid).limit(1)
                    ).first()
                    if has_own is None:
                        open_data.extract_company(s, cid)
                    s.commit()
                    conn.commit()
                    return False
                insert_seed(s, cid)
                s.commit()
            conn.commit()
            return True
        finally:
            if is_mysql:
                conn.execute(text("SELECT RELEASE_LOCK('michisuji_seed')"))


def main() -> None:
    p = argparse.ArgumentParser(description="ミチスジの初期データを入れる")
    p.add_argument("--reset", action="store_true", help="会社のデータを消してから入れ直す")
    args = p.parse_args()
    cid = get_settings().company_id
    if args.reset:
        m.Base.metadata.create_all(engine)
        with SessionLocal() as s:
            reset(s, cid)
            s.commit()
        print("初期データに戻しました")
    else:
        print("初期データを入れました" if ensure_seeded(cid) else "データはすでに入っています")


if __name__ == "__main__":
    main()
