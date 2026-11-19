"""初期データの投入（設計書 v0.4 の 8-5・9章）。

    python -m app.seed           テーブルを作り、会社のデータがなければ初期データを入れる
    python -m app.seed --reset   会社のデータを全部消してから入れ直す（デモを初期状態に戻す）

初期状態：申請・戦略マップ・進捗・版はなく、作成中の申請に全項目入力済みの申請だけが入っている
（申請画面の「① 初めての入力」。ステップ8で「戦略マップを作成」を押すと、戦略マップができる）。

初期データは app/seed_data.json（フロントの旧 src/mocks/seed.ts を書き出したもの）。
"""

from __future__ import annotations

import argparse
import copy
import json
import logging
from pathlib import Path

from sqlalchemy import delete, inspect, select, text
from sqlalchemy.orm import Session

from . import models as m
from . import open_data
from .config import get_settings
from .db import SessionLocal, engine
from .strategy import STRATEGY_TABLES, now

log = logging.getLogger("michisuji")
SEED_FILE = Path(__file__).with_name("seed_data.json")

# スキーマの版。テーブルの作りを変えたら上げる（古いDBは起動時に作り直す）
SCHEMA_VERSION = "0.4.1"
# 前の版で使っていて、今は使わないテーブル（作り直すときに消す）
LEGACY_TABLES = ["change_note", "progress_confirmation", "strategy_version"]

# 会社ごとに持つテーブル（消す順）
COMPANY_TABLES = [m.StrategyDraft, m.MapVersion, m.StrategyApplication, *STRATEGY_TABLES]


def load_seed() -> dict:
    return json.loads(SEED_FILE.read_text(encoding="utf-8"))


def seed_application(strategy: dict) -> dict:
    """ダミーの戦略を、全項目入力済みの申請にする。
    今（申請時点）は、ダミーの「現在」の値（なければ base）。申請時点の状態は、試行中・実行中＝実行中、それ以外＝未着手"""
    b = copy.deepcopy(strategy)
    b.pop("diffs", None)
    for o in [b["corp"]["fin"]] + [o for bu in b["bus"] for o in bu["objs"]]:
        if o.get("cur"):
            o["base"] = o["cur"]
        for k in ("cur", "prev", "progress"):
            o.pop(k, None)
    for i in b["inits"]:
        if i.get("cur"):
            i["base"] = i["cur"]
        i["exec"] = 1 if i.get("exec") in (1, 2) else 0
        for k in ("cur", "prev", "progress", "verify"):
            i.pop(k, None)
    return b


def insert_seed(s: Session, cid: int) -> None:
    seed = load_seed()
    st = seed["strategy"]
    ts = now()
    s.add(m.Company(id=cid, name=st["company"]["name"], industry=st["company"]["industry"], created_at=ts, updated_at=ts))
    s.flush()
    s.add(m.StrategyDraft(company_id=cid, body=seed_application(st), carry_from=None, updated_at=ts))

    for key in ("peers", "meti"):
        ref = s.get(m.ReferenceData, key)
        if ref is None:
            s.add(m.ReferenceData(key=key, body=seed[key], updated_at=ts))
        else:
            ref.body, ref.updated_at = seed[key], ts

    # 抽象化テーブル（オープンなDBの代わり）：他社のダミー。自社の行は、戦略マップを作ったときにできる
    open_data.ensure_dummy(s)
    s.flush()

    # デモの初期状態：申請済みで、約1年ぶんの進捗と四半期ごとの版が入った状態にする
    from . import demo_story

    demo_story.build(s, cid)


def clear_company(s: Session, cid: int) -> None:
    for model in COMPANY_TABLES:
        s.execute(delete(model).where(model.company_id == cid))
    s.execute(delete(m.OpenBusinessSnapshot).where(m.OpenBusinessSnapshot.company_id == cid))
    s.execute(delete(m.Company).where(m.Company.id == cid))
    s.flush()


def reset(s: Session, cid: int) -> None:
    clear_company(s, cid)
    insert_seed(s, cid)


def _schema_is_current(conn) -> bool:
    insp = inspect(conn)
    if not insp.has_table("schema_meta"):
        return False
    row = conn.execute(text("SELECT value FROM schema_meta WHERE `key` = 'schema'")).first()
    return row is not None and row[0] == SCHEMA_VERSION


# あとから足した列。スキーマの版を上げる（＝全データを消して作り直す）代わりに、なければ足す
ADDED_COLUMNS = {
    "open_business_snapshot": [("mix_plan", "SMALLINT NULL"), ("mix_actual", "SMALLINT NULL")],
}


def _add_missing_columns(conn) -> None:
    insp = inspect(conn)
    for table, cols in ADDED_COLUMNS.items():
        if not insp.has_table(table):
            continue
        have = {c["name"] for c in insp.get_columns(table)}
        for name, ddl in cols:
            if name not in have:
                log.warning("列を追加します：%s.%s", table, name)
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def rebuild_schema(conn) -> None:
    """テーブルを全部消して作り直す（中のデータは消える。MVPなので初期データに戻してよい）"""
    is_mysql = conn.dialect.name == "mysql"
    if is_mysql:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
    for name in LEGACY_TABLES:
        conn.execute(text(f"DROP TABLE IF EXISTS {name}"))
    m.Base.metadata.drop_all(conn)
    if is_mysql:
        conn.execute(text("SET FOREIGN_KEY_CHECKS = 1"))
    m.Base.metadata.create_all(conn)
    conn.execute(m.SchemaMeta.__table__.insert().values(key="schema", value=SCHEMA_VERSION))
    conn.commit()


def ensure_seeded(cid: int) -> bool:
    """起動時：スキーマが古ければ作り直し、会社のデータがなければ初期データを入れる。入れたら True"""
    is_mysql = engine.dialect.name == "mysql"
    with engine.connect() as conn:
        # gunicorn の複数のワーカーが同時に入れないように、MySQL のロックを取る
        if is_mysql:
            conn.execute(text("SELECT GET_LOCK('michisuji_seed', 30)"))
        try:
            if not _schema_is_current(conn):
                log.warning("スキーマが古いので、テーブルを作り直します（版 %s）", SCHEMA_VERSION)
                rebuild_schema(conn)
            m.Base.metadata.create_all(conn)
            _add_missing_columns(conn)
            conn.commit()
            with Session(bind=conn) as s:
                if s.scalars(select(m.Company).where(m.Company.id == cid)).first() is not None:
                    open_data.ensure_dummy(s)
                    open_data.backfill_mix(s)
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
        ensure_seeded(cid)
        with SessionLocal() as s:
            reset(s, cid)
            s.commit()
        print("初期データに戻しました")
    else:
        print("初期データを入れました" if ensure_seeded(cid) else "データはすでに入っています")


if __name__ == "__main__":
    main()
