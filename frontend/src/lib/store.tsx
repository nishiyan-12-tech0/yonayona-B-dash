"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  fetchApplications,
  fetchDraft,
  fetchStrategy,
  saveDraft,
} from "./api";
import type { ApplicationMeta, Snap, StrategyData } from "./types";

/** 画面の表示状態（どの事業・テーマを開いているか、など）。画面を行き来しても保ちます。 */
export interface UiState {
  /** 戦略マップ：表示する時点（いつも現在。過去は左のサイドメニューから見る） */
  snap: Snap;
  /** 戦略マップ：担当で強調 */
  who: "all" | "biz" | "dx";
  /** 戦略マップ：DXの段階で強調（0＝なし） */
  stg: number;
  /** 戦略マップ：テーマごと／全体マップ */
  view: "theme" | "all";
  /** 戦略マップ：開いている事業 */
  cb: string | null;
  /** 戦略マップ：開いている戦略テーマ */
  ct: string | null;
  /** 戦略マップ：表示オプションを開いているか */
  opt: boolean;
  /** 戦略マップ：施策にIPAの取組項目の番号を表示 */
  ipa: boolean;
  /** 戦略マップ：選択中のもの（"o:目標ID" "i:施策ID" "b:事業ID"） */
  sel: string | null;
  /** 戦略マップ（全体マップ）：閉じている事業 */
  collapsed: Record<string, boolean>;
  /** 他社と比べる：比べる相手 */
  peer: "same" | "all";
  /** 申請：開いているステップ */
  step: number;
  /** 申請：入力中の事業 */
  ebu: string | null;
}

const initialUi: UiState = {
  snap: "now",
  who: "all",
  stg: 0,
  view: "theme",
  cb: null,
  ct: null,
  opt: false,
  ipa: false,
  sel: null,
  collapsed: {},
  peer: "same",
  step: 0,
  ebu: null,
};

/** 作成中の申請の保存の状態 */
export type SaveState = "idle" | "saving" | "saved" | "error";

/** 入力が止まってから保存するまでの時間（ミリ秒） */
const SAVE_DELAY = 800;

interface Store {
  /** 現在の申請の戦略と日々の進捗（申請がなければ application が null、事業は空） */
  data: StrategyData;
  /** サーバーから届いた現在の戦略で置き換える（保存はしない） */
  replace: (data: StrategyData) => void;
  /** 申請と版の一覧（新しい順。サイドメニューに使う） */
  apps: ApplicationMeta[];
  /** 現在の戦略・申請と版の一覧・作成中の申請を読み直す */
  refresh: () => Promise<void>;

  /** 作成中の申請（なければ null） */
  draft: StrategyData | null;
  /** 作成中の申請を書き換えて保存する（入力が止まってから送る）。draft を直接変更してよい */
  updateDraft: (mutate: (draft: StrategyData) => void) => void;
  /** 作成中の申請を、サーバーから届いた内容で置き換える（保存はしない。null で消す） */
  setDraft: (d: StrategyData | null) => void;
  /** 書きかけがあれば、すぐに保存して終わるのを待つ。失敗したら例外 */
  flush: () => Promise<void>;
  saveState: SaveState;
  saveError: string | null;

  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StrategyData | null>(null);
  const [apps, setApps] = useState<ApplicationMeta[]>([]);
  const [draft, setDraftState] = useState<StrategyData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ui, setUiState] = useState<UiState>(initialUi);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  /** 最新の作成中の申請（保存するときに読む） */
  const latest = useRef<StrategyData | null>(null);
  /** 保存待ちのタイマー */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 送っている途中の保存（順番に送る） */
  const chain = useRef<Promise<void>>(Promise.resolve());
  /** 最後の保存が失敗したか */
  const failed = useRef<ApiError | null>(null);

  /** 読み込んだものを入れる */
  const apply = useCallback(
    (d: StrategyData, a: ApplicationMeta[], dr: StrategyData | null) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      latest.current = dr;
      setDraftState(dr);
      setApps(a);
      setData(d);
      setSaveState("idle");
    },
    [],
  );

  const refresh = useCallback(async () => {
    const [d, a, dr] = await Promise.all([
      fetchStrategy(),
      fetchApplications(),
      fetchDraft(),
    ]);
    apply(d, a, dr?.body ?? null);
  }, [apply]);

  const load = useCallback(() => {
    Promise.all([fetchStrategy(), fetchApplications(), fetchDraft()])
      .then(([d, a, dr]) => apply(d, a, dr?.body ?? null))
      .catch((e: unknown) =>
        setLoadError(
          e instanceof ApiError ? e.message : "データを読み込めませんでした",
        ),
      );
  }, [apply]);

  useEffect(load, [load]);
  const retry = () => {
    setLoadError(null);
    load();
  };

  const send = useCallback(() => {
    timer.current = null;
    const snapshot = latest.current;
    if (!snapshot) return chain.current;
    setSaveState("saving");
    chain.current = chain.current
      .then(() => saveDraft(snapshot))
      .then(() => {
        failed.current = null;
        // 送ったあとに入力が続いていなければ「保存しました」
        if (!timer.current) setSaveState("saved");
        setSaveError(null);
      })
      .catch((e: unknown) => {
        const err =
          e instanceof ApiError ? e : new ApiError("保存できませんでした", 0);
        failed.current = err;
        setSaveState("error");
        setSaveError(err.message);
      });
    return chain.current;
  }, []);

  const updateDraft = useCallback(
    (mutate: (draft: StrategyData) => void) => {
      const cur = latest.current;
      if (!cur) return;
      const next = structuredClone(cur);
      mutate(next);
      latest.current = next;
      setDraftState(next);
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(send, SAVE_DELAY);
    },
    [send],
  );

  const setDraft = useCallback((d: StrategyData | null) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    latest.current = d;
    setDraftState(d);
    setSaveState("idle");
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      await send();
    } else {
      await chain.current;
    }
    if (failed.current) throw failed.current;
  }, [send]);

  const replace = useCallback((d: StrategyData) => setData(d), []);

  const setUi = useCallback(
    (patch: Partial<UiState>) => setUiState((cur) => ({ ...cur, ...patch })),
    [],
  );

  const store = useMemo(
    () =>
      data
        ? {
            data,
            replace,
            apps,
            refresh,
            draft,
            updateDraft,
            setDraft,
            flush,
            saveState,
            saveError,
            ui,
            setUi,
          }
        : null,
    [
      data,
      replace,
      apps,
      refresh,
      draft,
      updateDraft,
      setDraft,
      flush,
      saveState,
      saveError,
      ui,
      setUi,
    ],
  );

  if (loadError) {
    return (
      <div className="card" style={{ margin: 24 }} role="alert">
        <b>データを読み込めませんでした</b>
        <p className="small muted">{loadError}</p>
        <button className="btn" onClick={retry}>
          再読み込み
        </button>
      </div>
    );
  }
  // データが届くまでは中身を出さない
  // （ref は保存の待ち合わせにだけ使い、描画には使っていない。lint の誤検知のため止める）
  // eslint-disable-next-line react-hooks/refs
  if (!store) return null;
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore は StoreProvider の中で使ってください");
  return s;
}
