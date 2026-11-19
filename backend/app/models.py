"""テーブルの定義（設計書 8章）。

- 戦略（トップが申請で入力）：company / business_unit / theme / objective / link / initiative / initiative_objective
- 進捗（担当者が戦略マップで入力。上書き）：objective_progress / initiative_progress
- 確定版・その他：progress_confirmation / strategy_version / change_note / reference_data
- 抽象化（オープンなDBの代わり）：open_business_snapshot
"""

from datetime import date, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# 進捗の更新と確定の前後を比べるので、時刻はマイクロ秒まで持つ
PRECISE = DateTime().with_variant(mysql.DATETIME(fsp=6), "mysql")

TABLE_ARGS = {"mysql_charset": "utf8mb4", "mysql_engine": "InnoDB"}

PERSP = Enum("lg", "pr", "cu", "fi", name="persp", native_enum=True, create_constraint=False)
OWNER = Enum("biz", "dx", "mgmt", name="owner", native_enum=True, create_constraint=False)
CAP = Enum("hum", "inf", "org", name="cap", native_enum=True, create_constraint=False)


class Base(DeclarativeBase):
    pass


def _company_fk():
    return mapped_column(Integer, ForeignKey("company.id"), primary_key=True)


# ---------------------------------------------------------------- 戦略


class Company(Base):
    __tablename__ = "company"
    __table_args__ = (TABLE_ARGS | {"comment": "会社"},)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    industry: Mapped[str] = mapped_column(String(100), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


class BusinessUnit(Base):
    __tablename__ = "business_unit"
    __table_args__ = (TABLE_ARGS | {"comment": "事業"},)
    company_id: Mapped[int] = _company_fk()
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(100), default="")
    industry: Mapped[str] = mapped_column(String(100), default="")
    share: Mapped[int] = mapped_column(SmallInteger, default=0)
    owner_name: Mapped[str] = mapped_column(String(100), default="")
    cvp: Mapped[int] = mapped_column(SmallInteger, default=0)
    customer: Mapped[str] = mapped_column(Text, default="")
    future: Mapped[str] = mapped_column(Text, default="")
    gap: Mapped[str] = mapped_column(String(200), default="")
    growth: Mapped[int] = mapped_column(SmallInteger, default=50)
    conf_by: Mapped[str] = mapped_column(String(100), default="")
    conf_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Theme(Base):
    __tablename__ = "theme"
    __table_args__ = (TABLE_ARGS | {"comment": "戦略テーマ"},)
    company_id: Mapped[int] = _company_fk()
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    bu_id: Mapped[str] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(200), default="")
    hz: Mapped[int] = mapped_column(SmallInteger, default=0)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Objective(Base):
    __tablename__ = "objective"
    __table_args__ = (TABLE_ARGS | {"comment": "目標（全社の目標は bu_id が NULL）"},)
    company_id: Mapped[int] = _company_fk()
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    bu_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    persp: Mapped[str] = mapped_column(PERSP)
    name: Mapped[str] = mapped_column(String(200), default="")
    kpi: Mapped[str] = mapped_column(String(200), default="")
    base: Mapped[str] = mapped_column(String(100), default="")
    target: Mapped[str] = mapped_column(String(100), default="")
    due: Mapped[str] = mapped_column(String(100), default="")
    owner: Mapped[str] = mapped_column(OWNER, default="biz")
    partner: Mapped[str] = mapped_column(String(100), default="")
    theme_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    cap: Mapped[str | None] = mapped_column(CAP, nullable=True)
    fin_kind: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Link(Base):
    __tablename__ = "link"
    __table_args__ = (TABLE_ARGS | {"comment": "目標どうしのつながり（因果の仮説）"},)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("company.id"), index=True)
    bu_id: Mapped[str] = mapped_column(String(40))
    from_id: Mapped[str] = mapped_column(String(40), default="")
    to_id: Mapped[str] = mapped_column(String(40), default="")
    reason: Mapped[str] = mapped_column(Text, default="")
    cond: Mapped[str] = mapped_column(Text, default="")
    check_text: Mapped[str] = mapped_column(Text, default="")
    check_date: Mapped[str] = mapped_column(String(50), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Initiative(Base):
    __tablename__ = "initiative"
    __table_args__ = (TABLE_ARGS | {"comment": "施策"},)
    company_id: Mapped[int] = _company_fk()
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    owner: Mapped[str] = mapped_column(OWNER, default="biz")
    partner: Mapped[str] = mapped_column(String(100), default="")
    digital: Mapped[bool] = mapped_column(Boolean, default=False)
    ipa: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    ev: Mapped[str] = mapped_column(String(300), default="")
    chk_condition: Mapped[bool] = mapped_column(Boolean, default=False)
    chk_review: Mapped[bool] = mapped_column(Boolean, default=False)
    kpi: Mapped[str] = mapped_column(String(200), default="")
    base: Mapped[str] = mapped_column(String(100), default="")
    target: Mapped[str] = mapped_column(String(100), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class InitiativeObjective(Base):
    __tablename__ = "initiative_objective"
    __table_args__ = (TABLE_ARGS | {"comment": "施策が付く目標"},)
    company_id: Mapped[int] = _company_fk()
    initiative_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    objective_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


# ---------------------------------------------------------------- 進捗


class ObjectiveProgress(Base):
    __tablename__ = "objective_progress"
    __table_args__ = (TABLE_ARGS | {"comment": "目標の進捗（担当者の入力。上書き）"},)
    company_id: Mapped[int] = _company_fk()
    objective_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[str] = mapped_column(String(100), default="")
    at: Mapped[date | None] = mapped_column(Date, nullable=True)
    reason: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    memo: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(String(100), default="")
    updated_at: Mapped[datetime] = mapped_column(PRECISE)


class InitiativeProgress(Base):
    __tablename__ = "initiative_progress"
    __table_args__ = (TABLE_ARGS | {"comment": "施策の進捗（担当者の入力。上書き）"},)
    company_id: Mapped[int] = _company_fk()
    initiative_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    exec: Mapped[int] = mapped_column(SmallInteger, default=0)
    verify: Mapped[int] = mapped_column(SmallInteger, default=0)
    kpi_cur: Mapped[str | None] = mapped_column(String(100), nullable=True)
    did: Mapped[str] = mapped_column(Text, default="")
    result: Mapped[str] = mapped_column(Text, default="")
    author: Mapped[str] = mapped_column(String(100), default="")
    updated_at: Mapped[datetime] = mapped_column(PRECISE)


# ---------------------------------------------------------------- 確定版・その他


class ProgressConfirmation(Base):
    __tablename__ = "progress_confirmation"
    __table_args__ = (
        UniqueConstraint("company_id", "label", name="uq_confirmation_label"),
        TABLE_ARGS | {"comment": "進捗の確定版（他社と比べる画面に出る）"},
    )
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("company.id"), index=True)
    label: Mapped[str] = mapped_column(String(50))
    as_of: Mapped[date] = mapped_column(Date)
    body: Mapped[dict] = mapped_column(JSON)
    confirmed_by: Mapped[str] = mapped_column(String(100), default="")
    confirmed_at: Mapped[datetime] = mapped_column(PRECISE)
    # 初期データの確定版（出発点。消せない）
    is_seed: Mapped[bool] = mapped_column(Boolean, default=False)


class StrategyVersion(Base):
    __tablename__ = "strategy_version"
    __table_args__ = (TABLE_ARGS | {"comment": "申請の版"},)
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("company.id"), index=True)
    saved_at: Mapped[datetime] = mapped_column(DateTime)
    body: Mapped[dict] = mapped_column(JSON)


