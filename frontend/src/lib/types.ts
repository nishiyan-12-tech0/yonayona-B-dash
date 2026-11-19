/** BSCの4視点：学習と成長／業務プロセス／顧客／財務 */
export type Persp = "lg" | "pr" | "cu" | "fi";
/** 主担当：事業部／DX推進部／経営 */
export type Owner = "biz" | "dx" | "mgmt";
/** 学習と成長の資本の種類：人的／情報／組織 */
export type Cap = "hum" | "inf" | "org";
/** 表示する時点：現在／比べる時点（直近の確定版）。"mar" は 2026年3月末だったころの名残り */
export type Snap = "now" | "mar";
/** DXの段階：1＝デジタイゼーション、2＝デジタライゼーション、3＝DX */
export type Stage = 1 | 2 | 3;

/** 目標（戦略マップの箱）。指標の値は「月42件」のように単位つきの文字で持ちます。 */
export interface Objective {
  id: string;
  persp: Persp;
  name: string;
  /** 指標名。空なら「指標が未設定」 */
  kpi: string;
  base?: string;
  /** 比べる時点（直近の確定版）の値 */
  prev?: string;
  /** 今の値（担当者が戦略マップで入力） */
  cur?: string;
  target?: string;
  due?: string;
  owner: Owner;
  partner?: string;
  /** 属する戦略テーマのID（財務の目標は持たない） */
  theme?: string;
  /** 学習と成長の目標だけ */
  cap?: Cap;
  /** 財務の目標だけ。FINKIND の番号（0＝収益増大、1＝生産性向上） */
  kind?: number;
  /** 担当者の入力（最後に保存した内容）。まだ入力がなければない */
  progress?: ObjectiveProgress;
}

/** 目標の進捗（担当者が戦略マップで入力。上書き） */
export interface ObjectiveProgress {
  /** 測った日（YYYY-MM-DD） */
  at: string;
  /** 動かなかった・下がった理由。REASON の番号 */
  reason: number | null;
  memo: string;
  author: string;
  updatedAt: string;
}

/** 施策の進捗のうち、実行の状態・検証・今の値以外（担当者が戦略マップで入力。上書き） */
export interface InitiativeProgress {
  /** 今の期間にやったこと */
  did: string;
  /** 結果・わかったこと */
  result: string;
  author: string;
  updatedAt: string;
}

/** 目標どうしのつながり（因果の仮説）。戦略マップの矢印になります。 */
export interface Link {
  from: string;
  to: string;
  reason: string;
  cond: string;
  check: string;
  date: string;
}

export interface Theme {
  id: string;
  name: string;
  /** 取り組む期間の目安。HZ の番号 */
  hz: number;
}

export interface BusinessUnit {
  id: string;
  name: string;
  industry: string;
  /** 全社売上に占める割合（%） */
  share: number;
  owner: string;
  /** 顧客価値提案の類型。CVP の番号 */
  cvp: number;
  customer: string;
  future: string;
  gap: string;
  /** 財務の差のうち、収益増大で埋める割合（%）。残りが生産性向上 */
  growth: number;
  confBy: string;
  confAt: string;
  themes: Theme[];
  objs: Objective[];
  links: Link[];
}

/** 施策の実行の準備 */
export interface Checks {
  /** 実行条件（予算・工数・権限・データの提供者）の確保 */
  condition: boolean;
  /** 検証と次の判断日の決定 */
  review: boolean;
}

/** 施策の状態（時点ごとに変わる部分） */
export interface InitState {
  /** EXEC の番号 */
  exec: number;
  /** VERIFY の番号 */
  verify: number;
  checks: Checks;
}

/** 施策。目標に付けます（attach が空なら、どの目標にも付いていない）。 */
export interface Initiative extends InitState {
  id: string;
  name: string;
  attach: string[];
  owner: Owner;
  partner: string;
  digital: boolean;
  /** IPAの取組項目（1〜7）。デジタル以外の施策は null */
  ipa: number | null;
  /** 決めた場（会議体・日付・資料） */
  ev: string;
  kpi: string;
  base?: string;
  cur?: string;
  target?: string;
  /** 比べる時点（直近の確定版）の状態 */
  prev?: InitState;
  progress?: InitiativeProgress;
}

/** 1社ぶんの申請内容。戦略マップ・他社比較はここから計算して描きます。 */
export interface StrategyData {
  company: { name: string; industry: string };
  corp: { fin: Objective };
  bus: BusinessUnit[];
  inits: Initiative[];
  /** 比べる時点から変わったこと */
  diffs: string[];
  /** 時点の名前。now＝現在（または確定版の期間）、prev＝比べる時点（直近の確定版の期間） */
  snap?: { now: string; prev: string | null };
}

/** 確定版の一覧の1行 */
export interface Confirmation {
  id: number;
  label: string;
  asOf: string;
  confirmedBy: string;
  confirmedAt: string;
  /** 初期データの確定版（出発点。消せない） */
  isSeed: boolean;
}

/** 他社と比べる画面に出す確定版（新しい順） */
export interface ConfirmedVersion {
  id: number;
  label: string;
  asOf: string;
  data: StrategyData;
}

export interface ObjectiveProgressInput {
  value: string;
  at: string;
  reason: number | null;
  memo: string;
  author: string;
}

export interface InitiativeProgressInput {
  exec: number;
  verify: number;
  kpiCur: string;
  did: string;
  result: string;
  author: string;
}

export type PerspShare = Record<Persp, number>;

/** 他社の事業（匿名） */
export interface PeerPoint {
  ind: string;
  st: Stage;
  /** 道筋の進み（0〜4） */
  p: number;
}

export interface PeerData {
  points: PeerPoint[];
  /** 比べる相手の平均（%） */
  avg: {
    reach: number;
    condition: number;
    review: number;
    verified: number;
    persp: PerspShare;
  };
}

/** 段階(1〜3)ごとに、道筋の進み(0〜4)の割合(%)を並べたもの */
export type StageCells = Record<Stage, number[]>;

export interface MetiData {
  stats: { value: string; label: string }[];
  cells: StageCells;
  industries: { name: string; reached: number }[];
  perspRows: { name: string; persp: PerspShare }[];
  /** 自社の最終更新日 */
  ownUpdatedAt: string;
  otherCompanies: {
    name: string;
    industry: string;
    buCount: number;
    best: string;
    updatedAt: string;
  }[];
}
