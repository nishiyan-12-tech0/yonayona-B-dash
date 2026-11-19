"""API（設計書 6-2 の A-1〜A-13）。会社は環境変数 COMPANY_ID に固定。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from .. import models as m
from .. import open_data, seed, strategy
from ..config import get_settings
from ..db import get_session
from ..schemas import ConfirmIn, InitiativeProgressIn, ObjectiveProgressIn, StrategyIn

router = APIRouter(prefix="/api")


def cid() -> int:
    return get_settings().company_id


# ---------------------------------------------------------------- A-1


@router.get("/health")
def health(s: Session = Depends(get_session)):
    s.execute(text("SELECT 1"))
    return {"status": "ok"}


# ---------------------------------------------------------------- 申請・戦略マップ


@router.get("/strategy")
def get_strategy(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-2：戦略と保存中の進捗。比べる時点は直近の確定版"""
    return strategy.build_strategy(s, c)


@router.put("/strategy")
def put_strategy(body: StrategyIn, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-3：申請の内容で戦略を上書き（担当者の進捗は変えない）"""
    strategy.save_strategy(s, c, body)
    s.flush()
    return strategy.build_strategy(s, c)


@router.post("/strategy/submit")
def post_submit(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-15：申請を出し終えた。初めてなら、その内容を出発点の確定版にする"""
    strategy.submit(s, c)
    s.flush()
    return strategy.build_strategy(s, c)


@router.post("/strategy/versions")
def post_version(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-4：今の申請内容を版として残す"""
    return strategy.save_version(s, c)


@router.put("/objectives/{objective_id}/progress")
def put_objective_progress(
    objective_id: str, body: ObjectiveProgressIn, s: Session = Depends(get_session), c: int = Depends(cid)
):
    """A-5：目標の進捗を上書き"""
    strategy.save_objective_progress(s, c, objective_id, body)
    s.flush()
    return strategy.build_strategy(s, c)


@router.put("/initiatives/{initiative_id}/progress")
def put_initiative_progress(
    initiative_id: str, body: InitiativeProgressIn, s: Session = Depends(get_session), c: int = Depends(cid)
):
    """A-6：施策の進捗を上書き"""
    strategy.save_initiative_progress(s, c, initiative_id, body)
    s.flush()
    return strategy.build_strategy(s, c)


# ---------------------------------------------------------------- 確定


@router.get("/confirmations")
def get_confirmations(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-7：確定版の一覧（新しい順）"""
    return strategy.list_confirmations(s, c)


@router.post("/confirmations")
def post_confirmation(body: ConfirmIn, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-8：今の進捗を確定版にする（同じ期間があれば上書き）"""
    strategy.confirm(s, c, body)
    s.flush()
    return strategy.build_strategy(s, c)


@router.delete("/confirmations/{confirmation_id}")
def delete_confirmation(confirmation_id: int, s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-12：確定版を1つ消す（出発点は消せない）"""
    strategy.delete_confirmation(s, c, confirmation_id)
    s.flush()
    return strategy.build_strategy(s, c)


@router.get("/strategy/confirmed")
def get_confirmed(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-9：他社と比べる画面の確定版（新しい順に最大6つ）"""
    return strategy.confirmed_versions(s, c)


@router.post("/demo/reset")
def demo_reset(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-13：初期データに戻す（展示用）"""
    seed.reset(s, c)
    s.flush()
    return strategy.build_strategy(s, c)


# ---------------------------------------------------------------- 他社・集計（初期データ）


def _reference(s: Session, key: str):
    row = s.get(m.ReferenceData, key)
    if row is None:
        raise HTTPException(404, "初期データが入っていません")
    return row.body


@router.get("/peers")
def get_peers(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-10：他社と比べる。抽象化テーブル（オープンなDBの代わり）の自社以外の行から集計"""
    return open_data.peers(s, c)


@router.get("/meti/summary")
def get_meti(s: Session = Depends(get_session), c: int = Depends(cid)):
    """A-11：参加企業の集計（経産省）。抽象化テーブルの全社の行から集計"""
    return open_data.meti_summary(s, c)


@router.post("/batch/open-data")
def post_batch(s: Session = Depends(get_session)):
    """A-14：抽象化テーブルを全社ぶん作り直す（本番の夜間バッチにあたる。手動実行用）"""
    open_data.ensure_dummy(s)
    return open_data.run_batch(s)
