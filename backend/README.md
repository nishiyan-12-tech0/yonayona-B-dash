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
- 起動したとき、スキーマの版が古ければテーブルを全部作り直し、会社のデータがなければ初期データ（`app/seed_data.json`）を入れます
- 初期状態は、全項目入力済みの申請から約1年前に申請して戦略マップを作り、四半期末ごとに進捗を入れて版を作ってきた状態です（`app/demo_story.py`）。新しく申請を作り直すところから見せるときは、申請画面の「新しい戦略マップを作る」から始めます
- DB を用意せずに試すだけなら、`.env` に `DATABASE_URL=sqlite:///./local.db` と書けば SQLite で動きます

## 初期データに戻す

```bash
python -m app.seed --reset
```

画面の右上のロゴを押して「デモを初期状態に戻す」も同じ処理です（`POST /api/demo/reset`）。

## Azure（App Service Web App）

- 起動コマンド：`gunicorn -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --chdir backend app.main:app`
- アプリ設定：`DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `CORS_ORIGINS` `COMPANY_ID` `SCM_DO_BUILD_DURING_DEPLOYMENT=true`
- デプロイ：Web App の「デプロイ センター」で GitHub のこのリポジトリ（main）につないであり、push すると自動でデプロイされます。
  デプロイ センターはリポジトリの一番上でビルドするので、一番上の `requirements.txt` から `backend/requirements.txt` を読み込み、起動コマンドの `--chdir backend` で backend/ に移ってから動かします

## ファイル

| ファイル | 中身 |
|---|---|
| `app/main.py` | 起動、CORS、エラーの返し方 |
| `app/routers/api.py` | API（設計書 v0.4 の 6章の A-1〜A-19） |
| `app/strategy.py` | 画面の形（StrategyData）の組み立て、作成中の申請・申請の作成・日々の進捗・版の保存 |
| `app/open_data.py` | 抽象化テーブルへの抜き出しと、他社比較・参加企業の集計 |
| `app/models.py` | テーブル（設計書 8章） |
| `app/schemas.py` | API の入力の形 |
| `app/seed.py` / `app/seed_data.json` | 初期データ |
| `sql/schema.sql` | テーブルを作る SQL（参考。起動時に自動で作られます） |
