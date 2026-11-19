"""API（設計書 v0.4 の 6-2 の A-1〜A-19）。会社は環境変数 COMPANY_ID に固定。"""

from typing import Any

from fastapi import APIRouter, Body, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import open_data, seed, strategy
from ..config import get_settings
from ..db import get_session
from ..schemas import DraftStartIn, InitiativeProgressIn, ObjectiveProgressIn, VersionIn

router = APIRouter(prefix="/api")


def cid() -> int:
    return get_settings().company_id


# ---------------------------------------------------------------- A-1


@router.get("/health")
def health(s: Session = Depends(get_session)):
    s.execute(text("SELECT 1"))
    return {"status": "ok"}


# ---------------------------------------------------------------- 戦略マップ・申請


@router.get("/strategy")
def get_strategy(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-2：現在の申請の戦略と日々の進捗"""
    return strategy.build_strategy(s, c)


@router.get("/applications")
def get_applications(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-3：申請の一覧と、申請ごとの版の一覧（サイドメニュー）"""
    return strategy.list_applications(s, c)


@router.get("/applications/{application_id}")
def get_application(application_id: int, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-4：その申請の内容"""
    return strategy.get_application(s, c, application_id)


@router.post("/applications")
def post_application(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-5：作成中の申請から、新しい申請と戦略マップを作る"""
    return strategy.create_application(s, c)


@router.get("/applications/{application_id}/versions")
def get_application_versions(application_id: int, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-12：その申請の版（他社と比べる画面の白抜きの点）"""
    return strategy.application_versions(s, c, application_id)


# ---------------------------------------------------------------- 作成中の申請


@router.get("/draft")
def get_draft(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-6：作成中の申請（なければ null）"""
    return strategy.get_draft(s, c)


@router.put("/draft")
def put_draft(body: dict[str, Any] = Body(...), s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-7：作成中の申請を上書き（自動保存・保存して次へ）"""
    return strategy.put_draft(s, c, body)


@router.post("/draft")
def post_draft(body: DraftStartIn, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-8：作り直しを始める（前回の内容を引き継ぐか）"""
    return strategy.start_draft(s, c, body.carryOver)


@router.delete("/draft")
def delete_draft(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-9：作り直しをやめる"""
    strategy.discard_draft(s, c)
    return {"status": "ok"}


# ---------------------------------------------------------------- 日々の進捗


@router.put("/objectives/{objective_id}/progress")
def put_objective_progress(
    objective_id: str, body: ObjectiveProgressIn, s: Session = Depends(get_session), c: int = Depends(cid)
):
    """A-10：目標の進捗を上書き"""
    strategy.save_objective_progress(s, c, objective_id, body)
    s.flush()
    return strategy.build_strategy(s, c)


@router.put("/initiatives/{initiative_id}/progress")
def put_initiative_progress(
    initiative_id: str, body: InitiativeProgressIn, s: Session = Depends(get_session), c: int = Depends(cid)
):
    """A-11：施策の進捗を上書き（未着手なら実行中にする）"""
    strategy.save_initiative_progress(s, c, initiative_id, body)
    s.flush()
    return strategy.build_strategy(s, c)


# ---------------------------------------------------------------- 版


@router.post("/versions")
def post_version(body: VersionIn, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-13：現在の申請に版を作る（同じ時点があれば上書き）"""
    return strategy.create_version(s, c, body)


@router.get("/versions/{version_id}")
def get_version(version_id: int, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-14：その版の戦略マップ"""
    return strategy.get_version(s, c, version_id)


@router.delete("/versions/{version_id}")
def delete_version(version_id: int, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-15：版を1つ消す（作成時点・置き換え時点・過去の申請の版は消せない）"""
    strategy.delete_version(s, c, version_id)
    return {"status": "ok"}


# ---------------------------------------------------------------- 他社・集計（抽象化テーブル）


@router.get("/peers")
def get_peers(version: int | None = None, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-16：他社と比べる。版を指定したら、その版を作ったときの抽象化の断面から"""
    snap = strategy.version_open_rows(s, c, version) if version else None
    return open_data.peers(s, c, snap)


@router.get("/meti/summary")
def get_meti(version: int | None = None, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-17：参加企業の集計（経産省）。版を指定したら、その版を作ったときの抽象化の断面から"""
    snap = strategy.version_open_rows(s, c, version) if version else None
    return open_data.meti_summary(s, c, snap)


@router.post("/batch/open-data")
def post_batch(s: Session = Depends(get_session)):
    """A-18：抽象化テーブルの今の行を全社ぶん作り直す（本番の毎晩のバッチにあたる。手動実行用）"""
    open_data.ensure_dummy(s)
    return open_data.run_batch(s)


@router.post("/demo/reset")
def demo_reset(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-19：初期状態に戻す（展示用）。申請・戦略マップ・進捗・版を消し、入力済みの作成中の申請だけにする"""
    seed.reset(s, c)
    s.flush()
    return strategy.get_draft(s, c)
