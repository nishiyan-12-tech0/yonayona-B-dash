import { EXEC, IPA, IPA_STAGE, IS, OWN, STAGE, VERIFY } from "@/lib/constants";
import { curOf, indState, initsOn, pctOf, running, stAt } from "@/lib/logic";
import type { Initiative, Objective, Snap, StrategyData } from "@/lib/types";

export const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");
/** 比べる時点（直近の確定版）の名前。例：2026年3月末 */
export const prevLabel = (d: StrategyData) => d.snap?.prev ?? "前回の確定";
/** 表示中の時点の短い名前（箱の「現在 ○○」の部分） */
export const nowLabel = (snap: Snap, d?: StrategyData) =>
  snap === "mar"
    ? (d ? prevLabel(d) : "前回").replace(/^\d{4}年/, "")
    : (d?.snap?.now ?? "現在");

/** 戦略マップの描画に共通で渡すもの */
export interface MapCtx {
  data: StrategyData;
  snap: Snap;
  /** 施策にIPAの取組項目の番号を表示するか */
  showIpa: boolean;
  /** 選択中のもの（"o:目標ID" "i:施策ID" "b:事業ID"） */
  sel: string | null;
  /** 強調する目標・施策（null＝すべて） */
  focus: { objs: Set<string> | null; inits: Set<string> | null };
  /** 選択する（同じものをもう一度選ぶと解除） */
  onSel: (sel: string) => void;
}

/** 施策のボタン。dimmable＝強調のときに薄くする対象か（マップ上の施策だけ） */
export function ActButton({
  ctx,
  init,
  dimmable,
}: {
  ctx: MapCtx;
  init: Initiative;
  dimmable?: boolean;
}) {
  const s = stAt(init, ctx.snap);
  const run = running(init, ctx.snap);
  const key = "i:" + init.id;
  return (
    <button
      className={cls(
        "act",
        dimmable && !!ctx.focus.inits && !ctx.focus.inits.has(init.id) && "dim",
        dimmable && ctx.sel === key && "sel",
      )}
      data-i={init.id}
      onClick={() => ctx.onSel(key)}
    >
      <span className="an">
        {ctx.showIpa && init.digital && init.ipa ? (
          <span
            className={`ipa s${IPA_STAGE[init.ipa]}`}
            title={`${STAGE[IPA_STAGE[init.ipa]]}・IPA取組項目${init.ipa}：${IPA[init.ipa]}`}
          >
            {init.ipa}
          </span>
        ) : null}
        {init.name}
      </span>
      <span className="am">
        担当：{OWN[init.owner]}・{EXEC[s.exec]}
        {run ? "・効果の検証：" + VERIFY[s.verify] : ""}
      </span>
      {init.attach.length > 1 ? (
        <span className="am">複数の事業で共通</span>
      ) : null}
    </button>
  );
}

/** 目標の箱と、その目標に付いた施策。corp＝全社の目標 */
export function ObjCard({
  ctx,
  obj,
  corp,
}: {
  ctx: MapCtx;
  obj: Objective;
  corp?: boolean;
}) {
  const s = indState(obj, ctx.snap);
  const its = initsOn(ctx.data, obj.id);
  const key = "o:" + obj.id;
  const dim = !!ctx.focus.objs && !corp && !ctx.focus.objs.has(obj.id);
  return (
    <div className="obj" data-o={obj.id}>
      <button
        className={cls(
          "ocard",
          !obj.kpi && "nok",
          dim && "dim",
          ctx.sel === key && "sel",
        )}
        id={`o-${obj.id}`}
        onClick={() => ctx.onSel(key)}
      >
        <span className="oh">
          <span className="tag">{corp ? "全社の目標" : "目標"}</span>
          <span className="own">主担当：{OWN[obj.owner]}</span>
        </span>
        <span className="on">{obj.name}</span>
        {obj.kpi ? (
          <>
            <span className="ok">{obj.kpi}</span>
            <span className="ov">
              <span>
                {nowLabel(ctx.snap, ctx.data)} <b>{curOf(obj, ctx.snap)}</b>
              </span>
              {" ／ "}
              <span>
                目標 <b>{obj.target}</b>
              </span>
            </span>
            <span className="od">
              <span>期限 {obj.due || "未設定"}</span>
              <span className={`is ${s}`}>指標：{IS[s]}</span>
            </span>
          </>
        ) : (
          <>
            <span className="ok">
              指標：<span className="is nokpi">未設定</span>
            </span>
            <span className="od">現在値・目標値・期限も未設定</span>
          </>
        )}
      </button>
      {its.length ? (
        <div className="acts">
          <span className="tag t2">実施する施策</span>
          {its.map((i) => (
            <ActButton key={i.id} ctx={ctx} init={i} dimmable />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 上部の「主要な成果指標」のカード */
export function MetButton({
  ctx,
  obj,
  label,
}: {
  ctx: MapCtx;
  obj: Objective;
  label: string;
}) {
  const s = indState(obj, ctx.snap);
  const pc = pctOf(obj, ctx.snap);
  const key = "o:" + obj.id;
  return (
    <button
      className={cls("met", ctx.sel === key && "sel")}
      data-m={obj.id}
      onClick={() => ctx.onSel(key)}
    >
      <span className="ml">{label}</span>
      <span className="mn">{obj.kpi || obj.name}</span>
      {obj.kpi ? (
        <>
          <span className="mv">
            <span>
              {nowLabel(ctx.snap, ctx.data)} <b>{curOf(obj, ctx.snap)}</b>
            </span>
            {" ／ "}
            <span>
              目標 <b>{obj.target}</b>
            </span>
          </span>
          <span className="mb">
            <i style={{ width: `${pc ?? 0}%` }} />
          </span>
          <span className="md">
            期限 {obj.due || "未設定"}　
            <span className={`is ${s}`}>指標：{IS[s]}</span>
          </span>
        </>
      ) : (
        <span className="md">指標が未設定</span>
      )}
    </button>
  );
}
