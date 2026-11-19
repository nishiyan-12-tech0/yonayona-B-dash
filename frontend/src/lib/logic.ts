/**
 * 戦略マップの計算。画面に出す「指標の動き」「道筋の進み」「DXの段階」は、
 * すべて申請内容（StrategyData）からここで計算します。
 */
import {
  IPA_STAGE,
  PIDX,
  PROG,
  STAGE,
  STAGES,
  type IndState,
} from "./constants";
import type {
  BusinessUnit,
  Initiative,
  InitState,
  Objective,
  Snap,
  StrategyData,
  Theme,
} from "./types";

/** 「月42件」「1,200億円」のような文字から数値を取り出す */
export const num = (v: unknown): number | null => {
  const m = String(v ?? "")
    .replace(/,/g, "")
    .match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};
export const pct = (v: number) => Math.round(v * 100);

export const allObjs = (d: StrategyData) => d.bus.flatMap((b) => b.objs);
/** 事業の目標をIDで探す（全社の目標 cfin は対象外） */
export function objById(d: StrategyData, id: string): Objective | null {
  for (const b of d.bus) {
    const o = b.objs.find((x) => x.id === id);
    if (o) return o;
  }
  return null;
}
export const buOfObj = (d: StrategyData, id: string) =>
  d.bus.find((b) => b.objs.some((o) => o.id === id));

/** その時点の指標の値（担当者がまだ入れていなければ、今（申請時点）の値） */
export const curOf = (o: Objective, snap: Snap) =>
  (snap === "mar" && o.prev !== undefined ? o.prev : o.cur) ?? o.base;
/** その時点の施策の状態 */
export const stAt = (i: Initiative, snap: Snap): InitState =>
  snap === "mar" && i.prev ? i.prev : i;
/** 実行中の施策か（0＝未着手、1＝実行中） */
export const running = (i: Initiative, snap: Snap) => stAt(i, snap).exec === 1;

export const initsOn = (d: StrategyData, objId: string) =>
  d.inits.filter((i) => i.attach.includes(objId));
export function initsOfBu(d: StrategyData, b: BusinessUnit) {
  const ids = new Set(b.objs.map((o) => o.id));
  return d.inits.filter((i) => i.attach.some((a) => ids.has(a)));
}

function walk(b: BusinessUnit, id: string, dir: "down" | "up") {
  const seen = new Set<string>();
  const q = [id];
  while (q.length) {
    const c = q.shift() as string;
    b.links.forEach((l) => {
      const [a, z] = dir === "down" ? [l.from, l.to] : [l.to, l.from];
      if (a === c && !seen.has(z)) {
        seen.add(z);
        q.push(z);
      }
    });
  }
  return seen;
}
/** つながりを先（財務の側）へたどった目標 */
export const down = (b: BusinessUnit, id: string) => walk(b, id, "down");
/** つながりを手前（学習と成長の側）へたどった目標 */
export const up = (b: BusinessUnit, id: string) => walk(b, id, "up");

/** 指標が今（申請時点）から目標の方向へ動いたか */
export function moved(o: Objective, snap: Snap) {
  const c = num(curOf(o, snap));
  const b = num(o.base);
  const t = num(o.target);
  if (c === null || b === null || t === null || t === b) return false;
  return (c - b) * (t - b) > 0;
}

/** 指標の事実：今（申請時点）と今の値の比較だけで決める（道筋の進みの判定とは別） */
export function indState(o: Objective, snap: Snap): IndState {
  if (!o.kpi) return "nokpi";
  const c = num(curOf(o, snap));
  const b = num(o.base);
  const t = num(o.target);
  if (c === null || b === null || t === null || t === b) return "none";
  const d = (c - b) * (t - b);
  if (d === 0 && !o.progress) return "start";
  return d > 0 ? "up" : d < 0 ? "worse" : "flat";
}

/** 今（申請時点）から目標値までの何%まで来たか（0〜100）。判定できないときは null */
export function pctOf(o: Objective, snap: Snap) {
  const c = num(curOf(o, snap));
  const b = num(o.base);
  const t = num(o.target);
  if (!o.kpi || c === null || b === null || t === null || t === b) return null;
  return Math.max(0, Math.min(100, Math.round(((c - b) / (t - b)) * 100)));
}