class ChangeNote(Base):
    __tablename__ = "change_note"
    __table_args__ = (TABLE_ARGS | {"comment": "初期データの「変わったこと」"},)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, ForeignKey("company.id"), index=True)
    confirmation_id: Mapped[int | None] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), nullable=True)
    text: Mapped[str] = mapped_column(String(500))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ReferenceData(Base):
    __tablename__ = "reference_data"
    __table_args__ = (TABLE_ARGS | {"comment": "他社の点・参加企業の集計の初期データ"},)
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    body: Mapped[dict] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(DateTime)


# ---------------------------------------------------------------- 抽象化（オープンなDBの代わり）


class OpenBusinessSnapshot(Base):
    """各社の最新の確定版から、事業ごとに段階・進み・件数だけを抜き出したもの。

    本番は「会社ごとのセキュアなDB → 夜間バッチ → オープンなDB」の想定。
    MVPは1つのDBの中のこのテーブルを、オープンなDBの代わりにする。
    他社と比べる画面・参加企業の集計画面は、このテーブルだけから集計する。
    戦略の中身（目標の文章・施策名・つながりの理由など）は持たない。
    他社のダミーもここに入るため、company テーブルへの外部キーは張らない。
    """

    __tablename__ = "open_business_snapshot"
    __table_args__ = (
        UniqueConstraint("company_id", "bu_id", name="uq_open_company_bu"),
        TABLE_ARGS | {"comment": "抽象化した事業ごとの現在地（オープンなDBの代わり。1行＝1社の1事業）"},
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(Integer, index=True)
    company_name: Mapped[str] = mapped_column(String(100))
    company_industry: Mapped[str] = mapped_column(String(100), default="")
    bu_id: Mapped[str] = mapped_column(String(40))
    bu_name: Mapped[str] = mapped_column(String(100), default="")
    bu_industry: Mapped[str] = mapped_column(String(100), default="")
    # どの確定版から抜いたか
    as_of_label: Mapped[str] = mapped_column(String(50), default="")
    as_of: Mapped[date | None] = mapped_column(Date, nullable=True)
    confirmed_at: Mapped[datetime] = mapped_column(DateTime)
    # 段階：道筋にある試行・実行中のデジタル施策のうち一番上（0＝なし、1〜3）
    stage: Mapped[int] = mapped_column(SmallInteger, default=0)
    # 道筋の進み：施策から順に指標が動いた一番先の視点（0＝まだ、1＝学習と成長〜4＝財務）
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    # 財務以外の目標の数と、そのうち財務の目標までつながっている数
    obj_total: Mapped[int] = mapped_column(Integer, default=0)
    obj_reach_fin: Mapped[int] = mapped_column(Integer, default=0)
    # 指標を置いた目標の数（視点別）
    kpi_lg: Mapped[int] = mapped_column(Integer, default=0)
    kpi_pr: Mapped[int] = mapped_column(Integer, default=0)
    kpi_cu: Mapped[int] = mapped_column(Integer, default=0)
    kpi_fi: Mapped[int] = mapped_column(Integer, default=0)
    # この事業の目標に付いた施策の数と、実行条件あり・検証日あり・検証済み（効果あり・なし）の数
    init_total: Mapped[int] = mapped_column(Integer, default=0)
    init_condition: Mapped[int] = mapped_column(Integer, default=0)
    init_review: Mapped[int] = mapped_column(Integer, default=0)
    init_verified: Mapped[int] = mapped_column(Integer, default=0)
    # 抜き出した日時（本番は夜間バッチの実行日時）
    extracted_at: Mapped[datetime] = mapped_column(DateTime)
