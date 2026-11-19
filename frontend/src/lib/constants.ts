import type { Cap, Owner, Persp, Stage } from "./types";

export const PERSPS: Persp[] = ["lg", "pr", "cu", "fi"];
/** BSCの正式な視点名 */
export const PERSP: Record<Persp, string> = {
  lg: "学習と成長",
  pr: "業務プロセス",
  cu: "顧客",
  fi: "財務",
};
/** 戦略マップの列の見出し（日常の言葉） */
export const PL: Record<Persp, string> = {
  lg: "必要な人・データ・体制",
  pr: "変える業務",
  cu: "顧客に起きる変化",
  fi: "売上・利益への貢献",
};
/** 全体マップでの列の位置（1列目は戦略テーマ名） */
export const PCOL: Record<Persp, number> = { lg: 2, pr: 3, cu: 4, fi: 5 };
export const CAP: Record<Cap, string> = {
  hum: "人的資本",
  inf: "情報資本",
  org: "組織資本",
};
export const CAPS: Cap[] = ["hum", "inf", "org"];
export const HZ = ["短期（0〜1年）", "中期（1〜3年）", "長期（3〜4年）"];
export const CVP = [
  "トータル・コスト・リーダーシップ",
  "製品リーダーシップ",
  "完全な顧客ソリューション",
  "システムロックイン",
];
/** IPAの7つの取組項目（IPA『DX動向2026』データ集 p.2） */
export const IPA: Record<number, string> = {
  1: "アナログ・物理データのデジタル化",
  2: "業務の効率化による生産性の向上",
  3: "既存製品・サービスの高付加価値化",
  4: "新規製品・サービスの創出",
  5: "組織横断／全体の業務・製造プロセスのデジタル化",
  6: "顧客起点の価値創出によるビジネスモデルの根本的な変革",
  7: "企業文化や組織マインドの根本的な変革",
};
export const IPA_ITEMS = [1, 2, 3, 4, 5, 6, 7];
/** 取組項目 → DXの段階（1＝デジタイゼーション、2・3＝デジタライゼーション、4〜7＝DX） */
export const IPA_STAGE: Record<number, Stage> = {
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 3,
  6: 3,
  7: 3,
};
export const STAGE = [
  "未到達",
  "デジタイゼーション",
  "デジタライゼーション",
  "DX",
];
export const STAGES: Stage[] = [1, 2, 3];
export const EXEC = ["検討中", "試行中", "実行中", "中止"];
export const VERIFY = ["未測定", "確認中", "効果あり", "効果なし"];
export const OWN: Record<Owner, string> = {
  biz: "事業部",
  dx: "DX推進部",
  mgmt: "経営",
};
export const CHECK_LABELS = {
  condition: "実行条件（予算・工数・権限・データの提供者）の確保",
  review: "検証と次の判断日の決定",
} as const;
export const FINKIND = ["収益増大", "生産性向上"];
/** 指標が動かなかった・下がった理由（設計書v0.4 U-3） */
export const REASON = [
  "施策が遅れた",
  "施策は進んだが指標が動かない",
  "外部環境が変わった",
  "測れていない",
  "その他",
];
/** 道筋の進み（0〜4） */
export const PROG = [
  "指標はまだ動いていない",
  "学習と成長",
  "業務プロセス",
  "顧客",
  "財務",
];
export const PROGS = ["まだ", "学習と成長", "業務", "顧客", "財務"];
export const PIDX: Record<Persp, number> = { lg: 1, pr: 2, cu: 3, fi: 4 };
/** 指標の動き（基準値と現在値の比較） */
export const IS = {
  up: "改善",
  flat: "横ばい",
  worse: "悪化",
  none: "未測定",
  nokpi: "未設定",
} as const;
export type IndState = keyof typeof IS;
/** 事業ごとの点の色（他社と比べる） */
export const BCOL = ["var(--accent)", "var(--cyan)", "#7b6fd6"];
