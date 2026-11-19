"""MySQL への接続。"""

from collections.abc import Iterator
from urllib.parse import quote_plus

import certifi
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings


def _make_engine():
    s = get_settings()
    if s.database_url:
        return create_engine(s.database_url, pool_pre_ping=True)
    url = (
        f"mysql+pymysql://{quote_plus(s.db_user)}:{quote_plus(s.db_password)}"
        f"@{s.db_host}:{s.db_port}/{s.db_name}?charset=utf8mb4"
    )
    connect_args = {"ssl": {"ca": certifi.where()}} if s.db_ssl else {}
    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,
        # Azure は一定時間使わない接続を切るので、先に作り直す
        pool_recycle=280,
    )


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """API 1回ぶんのDBセッション。正常に終わったら commit、例外なら rollback。"""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
