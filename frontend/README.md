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
│  ├─ api.ts        データ取得の窓口
│  └─ store.tsx     申請内容と表示状態の置き場
└─ mocks/       ダミーデータ
```

## データについて（バックエンドをつなぐとき）

- 画面は `src/lib/api.ts` だけを呼びます。今はここが `src/mocks/seed.ts` のダミーデータを返しています。
- 申請で入力した内容は、ブラウザの localStorage（キー `michisuji.strategy.v1`）に保存しています。
  ダミーデータに戻すときは、ブラウザの開発者ツールでこのキーを消してください。
- バックエンドができたら、`api.ts` の4つの関数の中身を API 呼び出しに差し替え、`src/mocks` を消します。
  画面側は変えません。`seed.ts` の内容は DB の初期データに使えます。
- 戦略マップ・他社比較に出る値（道筋の進み、DXの段階など）は保存せず、申請内容から `logic.ts` で計算しています。
