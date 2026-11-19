# ミチスジ バックエンド

FastAPI ＋ MySQL。設計は `docs/design/ミチスジ_システム設計書_v0.3_20261119.md`。

## 手元で動かす

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # DB の接続情報を入れる（Azure の MySQL なら手元のIPをファイアウォールで許可しておく）
uvicorn app.main:app --reload
```

- http://localhost:8000/docs で API を試せます
- 起動したとき、テーブルがなければ作り、会社のデータがなければ初期データ（`app/seed_data.json`）を入れます
- DB を用意せずに試すだけなら、`.env` に `DATABASE_URL=sqlite:///./local.db` と書けば SQLite で動きます

## 初期データに戻す

```bash
python -m app.seed --reset
```

画面の「進捗を確定」→「デモを初期状態に戻す」も同じ処理です（`POST /api/demo/reset`）。

## Azure（App Service Web App）

- 起動コマンド：`gunicorn -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 app.main:app`
- アプリ設定：`DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `CORS_ORIGINS` `COMPANY_ID` `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- デプロイ：`main` に `backend/` の変更を push すると `.github/workflows/backend.yml` が動きます

## ファイル

| ファイル | 中身 |
|---|---|
| `app/main.py` | 起動、CORS、エラーの返し方 |
| `app/routers/api.py` | API（設計書 6章の A-1〜A-13） |
| `app/strategy.py` | 画面の形（StrategyData）の組み立て、申請・進捗・確定の保存 |
| `app/models.py` | テーブル（設計書 8章） |
| `app/schemas.py` | API の入力の形 |
| `app/seed.py` / `app/seed_data.json` | 初期データ |
| `sql/schema.sql` | テーブルを作る SQL（参考。起動時に自動で作られます） |
