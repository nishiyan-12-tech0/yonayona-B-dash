/**
 * データ取得の窓口。画面はここだけを呼びます。
 *
 * バックエンド（FastAPI）の URL はビルドのときの環境変数 NEXT_PUBLIC_API_BASE_URL で決まります
 * （静的エクスポートなので、ビルドした時点の値が埋め込まれます）。
 * API の一覧は docs/design/ミチスジ_システム設計書 6章。
 */
import type {
  Confirmation,
  ConfirmedVersion,
  InitiativeProgressInput,
  MetiData,
  ObjectiveProgressInput,
  PeerData,
  StrategyData,
} from "./types";

const BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
).replace(/\/$/, "");

/** API が失敗したとき。message は画面にそのまま出せる日本語 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "サーバーにつながりませんでした。少し待ってからもう一度お試しください。",
      0,
    );
  }
  if (!res.ok) {
    let detail = `エラーが起きました（${res.status}）`;
    try {
      const j = await res.json();
      if (typeof j?.detail === "string") detail = j.detail;
    } catch {
      // 本文が JSON でないときは、上の文のまま
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

/* ----- 申請・戦略マップ ----- */

/** 戦略と保存中の進捗。比べる時点は直近の確定版（A-2） */
export const fetchStrategy = () => call<StrategyData>("GET", "/api/strategy");

/** 申請の内容で戦略を上書き。担当者の進捗は変わらない（A-3） */
export const saveStrategy = (data: StrategyData) =>
  call<StrategyData>("PUT", "/api/strategy", data);

/** 今の申請内容を版として残す（A-4） */
export const saveVersion = () =>
  call<{ id: number; savedAt: string }>("POST", "/api/strategy/versions");

/** 目標の進捗を上書き（A-5） */
export const saveObjectiveProgress = (
  id: string,
  input: ObjectiveProgressInput,
) =>
  call<StrategyData>(
    "PUT",
    `/api/objectives/${encodeURIComponent(id)}/progress`,
    input,
  );

/** 施策の進捗を上書き（A-6） */
export const saveInitiativeProgress = (
  id: string,
  input: InitiativeProgressInput,
) =>
  call<StrategyData>(
    "PUT",
    `/api/initiatives/${encodeURIComponent(id)}/progress`,
    input,
  );

/* ----- 確定 ----- */

/** 確定版の一覧（A-7） */
export const fetchConfirmations = () =>
  call<Confirmation[]>("GET", "/api/confirmations");

/** 今の進捗を確定版にする。同じ期間があれば上書き（A-8） */
export const confirmProgress = (input: {
  label: string;
  asOf: string;
  confirmedBy: string;
}) => call<StrategyData>("POST", "/api/confirmations", input);

/** 確定版を消す（A-12） */
export const deleteConfirmation = (id: number) =>
  call<StrategyData>("DELETE", `/api/confirmations/${id}`);

/** デモを初期状態に戻す（A-13） */
export const resetDemo = () => call<StrategyData>("POST", "/api/demo/reset");

/** 他社と比べる画面の確定版（新しい順に最大6つ。A-9） */
export async function fetchConfirmedVersions(): Promise<ConfirmedVersion[]> {
  const r = await call<{ versions: ConfirmedVersion[] }>(
    "GET",
    "/api/strategy/confirmed",
  );
  return r.versions;
}

/* ----- 他社・集計（初期データ） ----- */

/** 他社の事業（匿名）と平均（A-10） */
export const fetchPeers = () => call<PeerData>("GET", "/api/peers");

/** 参加企業の集計（A-11） */
export const fetchMetiSummary = () =>
  call<MetiData>("GET", "/api/meti/summary");
