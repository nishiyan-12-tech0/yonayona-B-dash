import type { ReactNode } from "react";
import {
  CAP,
  CHECK_LABELS,
  CVP,
  EXEC,
  FINKIND,
  IPA,
  IPA_STAGE,
  IS,
  OWN,
  PERSP,
  PL,
  STAGE,
  VERIFY,
} from "@/lib/constants";
import {
  buOfObj,
  curOf,
  indState,
  initsOn,
  itemRows,
  objById,
  pctOf,
  progOf,
  progText,
  reachedSet,
  running,
  stAt,
} from "@/lib/logic";
import type { Link } from "@/lib/types";
import { ActButton, nowLabel, type MapCtx } from "./cards";

interface Props {
  ctx: MapCtx;
  onClose: () => void;
  /** 戦略テーマを開く */
  onOpenTheme: (buId: string, themeId: string) => void;
}

function Head({
  kind,
  crumb,
  name,
  onClose,
}: {
  kind: string;
  crumb: string;
  name: string;
  onClose: () => void;
}) {
  return (
    <>
      <div className="ph">
        <span className="kb">{kind}</span>
        <button className="px" aria-label="詳細を閉じる" onClick={onClose}>
          ×
        </button>
      </div>
      <p className="crumb">{crumb}</p>
      <h3>{name}</h3>
    </>
  );
}

/** つながり（仮説）の1件 */
function Hyp({ ctx, link }: { ctx: MapCtx; link: Link }) {
  const t = objById(ctx.data, link.to);
  return (
    <div className="hyp">
      <b>→ {t ? t.name : ""}</b>
      {link.reason || "理由はまだ書いていない"}
      {link.cond ? (
        <>
          <br />
          <span className="muted">成り立つ条件：</span>
          {link.cond}
        </>
      ) : null}
      <br />
      {link.check ? (
        <>
          <span className="muted">次に確かめること：</span>
          {link.check}（{link.date}）
        </>
      ) : (
        <span className="muted">次に確かめること：未設定</span>
      )}
    </div>
  );
}

