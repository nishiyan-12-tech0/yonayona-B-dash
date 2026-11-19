/**
 * 申請の入力チェック（設計書 v0.4 の 4-2）。申請の項目は全部必須（協働と、ステップ6の実行の準備のチェックだけは除く）。
 * 書きかけ（作成中の申請）は空欄があっても保存する。止めるのは「保存して次へ」と「戦略マップを作成」の2か所。
 * バックエンドの strategy.py（作成のとき）にも同じチェックがある。
 */
import type { BusinessUnit, Initiative, Objective, StrategyData } from "./types";

export interface Issue {
  /** どのステップで直すか（0〜6） */
  step: number;
  /** その事業で直すか（ステップ1〜6）。全社・事業の一覧はなし */
  bu?: string;
  text: string;
}

const blank = (v: unknown) =>
  v === undefined || v === null || String(v).trim() === "";
const oname = (o: Objective) => `「${o.name || "（名前なし）"}」`;
const iname = (i: Initiative) => `施策「${i.name || "（名前なし）"}」`;
const KPI = [
  ["kpi", "指標"],
  ["base", "今（申請時点）"],
  ["target", "目標"],
  ["due", "期限"],
] as const;

function objIssues(o: Objective, label: string, theme: boolean): string[] {
  const miss: string[] = [];
  if (blank(o.name)) miss.push("目標");
  if (theme && blank(o.theme)) miss.push("テーマ");
  if (o.persp === "lg" && !o.cap) miss.push("資本の種類");
  KPI.forEach(([k, t]) => blank(o[k]) && miss.push(t));
  return miss.length ? [`${label}${oname(o)}の${miss.join("・")}`] : [];
}

/** その事業のステップ4・6に出る施策（この事業の目標に付いた施策と、どこにも付いていない施策） */
export function initsShownIn(d: StrategyData, b: BusinessUnit) {
  const ids = new Set(b.objs.map((o) => o.id));
  return d.inits.filter(
    (i) => i.attach.some((a) => ids.has(a)) || !i.attach.length,
  );
}

/** 入っていないものの一覧 */
export function validate(d: StrategyData): Issue[] {
  const out: Issue[] = [];
  const add = (step: number, text: string, bu?: BusinessUnit) =>
    out.push({ step, text, bu: bu?.id });

  // 0. 会社と事業
  const f = d.corp.fin;
  const fm = [
    blank(f.name) && "目標",
    ...KPI.map(([k, t]) => blank(f[k]) && t),
  ].filter(Boolean);
  if (fm.length) add(0, `全社の財務目標の${fm.join("・")}`);
  if (!d.bus.length) add(0, "戦略を描く事業がありません。事業を追加してください");
  d.bus.forEach((b) => {
    const m = [
      blank(b.name) && "事業名",
      blank(b.industry) && "業種",
      blank(b.owner) && "責任者",
    ].filter(Boolean);
    if (m.length) add(0, `事業「${b.name || "（名前なし）"}」の${m.join("・")}`);
  });

  d.bus.forEach((b) => {
    const of = (p: Objective["persp"]) => b.objs.filter((o) => o.persp === p);
    // 1. 財務の目標
    if (blank(b.gap)) add(1, "目標と今との差", b);
    if (!of("fi").length) add(1, "財務の目標がありません", b);
    of("fi").forEach((o) => objIssues(o, "財務の目標", false).forEach((t) => add(1, t, b)));
    // 2. 顧客への価値
    if (blank(b.customer)) add(2, "対象の顧客", b);
    if (blank(b.future)) add(2, "顧客に届ける変化", b);
    if (!of("cu").length) add(2, "顧客の成果目標がありません", b);
    of("cu").forEach((o) => objIssues(o, "顧客の成果目標", false).forEach((t) => add(2, t, b)));
    // 3. 戦略テーマと業務
    if (!b.themes.length) add(3, "戦略テーマがありません", b);
    b.themes.forEach((t, n) => blank(t.name) && add(3, `${n + 1}つ目の戦略テーマの名前`, b));
    if (!of("pr").length) add(3, "変える業務がありません", b);
    of("pr").forEach((o) => objIssues(o, "変える業務", true).forEach((t) => add(3, t, b)));
    if (blank(b.confBy) || blank(b.confAt))
      add(3, "事業側で確認した人・日付", b);
    // 4. 必要な力と施策
    if (!of("lg").length) add(4, "必要な力（学習と成長の目標）がありません", b);
    of("lg").forEach((o) => objIssues(o, "必要な力", true).forEach((t) => add(4, t, b)));
    initsShownIn(d, b).forEach((i) => {
      if (!i.attach.length) {
        add(4, `${iname(i)}が、どの目標にも付いていません`, b);
      }
      const m = [
        blank(i.name) && "施策名",
        i.digital && !i.ipa && "IPA項目",
        blank(i.kpi) && "施策の指標",
        blank(i.base) && "今（申請時点）",
        blank(i.target) && "目標",
      ].filter(Boolean);
      if (m.length) add(4, `${iname(i)}の${m.join("・")}`, b);
    });
    // 5. つながりと検証
    if (!b.links.length) add(5, "目標どうしのつながりがありません", b);
    b.links.forEach((l, n) => {
      const m = [
        blank(l.from) && "元の目標",
        blank(l.to) && "先の目標",
        blank(l.reason) && "理由",
        blank(l.cond) && "成り立つ条件",
        blank(l.check) && "次に確かめること",
        blank(l.date) && "時期",
      ].filter(Boolean);
      if (m.length) add(5, `${n + 1}本目のつながりの${m.join("・")}`, b);
    });
    // 6. 実行の準備（チェックは空でもよい。決めた場は必須）
    initsShownIn(d, b).forEach(
      (i) => blank(i.ev) && i.attach.length && add(6, `${iname(i)}の決めた場`, b),
    );
  });

  // 同じ施策が複数の事業に出るときは1回だけにする
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.step}|${x.text}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** 画面に出す1行（事業の名前を前に付ける） */
export function issueText(d: StrategyData, x: Issue): string {
  const b = x.bu ? d.bus.find((y) => y.id === x.bu) : null;
  return b ? `${b.name}：${x.text}` : x.text;
}
