import { EXEC, FINKIND, IPA, IPA_STAGE, IS, OWN, STAGE, VERIFY } from "@/lib/constants";
import {
  curOf,
  doneOf,
  indState,
  initDone,
  initsOn,
  pctOf,
  running,
  stAt,
} from "@/lib/logic";
import type { Initiative, Objective, Snap, StrategyData } from "@/lib/types";

export const cls = (...xs: (string | false | null | undefined)[]) =>
  xs.filter(Boolean).join(" ");
/** 箱の「今 ○○」の部分の名前 */
export const nowLabel = () => "今";

/** 戦略マップの描画に共通で渡すもの */
export interface MapCtx {
  data: StrategyData;
  snap: Snap;
  /** 進捗を入力できるか（現在の申請の「現在」を表示しているときだけ） */
  editable: boolean;
  /** 施策にIPAの取組項目の番号を表示するか */
  showIpa: boolean;
  /** 選択中のもの（"o:目標ID" "i:施策ID" "b:事業ID"） */
  sel: string | null;
  /** 強調する目標・施策（null＝すべて） */
  focus: { objs: Set<string> | null; inits: Set<string> | null };
  /** 選択する（同じものをもう一度選ぶと解除） */
  onSel: (sel: string) => void;
  /** 「今ここ」の目標（道筋の先端） */
  here: Set<string>;
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
  const done = initDone(init, ctx.snap);
  const key = "i:" + init.id;
  return (
    <button
      className={cls(
        "act",
        run && !done && "run",
        done && "done",
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
        {done ? <span className="dn">完了</span> : null}
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
  const pc = pctOf(obj, ctx.snap);
  const done = doneOf(obj, ctx.snap);
  const sel = ctx.sel === key;
  const here = ctx.here.has(obj.id);
  /** 達成した目標は、選んでいるとき以外は畳む */
  const fold = done && !sel;
  return (
    <div className="obj" data-o={obj.id}>
      <button
        className={cls(
          "ocard",
          `pc-${obj.persp}`,
          obj.persp === "fi" && obj.kind !== undefined && `k${obj.kind}`,
          !obj.kpi && "nok",
          done && "done",
          fold && "fold",
          here && !done && "here",
          dim && "dim",
          sel && "sel",
        )}
        id={`o-${obj.id}`}
        onClick={() => ctx.onSel(key)}
      >
        {here && !done ? <span className="here-b">今ここ</span> : null}
        {done ? <span className="stamp">達成</span> : null}
        <span className="oh">
          <span className="tag">
            {corp
              ? "全社の目標"
              : obj.persp === "fi" && obj.kind !== undefined
                ? FINKIND[obj.kind]
                : "目標"}
          </span>
          <span className="own">主担当：{OWN[obj.owner]}</span>
        </span>
        <span className="on">{obj.name}</span>
        {fold ? (
          <span className="od">
            {obj.kpi ? `${obj.kpi}：目標 ${obj.target} に到達` : "目標に到達"}
            {its.length ? `・施策${its.length}件` : ""}
          </span>
        ) : obj.kpi ? (
          <>
            <span className="ok">{obj.kpi}</span>
            <span className="ov">
              <span>
                {nowLabel()} <b>{curOf(obj, ctx.snap)}</b>
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
            {pc !== null ? (
              <span className="ob" title={`目標値まで ${pc}%`}>
                <i style={{ width: `${pc}%` }} />
              </span>
            ) : null}
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
      {its.length && !fold ? (
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
      className={cls("met", pc === 100 && "done", ctx.sel === key && "sel")}
      data-m={obj.id}
      onClick={() => ctx.onSel(key)}
    >
      <span className="ml">{label}</span>
      <span className="mn">{obj.kpi || obj.name}</span>
      {obj.kpi ? (
        <>
          <span className="mv">
            <span>
              {nowLabel()} <b>{curOf(obj, ctx.snap)}</b>
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
