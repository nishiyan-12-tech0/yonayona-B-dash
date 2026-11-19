# ミチスジ フロントエンド

DX戦略マップ「ミチスジ」の画面です。Next.js（App Router）＋ TypeScript。
見た目と動きは `docs/mock/ミチスジ_モック_v7_20261116.html` に合わせています。

## 動かし方

```bash
npm install
npm run dev
```

http://localhost:3000 を開きます（戦略マップが出ます）。

## 画面

| URL        | 画面           |
| ---------- | -------------- |
| `/entry`   | ① 申請         |
| `/map`     | ② 戦略マップ   |
| `/compare` | ③ 他社と比べる |
| `/meti`    | ④ 経産省の画面 |

## フォルダ

```
src/
├─ app/         共通の枠（layout.tsx）、スタイル（globals.css）、4画面のページ
├─ components/  複数の画面で使う部品（ロゴ、マス目、表など）
├─ features/    画面ごとの部品（entry / map / compare / meti）
├─ lib/
│  ├─ types.ts      データの型
│  ├─ constants.ts  ラベルや分類
│  ├─ logic.ts      計算（指標の動き、道筋の進み、DXの段階）
│  ├─ api.ts        データ取得の窓口（バックエンドの API）
│  └─ store.tsx     申請内容と表示状態の置き場、申請の保存
```

## データについて（バックエンドとのつなぎ）

- 画面は `src/lib/api.ts` だけを呼びます。中身はバックエンド（`backend/`、FastAPI）の API 呼び出しです。
- バックエンドの URL は、ビルドのときの環境変数 `NEXT_PUBLIC_API_BASE_URL` で決まります（なければ `http://localhost:8000`）。
  手元では `.env.local` に、Azure では `.github/workflows/azure-static-web-apps-*.yml` に書きます。
- 申請の入力は、入力が止まってから0.8秒後にまとめて保存します（`src/lib/store.tsx`）。
- 担当者の進捗（戦略マップの「進捗を入力」）と「進捗を確定」は、`src/features/map/*Modal.tsx`。
- 戦略マップ・他社比較に出る値（道筋の進み、DXの段階など）は保存せず、届いたデータから `logic.ts` で計算しています。
- 他社と比べる画面は、確定版（`GET /api/strategy/confirmed`）だけで描きます。
