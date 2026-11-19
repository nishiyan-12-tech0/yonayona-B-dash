"""ミチスジ バックエンド（FastAPI）。

起動（手元）：  uvicorn app.main:app --reload
起動（Azure）： gunicorn -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 app.main:app
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from .config import get_settings
from .routers.api import router
from .seed import ensure_seeded

log = logging.getLogger("michisuji")


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    if s.auto_seed:
        try:
            if ensure_seeded(s.company_id):
                log.warning("初期データを入れました")
        except Exception:  # DBにつながらなくても起動はさせる（/api/health で分かる）
            log.exception("起動時の初期データの投入に失敗しました")
    yield


app = FastAPI(title="ミチスジ API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_list,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(x) for x in first.get("loc", []) if x != "body")
    return JSONResponse(
        status_code=422,
        content={"detail": f"入力の形が正しくありません（{where}：{first.get('msg', '')}）"},
    )


@app.exception_handler(SQLAlchemyError)
async def db_error(_: Request, exc: SQLAlchemyError):
    log.exception("DBのエラー", exc_info=exc)
    return JSONResponse(status_code=500, content={"detail": "データベースでエラーが起きました"})


app.include_router(router)


@app.get("/")
def root():
    return {"name": "ミチスジ API", "docs": "/docs"}