/** 戦略マップの右側に出る詳細（事業・目標・施策） */
export function Panel({ ctx, onClose, onOpenTheme }: Props) {
  const { data, snap, sel } = ctx;
  if (!sel) return null;
  const [k, a] = sel.split(":");
  let body: ReactNode = null;

  if (k === "b") {
    const b = data.bus.find((x) => x.id === a);
    if (!b) return null;
    const rs = itemRows(data, b, snap);
    const pg = progOf(data, b, snap);
    body = (
      <>
        <Head
          kind="事業"
          crumb={data.company.name}
          name={b.name}
          onClose={onClose}
        />
        <h4>目指すこと</h4>
        <dl className="kv">
          <dt>対象の顧客</dt>
          <dd>{b.customer}</dd>
          <dt>目指す姿</dt>
          <dd>{b.future}</dd>
          <dt>価値提案</dt>
          <dd>{CVP[b.cvp]}</dd>
          <dt>財務の差</dt>
          <dd>
            {b.gap}
            <div className="split">
              <i style={{ width: `${b.growth}%`, background: "var(--accent)" }}>
                {b.growth ? "収益増大 " + b.growth + "%" : ""}
              </i>
              <i
                style={{
                  width: `${100 - b.growth}%`,
                  background: "var(--gray)",
                }}
              >
                {100 - b.growth ? "生産性 " + (100 - b.growth) + "%" : ""}
              </i>
            </div>
          </dd>
        </dl>
        <h4>戦略テーマ</h4>
        <div className="jump">
          {b.themes.map((t) => (
            <button key={t.id} onClick={() => onOpenTheme(b.id, t.id)}>
              {t.name} ›
            </button>
          ))}
        </div>
        <details>
          <summary>事業の基本情報・分類</summary>
          <dl className="kv">
            <dt>業種</dt>
            <dd>{b.industry}</dd>
            <dt>売上比率</dt>
            <dd>
              {b.share}%{b.share ? "" : "（売上はまだない）"}
            </dd>
            <dt>責任者</dt>
            <dd>{b.owner}</dd>
            <dt>事業側の確認</dt>
            <dd>{b.confAt ? `${b.confBy}（${b.confAt}）` : "まだ"}</dd>
          </dl>
          {rs.length ? (
            <ul className="checks">
              {rs.map((r) => (
                <li key={r.k}>
                  <span className="mk y">{r.k}</span>
                  <span>
                    <b>{STAGE[IPA_STAGE[r.k]]}</b>：{IPA[r.k]}
                    <br />
                    <span className="muted">
                      施策：{r.its.map((i) => i.name).join("・")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small muted">デジタルの施策はまだ付いていません。</p>
          )}
          <p className="small muted">
            経路上の判定（他社比較の「道筋の進み」に使う値）：{progText(pg)}
            。実行中の施策から順に、途中の指標が基準値より改善しているところまでを数えたもので、事業全体の順調さや施策の成果を示すものではありません。
          </p>
        </details>
      </>
    );
  }

  if (k === "o") {
    const corp = a === data.corp.fin.id;
    const o = corp ? data.corp.fin : objById(data, a);
    if (!o) return null;
    const b = buOfObj(data, a);
    const out = b ? b.links.filter((l) => l.from === a) : [];
    const inn = b ? b.links.filter((l) => l.to === a) : [];
    const its = initsOn(data, a);
    const th = b && o.theme ? b.themes.find((t) => t.id === o.theme) : null;
    const s = indState(o, snap);
    const pc = pctOf(o, snap);
    const crumb = b
      ? [b.name, th ? th.name : null, PL[o.persp]].filter(Boolean).join(" › ")
      : "全社 › " + PL.fi;
    const cross = (n: number) =>
      data.inits
        .filter((i) => i.digital && i.ipa === n && i.attach.length)
        .map((i) => i.name)
        .join("・") || "まだない";
    body = (
      <>
        <Head
          kind={b ? "目標" : "全社の目標"}
          crumb={crumb}
          name={o.name}
          onClose={onClose}
        />
        <h4>指標</h4>
        {o.kpi ? (
          <>
            <dl className="kv">
              <dt>指標名</dt>
              <dd>{o.kpi}</dd>
              <dt>{nowLabel(snap)}の値</dt>
              <dd>
                <b>{curOf(o, snap)}</b>
                {snap === "now" && o.prev !== undefined && o.prev !== o.cur
                  ? `（2026年3月末：${o.prev}）`
                  : ""}
              </dd>
              <dt>目標値</dt>
              <dd>{o.target}</dd>
              <dt>期限</dt>
              <dd>{o.due || "未設定"}</dd>
              <dt>基準値</dt>
              <dd>{o.base}</dd>
              <dt>測り方</dt>
              <dd className="muted">未登録</dd>
            </dl>
            <h4>状態</h4>
            <dl className="kv">
              <dt>指標の動き</dt>
              <dd>
                <span className={`is ${s}`}>{IS[s]}</span> 基準値との比較
              </dd>
              <dt>目標の達成状況</dt>
              <dd>
                {pc === null
                  ? "判定できない"
                  : pc >= 100
                    ? "達成"
                    : `未達（基準から目標までの${pc}%）`}
                {pc === null ? null : (
                  <div className="pbar">
                    <i style={{ width: `${pc}%` }} />
                  </div>
                )}
              </dd>
            </dl>
          </>
        ) : (
          <p className="now">指標が未設定（現在値・目標値・期限も未設定）</p>
        )}
        {b ? (
          <>
            <h4>実施する施策</h4>
            {its.length ? (
              <div
                className="acts"
                style={{ border: 0, padding: 0, margin: 0 }}
              >
                {its.map((i) => (
                  <ActButton key={i.id} ctx={ctx} init={i} />
                ))}
              </div>
            ) : (
              <p className="small muted" style={{ margin: 0 }}>
                この目標に直接付いている施策はありません。
              </p>
            )}
          </>
        ) : (
          <>
            <h4>全社にまたがる施策</h4>
            <dl className="kv">
              <dt>事業をまたぐ施策</dt>
              <dd>{cross(5)}</dd>
              <dt>組織・文化の施策</dt>
              <dd>{cross(7)}</dd>
            </dl>
          </>
        )}
        {b && (inn.length || out.length) ? (
          <>
            <h4>つながり（仮説）</h4>
            {inn.length ? (
              <>
                <p className="st-line muted">手前の目標</p>
                <div className="jump">
                  {inn.map((l, n) => (
                    <button key={n} onClick={() => ctx.onSel("o:" + l.from)}>
                      {objById(data, l.from)?.name}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {out.length ? (
              <>
                <p className="st-line muted">この目標から先</p>
                {out.map((l, n) => (
                  <Hyp key={n} ctx={ctx} link={l} />
                ))}
              </>
            ) : null}
          </>
        ) : null}
        {b ? (
          <details>
            <summary>担当・分類・経路上の判定</summary>
            <dl className="kv">
              <dt>主担当</dt>
              <dd>{OWN[o.owner]}</dd>
              <dt>協働</dt>
              <dd>{o.partner ? o.partner : "なし"}</dd>
              <dt>BSCの視点</dt>
              <dd>
                {PERSP[o.persp]}
                {o.cap ? `（${CAP[o.cap]}）` : ""}
                {o.persp === "fi" && o.kind !== undefined && FINKIND[o.kind]
                  ? `（${FINKIND[o.kind]}）`
                  : ""}
              </dd>
            </dl>
            {o.kpi ? (
              <p className="small muted">
                経路上の判定（他社比較の「道筋の進み」に使う）：実行中の施策からこの目標まで、途中の目標の指標が順に改善して
                {reachedSet(data, b, snap).has(a) ? "います" : "いません"}
                。指標そのものの動きとは別の判定で、施策の成果を示すものではありません。
              </p>
            ) : null}
          </details>
        ) : null}
      </>
    );
  }

  if (k === "i") {
    const i = data.inits.find((x) => x.id === a);
    if (!i) return null;
    const s = stAt(i, snap);
    const run = running(i, snap);
    const crumb = i.attach.length
      ? [...new Set(i.attach.map((x) => buOfObj(data, x)?.name ?? ""))].join(
          "・",
        )
      : "どの事業の目標にも付いていない";
    const first = i.attach.length ? objById(data, i.attach[0]) : null;
    body = (
      <>
        <Head
          kind="実施する施策"
          crumb={crumb}
          name={i.name}
          onClose={onClose}
        />
        <h4>状態</h4>
        <dl className="kv">
          <dt>実行の状態</dt>
          <dd>{EXEC[s.exec]}</dd>
          <dt>効果の検証</dt>
          <dd>{run ? VERIFY[s.verify] : `まだ対象外（${EXEC[s.exec]}）`}</dd>
          <dt>施策の指標</dt>
          {i.kpi ? (
            <dd>
              {i.kpi}
              <br />
              現在 <b>{i.cur}</b> ／ 目標 {i.target}（基準 {i.base}）
            </dd>
          ) : (
            <dd className="muted">未登録</dd>
          )}
        </dl>
        <h4>この施策が付いている目標</h4>
        {i.attach.length ? (
          <div className="jump">
            {i.attach.map((x) => (
              <button key={x} onClick={() => ctx.onSel("o:" + x)}>
                {objById(data, x)?.name}
                <span className="muted">（{buOfObj(data, x)?.name}）</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            なし
          </p>
        )}
        <h4>実行の準備</h4>
        <ul className="checks">
          {(["condition", "review"] as const).map((c) => (
            <li key={c}>
              <span className={`mk ${s.checks[c] ? "y" : "n"}`}>
                {s.checks[c] ? "済" : "未"}
              </span>
              <span>{CHECK_LABELS[c]}</span>
            </li>
          ))}
        </ul>
        <details>
          <summary>担当・分類</summary>
          <dl className="kv">
            <dt>主担当</dt>
            <dd>{OWN[i.owner]}</dd>
            <dt>協働</dt>
            <dd>{i.partner ? i.partner : "なし"}</dd>
            {i.ev ? (
              <>
                <dt>決めた場</dt>
                <dd>{i.ev}</dd>
              </>
            ) : null}
            <dt>DXの段階</dt>
            <dd>
              {i.digital && i.ipa
                ? `${STAGE[IPA_STAGE[i.ipa]]}（IPA取組項目${i.ipa}. ${IPA[i.ipa]}）`
                : "デジタル以外の施策"}
            </dd>
          </dl>
          {i.digital && first?.persp === "lg" ? (
            <p className="small muted">
              施策の指標（利用率・導入数など）は「準備がどれだけ整ったか」を表します。事業の成果は、先の目標の指標で見ます。
            </p>
          ) : null}
        </details>
      </>
    );
  }

  return body;
}
