/**
 * データ取得の窓口。画面はここだけを呼びます。
 *
 * バックエンド（FastAPI）の URL はビルドのときの環境変数 NEXT_PUBLIC_API_BASE_URL で決まります
 * （静的エクスポートなので、ビルドした時点の値が埋め込まれます）。
 * API の一覧は docs/design/ミチスジ_システム設計書_v0.4 の 6章。
 */
import type {
  ApplicationMeta,
  Draft,
  InitiativeProgressInput,
  MapVersion,
  MapVersionMeta,
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

/* ----- 戦略マップ（現在の申請） ----- */

/** 現在の申請の戦略と日々の進捗（A-2） */
export const fetchStrategy = () => call<StrategyData>("GET", "/api/strategy");

/** 目標の進捗を上書き（A-10） */
export const saveObjectiveProgress = (
  id: string,
  input: ObjectiveProgressInput,
) =>
  call<StrategyData>(
    "PUT",
    `/api/objectives/${encodeURIComponent(id)}/progress`,
    input,
  );

/** 施策の進捗を上書き。未着手なら実行中になる（A-11） */
export const saveInitiativeProgress = (
  id: string,
  input: InitiativeProgressInput,
) =>
  call<StrategyData>(
    "PUT",
    `/api/initiatives/${encodeURIComponent(id)}/progress`,
    input,
  );

/* ----- 申請 ----- */

/** 申請の一覧と、申請ごとの版の一覧（A-3） */
export const fetchApplications = () =>
  call<ApplicationMeta[]>("GET", "/api/applications");

/** その申請の内容（A-4） */
export const fetchApplication = (id: number) =>
  call<ApplicationMeta & { body: StrategyData }>(
    "GET",
    `/api/applications/${id}`,
  );

/** 作成中の申請から、新しい申請と戦略マップを作る（A-5） */
export const createApplication = () =>
  call<StrategyData>("POST", "/api/applications");

/** 作成中の申請（なければ null。A-6） */
export const fetchDraft = () => call<Draft | null>("GET", "/api/draft");

/** 作成中の申請を上書き（A-7） */
export const saveDraft = (body: StrategyData) =>
  call<{ savedAt: string }>("PUT", "/api/draft", body);

/** 作り直しを始める。carryOver＝前回の申請内容を引き継ぐか（A-8） */
export const startDraft = (carryOver: boolean) =>
  call<Draft>("POST", "/api/draft", { carryOver });

/** 作り直しをやめる（A-9） */
export const discardDraft = () => call<unknown>("DELETE", "/api/draft");

/* ----- 版 ----- */

/** その申請の版（戦略マップつき。新しい順に最大6つ。A-12） */
export async function fetchVersions(appId: number): Promise<MapVersion[]> {
  const r = await call<{ versions: MapVersion[] }>(
    "GET",
    `/api/applications/${appId}/versions`,
  );
  return r.versions;
}

/** 現在の申請に版を作る。同じ時点があれば上書き（A-13） */
export const createVersion = (input: {
  label: string;
  asOf: string;
  createdBy: string;
}) => call<MapVersionMeta>("POST", "/api/versions", input);

/** その版の戦略マップ（A-14） */
export const fetchVersion = (id: number) =>
  call<MapVersion & { applicationId: number }>("GET", `/api/versions/${id}`);

/** 版を消す（A-15） */
export const deleteVersion = (id: number) =>
  call<unknown>("DELETE", `/api/versions/${id}`);

/* ----- 他社・集計（抽象化テーブル） ----- */

/** 他社の事業（匿名）と平均。版を指定したら、その版を作ったときの断面から（A-16） */
export const fetchPeers = (versionId?: number) =>
  call<PeerData>(
    "GET",
    versionId ? `/api/peers?version=${versionId}` : "/api/peers",
  );

/** 参加企業の集計。版を指定したら、その版を作ったときの断面から（A-17） */
export const fetchMetiSummary = (versionId?: number) =>
  call<MetiData>(
    "GET",
    versionId
      ? `/api/meti/summary?version=${versionId}`
      : "/api/meti/summary",
  );

/** デモを初期状態に戻す（A-19） */
export const resetDemo = () => call<Draft | null>("POST", "/api/demo/reset");
