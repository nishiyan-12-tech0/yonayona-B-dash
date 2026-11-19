"""APIの入力の形（設計書 6章）。項目名はフロントの types.ts と同じ。

出力はフロントの StrategyData の形の dict をそのまま返す（strategy.py で組み立てる）。
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Persp = Literal["lg", "pr", "cu", "fi"]
Owner = Literal["biz", "dx", "mgmt"]
Cap = Literal["hum", "inf", "org"]


class _In(BaseModel):
    # 担当者の項目（cur, prev, exec, verify, progress…）が送られてきても無視する
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ---------------------------------------------------------------- 申請（A-3）


class ObjectiveIn(_In):
    id: str = Field(min_length=1, max_length=40)
    persp: Persp
    name: str = ""
    kpi: str = ""
    base: str | None = ""
    target: str | None = ""
    due: str | None = ""
    owner: Owner = "biz"
    partner: str | None = ""
    theme: str | None = None
    cap: Cap | None = None
    kind: int | None = Field(default=None, ge=0, le=1)


class LinkIn(_In):
    from_: str = Field(default="", alias="from")
    to: str = ""
    reason: str = ""
    cond: str = ""
    check: str = ""
    date: str = ""


class ThemeIn(_In):
    id: str = Field(min_length=1, max_length=40)
    name: str = ""
    hz: int = Field(default=0, ge=0, le=2)


class BusinessUnitIn(_In):
    id: str = Field(min_length=1, max_length=40)
    name: str = ""
    industry: str = ""
    share: int = Field(default=0, ge=0, le=100)
    owner: str = ""
    cvp: int = Field(default=0, ge=0, le=3)
    customer: str = ""
    future: str = ""
    gap: str = ""
    growth: int = Field(default=50, ge=0, le=100)
    confBy: str = ""
    confAt: str = ""
    themes: list[ThemeIn] = []
    objs: list[ObjectiveIn] = []
    links: list[LinkIn] = []


class ChecksIn(_In):
    condition: bool = False
    review: bool = False


class InitiativeIn(_In):
    id: str = Field(min_length=1, max_length=40)
    name: str = ""
    attach: list[str] = []
    owner: Owner = "biz"
    partner: str | None = ""
    digital: bool = False
    ipa: int | None = Field(default=None, ge=1, le=7)
    ev: str = ""
    kpi: str | None = ""
    base: str | None = ""
    target: str | None = ""
    checks: ChecksIn = ChecksIn()
    # 申請時点の状態（0 検討中・1 試行中・2 実行中）。出発点を作る前と、新しく足した施策にだけ使う
    exec: int = Field(default=0, ge=0, le=2)


class CorpIn(_In):
    fin: ObjectiveIn


class StrategyIn(_In):
    corp: CorpIn
    bus: list[BusinessUnitIn]
    inits: list[InitiativeIn]


# ---------------------------------------------------------------- 進捗（A-5・A-6）


class ObjectiveProgressIn(_In):
    value: str = Field(min_length=1, max_length=100)
    at: date
    reason: int | None = Field(default=None, ge=0, le=4)
    memo: str = ""
    author: str = Field(min_length=1, max_length=100)


class InitiativeProgressIn(_In):
    exec: int = Field(ge=0, le=3)
    verify: int = Field(ge=0, le=3)
    kpiCur: str | None = Field(default=None, max_length=100)
    did: str = Field(min_length=1)
    result: str = ""
    author: str = Field(min_length=1, max_length=100)


# ---------------------------------------------------------------- 確定（A-8）


class ConfirmIn(_In):
    label: str = Field(min_length=1, max_length=50)
    asOf: date
    confirmedBy: str = Field(min_length=1, max_length=100)