/**
 * 道筋の順に指標が動いた目標。
 * 実行中の施策が付いた目標から始め、手前の目標が動いていないと先は数えません。
 */
export function reachedSet(
  d: StrategyData,
  b: BusinessUnit,
  snap: Snap,
  filt?: (i: Initiative) => boolean,
) {
  const R = new Set<string>();
  const started = (o: Objective) =>
    d.inits.some(
      (i) => i.attach.includes(o.id) && running(i, snap) && (!filt || filt(i)),
    );
  let changed = true;
  while (changed) {
    changed = false;
    b.objs.forEach((o) => {
      if (R.has(o.id) || !moved(o, snap)) return;
      if (started(o) || b.links.some((l) => l.to === o.id && R.has(l.from))) {
        R.add(o.id);
        changed = true;
      }
    });
  }
  return R;
}

/** 道筋の進み（0〜4）：指標が順に動いた一番先の視点 */
export function progOf(
  d: StrategyData,
  b: BusinessUnit,
  snap: Snap,
  filt?: (i: Initiative) => boolean,
) {
  let p = 0;
  reachedSet(d, b, snap, filt).forEach((id) => {
    const o = objById(d, id);
    if (o) p = Math.max(p, PIDX[o.persp]);
  });
  return p;
}

const stageOf = (i: Initiative) => (i.ipa ? IPA_STAGE[i.ipa] : 0);

/** 事業の段階＝その事業の道筋にある（実行中の）デジタル施策のうち、一番上の段階 */
export function stageTop(d: StrategyData, b: BusinessUnit, snap: Snap) {
  let s = 0;
  initsOfBu(d, b)
    .filter((i) => i.digital && running(i, snap))
    .forEach((i) => {
      s = Math.max(s, stageOf(i));
    });
  return s;
}

/** 「デジタライゼーション（項目2・3）／DX（項目5）」のような要約 */
export function dxSummary(d: StrategyData, b: BusinessUnit) {
  const m: Record<number, Set<number>> = {
    1: new Set(),
    2: new Set(),
    3: new Set(),
  };
  initsOfBu(d, b)
    .filter((i) => i.digital && i.ipa)
    .forEach((i) => m[stageOf(i)].add(i.ipa as number));
  return (
    STAGES.filter((k) => m[k].size)
      .map((k) => `${STAGE[k]}（項目${[...m[k]].sort().join("・")}）`)
      .join("／") || "デジタルの施策はまだない"
  );
}

/** IPAの取組項目ごとに、その項目の施策から道筋がどこまで進んだか */
export function itemRows(d: StrategyData, b: BusinessUnit, snap: Snap) {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((k) => {
      const its = initsOfBu(d, b).filter((i) => i.digital && i.ipa === k);
      if (!its.length) return null;
      return { k, its, p: progOf(d, b, snap, (i) => i.digital && i.ipa === k) };
    })
    .filter((r) => r !== null);
}

export const progText = (p: number) =>
  p ? PROG[p] + "まで指標が動いた" : PROG[0];

/** 戦略テーマの先にある財務の目標 */
export function themeFin(d: StrategyData, b: BusinessUnit, t: Theme) {
  const s = new Set<string>();
  b.objs
    .filter((o) => o.theme === t.id)
    .forEach((o) =>
      down(b, o.id).forEach((x) => {
        if (objById(d, x)?.persp === "fi") s.add(x);
      }),
    );
  return b.objs.filter((o) => s.has(o.id));
}

