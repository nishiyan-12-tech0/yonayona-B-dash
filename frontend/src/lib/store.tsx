"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchStrategy, saveStrategy } from "./api";
import type { Snap, StrategyData } from "./types";

/** 画面の表示状態（どの事業・テーマを開いているか、など）。画面を行き来しても保ちます。 */
export interface UiState {
  /** 戦略マップ：表示する時点 */
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

interface Store {
  data: StrategyData;
  /** 申請内容を書き換えて保存する。draft を直接変更してよい */
  update: (mutate: (draft: StrategyData) => void) => void;
  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StrategyData | null>(null);
  const [ui, setUiState] = useState<UiState>(initialUi);
  /** 最初に読み込んだ内容。これと違うときだけ保存する */
  const [loaded, setLoaded] = useState<StrategyData | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStrategy().then((d) => {
      if (!alive) return;
      setLoaded(d);
      setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback((mutate: (draft: StrategyData) => void) => {
    setData((cur) => {
      if (!cur) return cur;
      const draft = structuredClone(cur);
      mutate(draft);
      return draft;
    });
  }, []);

  // 入力で変わったときだけ保存する（最初の読み込みでは保存しない）
  useEffect(() => {
    if (data && data !== loaded) void saveStrategy(data);
  }, [data, loaded]);

  const setUi = useCallback(
    (patch: Partial<UiState>) => setUiState((cur) => ({ ...cur, ...patch })),
    [],
  );

  const store = useMemo(
    () => (data ? { data, update, ui, setUi } : null),
    [data, update, ui, setUi],
  );

  // データが届くまでは中身を出さない
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
