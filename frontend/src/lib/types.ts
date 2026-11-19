/** BSCの4視点：学習と成長／業務プロセス／顧客／財務 */
export type Persp = "lg" | "pr" | "cu" | "fi";
/** 主担当：事業部／DX推進部／経営 */
export type Owner = "biz" | "dx" | "mgmt";
/** 学習と成長の資本の種類：人的／情報／組織 */
export type Cap = "hum" | "inf" | "org";
/** 表示する時点。画面はいつも "now"（過去は左のサイドメニューから版を選んで見る）。"mar" は旧版の名残り */
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
  /** 今（申請時点）の値。進みの起点 */
  base?: string;
  /** 旧版の名残り（使わない） */
  prev?: string;
  /** 今の値（担当者が戦略マップで入力。入力するまでは今（申請時点）と同じ） */
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
  /** EXEC の番号（0＝未着手、1＝実行中）。申請では「申請時点の状態」 */
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
  /** 今（申請時点）の値 */
  base?: string;
  cur?: string;
  target?: string;
  /** 旧版の名残り（使わない） */
  prev?: InitState;
  progress?: InitiativeProgress;
}

/** 1社ぶんの申請内容。戦略マップ・他社比較はここから計算して描きます。 */
export interface StrategyData {
  company: { name: string; industry: string };
  corp: { fin: Objective };
  bus: BusinessUnit[];
  inits: Initiative[];
  /** どの申請の戦略か（申請の内容・作成中の申請では null か、ない） */
  application?: { id: number; submittedAt: string } | null;
}

/** 版（戦略マップと進捗の断面）。申請の中で第1版・第2版…と数える */
export interface MapVersionMeta {
  id: number;
  no: number;
  /** 時点（例：2026年12月末、作成時点、置き換え時点） */
  label: string;
  asOf: string;
  /** start＝作成時点、manual＝手で作った、end＝置き換え時点 */
  kind: "start" | "manual" | "end";
  createdBy: string;
  createdAt: string;
}

/** 申請（日付で呼ぶ） */
export interface ApplicationMeta {
  id: number;
  submittedAt: string;
  replacedAt: string | null;
  current: boolean;
  /** 新しい順 */
  versions: MapVersionMeta[];
}

/** 版と、その時点の戦略マップ */
export interface MapVersion extends MapVersionMeta {
  data: StrategyData;
}

/** 作成中の申請 */
export interface Draft {
  body: StrategyData;
  savedAt: string;
  carryFrom: number | null;
}

export interface ObjectiveProgressInput {
  value: string;
  at: string;
  reason: number | null;
  memo: string;
  author: string;
}

export interface InitiativeProgressInput {
  verify: number;
  /** 実行の準備：実行条件の確保 */
  condition: boolean;
  /** 実行の準備：検証と次の判断日の決定 */
  review: boolean;
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

/** 参加企業の集計：道筋をどこまで進んだか（k 以上の事業数。byStage は DXの段階 0〜3 の内訳） */
export interface MetiFlow {
  k: number;
  n: number;
  byStage: number[];
}

export interface MetiData {
  flow?: MetiFlow[];
  stats: { value: string; label: string }[];
  cells: StageCells;
  industries: { name: string; reached: number }[];
  perspRows: { name: string; persp: PerspShare }[];
  /** 企業一覧（最終更新の新しい順）。updatedAt は最新の確定日 */
  companies: {
    name: string;
    industry: string;
    buCount: number;
    best: string;
    updatedAt: string;
    own: boolean;
  }[];
  /** 抽象化テーブルを最後に作り直した日時 */
  extractedAt: string;
}