/** 選択（"o:目標ID" "i:施策ID" "b:事業ID"）や強調の条件から、強調する目標・施策を決める。null＝すべて */
export function focusSets(
  d: StrategyData,
  f: { sel: string | null; stg: number; who: "all" | "biz" | "dx" },
): { objs: Set<string> | null; inits: Set<string> | null } {
  let objs: Set<string> | null = null;
  let inits: Set<string> | null = null;
  const addDown = (target: Set<string>, id: string) => {
    target.add(id);
    const bu = buOfObj(d, id);
    if (bu) down(bu, id).forEach((x) => target.add(x));
  };
  if (f.sel) {
    const [k, a] = f.sel.split(":");
    if (k === "o") {
      const bu = buOfObj(d, a);
      if (bu) {
        const set = new Set([a, ...down(bu, a), ...up(bu, a)]);
        objs = set;
        inits = new Set(
          d.inits
            .filter((i) => i.attach.some((x) => set.has(x)))
            .map((i) => i.id),
        );
      }
    }
    if (k === "i") {
      const it = d.inits.find((x) => x.id === a);
      const set = new Set<string>();
      it?.attach.forEach((x) => addDown(set, x));
      objs = set;
      inits = new Set([a]);
    }
  } else if (f.stg) {
    const os = new Set<string>();
    const is = new Set<string>();
    d.inits.forEach((i) => {
      if (i.digital && stageOf(i) === f.stg) {
        is.add(i.id);
        i.attach.forEach((x) => addDown(os, x));
      }
    });
    objs = os;
    inits = is;
  } else if (f.who !== "all") {
    const os = new Set<string>();
    const is = new Set<string>();
    d.bus.forEach((b) =>
      b.objs.forEach((o) => {
        if (o.owner === f.who) addDown(os, o.id);
      }),
    );
    d.inits.forEach((i) => {
      if (i.owner === f.who) {
        is.add(i.id);
        i.attach.forEach((x) => addDown(os, x));
      }
    });
    objs = os;
    inits = is;
  }
  return { objs, inits };
}

/** 目標が目標値まで届いたか（今（申請時点）から目標値までの100%に来た） */
export const doneOf = (o: Objective, snap: Snap) => pctOf(o, snap) === 100;

/** 施策が終わったか（効果の検証で「効果あり」が出た） */
export const initDone = (i: Initiative, snap: Snap) => stAt(i, snap).verify === 2;

/**
 * 「今ここ」の目標：道筋の先端。
 * 道筋が進んでいれば、指標が順に動いた一番先の視点の目標（まだ目標値に届いていないもの）。
 * まだどこも動いていなければ、実行中の施策が付いた目標（いま手を付けているところ）。
 */
export function hereSet(d: StrategyData, snap: Snap) {
  const out = new Set<string>();
  d.bus.forEach((b) => {
    const R = reachedSet(d, b, snap);
    const p = progOf(d, b, snap);
    if (p) {
      R.forEach((id) => {
        const o = objById(d, id);
        if (o && PIDX[o.persp] === p && !doneOf(o, snap)) out.add(id);
      });
      return;
    }
    b.objs.forEach((o) => {
      if (initsOn(d, o.id).some((i) => running(i, snap))) out.add(o.id);
    });
  });
  return out;
}

/** 財務の差を何で埋めるか：宣言（申請のスライダー）と実態（施策がつながる財務の目標の種類） */
export interface FinMix {
  /** 宣言：収益増大で埋める割合（%） */
  plan: number;
  /** 実態：収益増大の財務の目標につながる施策の割合（%）。数えられる施策がなければ null */
  actual: number | null;
  /** 数えた施策の数（財務の目標までつながる施策） */
  n: number;
  /** 財務の目標までつながっていない施策の数 */
  none: number;
}

/**
 * 実態の数え方：事業の施策ごとに、付いている目標からつながりを先へたどり、
 * 行き着く財務の目標の種類を見る。収益増大だけなら収益増大に1、生産性向上だけなら生産性向上に1、
 * 両方なら半分ずつ。財務の目標まで行き着かない施策は数えない（none に数える）。
 */
export function finMix(d: StrategyData, b: BusinessUnit): FinMix {
  const ids = new Set(b.objs.map((o) => o.id));
  let rev = 0;
  let prod = 0;
  let none = 0;
  initsOfBu(d, b).forEach((i) => {
    const kinds = new Set<number>();
    i.attach
      .filter((a) => ids.has(a))
      .forEach((a) =>
        [a, ...down(b, a)].forEach((x) => {
          const o = objById(d, x);
          if (o?.persp === "fi" && o.kind !== undefined) kinds.add(o.kind);
        }),
      );
    if (kinds.has(0) && kinds.has(1)) {
      rev += 0.5;
      prod += 0.5;
    } else if (kinds.has(0)) rev += 1;
    else if (kinds.has(1)) prod += 1;
    else none += 1;
  });
  const n = rev + prod;
  return {
    plan: b.growth,
    actual: n ? Math.round((rev / n) * 100) : null,
    n: Math.round(n),
    none,
  };
}
