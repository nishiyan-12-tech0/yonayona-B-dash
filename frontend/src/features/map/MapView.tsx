"use client";

import Link from "next/link";
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { fetchVersion } from "@/lib/api";
import { HZ, OWN, PCOL, PERSP, PERSPS, PIDX, PL, STAGE } from "@/lib/constants";
import { finMix, focusSets, hereSet, objById, themeFin } from "@/lib/logic";
import { FinMixBar } from "@/components/FinMixBar";
import { useStore } from "@/lib/store";
import type { BusinessUnit, Objective, Persp, StrategyData } from "@/lib/types";
import { History, type Hist } from "@/components/HistoryDrawer";
import { ActButton, cls, MetButton, ObjCard, type MapCtx } from "./cards";
import { ConfirmModal } from "./ConfirmModal";
import { Info } from "@/components/Info";
import { Panel } from "./Panel";
import { useLinks } from "./useLinks";

const BODY_PERSPS: Persp[] = ["lg", "pr", "cu"];

/**
 * ② 戦略マップ。いつもは現在の申請の日々の進捗を出す。
 * 左上の「過去を見る」で版を選ぶと、その版の戦略マップを見るだけで出す。
 * 申請がまだなければ、申請への案内だけを出す
 */
export function MapView() {
  const { data, setUi } = useStore();
  const [hist, setHist] = useState<Hist>({ kind: "now" });
  const [past, setPast] = useState<StrategyData | null>(null);
  const vid = hist.kind === "version" ? hist.id : null;

  useEffect(() => {
    if (!vid) return;
    let alive = true;
    fetchVersion(vid)
      .then((v) => alive && setPast(v.data))
      .catch(() => alive && setPast(null));
    return () => {
      alive = false;
    };
  }, [vid]);

  const choose = (h: Hist) => {
    setPast(null);
    setUi({ sel: null, cb: null, ct: null });
    setHist(h);
  };

  const shown = vid ? past : data;
  return (
    <section className="view on" id="v-map" aria-label="戦略マップ">
      <History mode="map" value={hist} onChange={choose} />
      {!shown ? (
        <div className="card muted">読み込み中…</div>
      ) : !shown.bus.length ? (
        <div className="card">
          まだ戦略マップがありません。「申請」のステップ8で「戦略マップを作成」を押すと、ここに出ます。
          <div style={{ marginTop: 8 }}>
            <Link className="btn pri" href="/entry">
              申請へ ›
            </Link>
          </div>
        </div>
      ) : (
        <MapBody data={shown} editable={!vid} />
      )}
    </section>
  );
}

function MapBody({
  data,
  editable,
}: {
  data: StrategyData;
  editable: boolean;
}) {
  const { ui, setUi } = useStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** 「版を作る」のポップアップを開いているか */
  const [confirming, setConfirming] = useState(false);

  const co = data.company;
  const b = data.bus.find((x) => x.id === ui.cb) ?? data.bus[0];
  const t = b.themes.find((x) => x.id === ui.ct) ?? b.themes[0] ?? null;
  /** テーマごとの表示で開いているテーマ。全体マップのときは null */
  const cur = t && ui.view !== "all" ? t : null;
  const allv = !cur;

  const focus = useMemo(
    () => focusSets(data, { sel: ui.sel, stg: ui.stg, who: ui.who }),
    [data, ui.sel, ui.stg, ui.who],
  );
  /** 表示が切り替わったら、箱と矢印を左から順に出し直す */
  const enterKey = `${ui.view}-${b.id}-${t?.id ?? ""}`;
  useLinks(mapRef, svgRef, data, focus.objs, enterKey);
  const here = useMemo(() => hereSet(data, "now"), [data]);
  useWave(data, ui.sel, focus);

  const ctx: MapCtx = {
    data,
    snap: "now",
    editable,
    showIpa: ui.ipa,
    sel: ui.sel,
    focus,
    here,
    onSel: (sel) => setUi({ sel: ui.sel === sel ? null : sel }),
  };

  const openTheme = (buId: string, themeId: string) => {
    setUi({ cb: buId, ct: themeId, view: "theme", sel: null });
    window.scrollTo({ top: 0 });
  };
  const openBu = (buId: string) => {
    setUi({ cb: buId, ct: null, sel: null });
    if (allv) {
      setTimeout(() => {
        document
          .querySelector(`#bands [data-b="${buId}"]`)
          ?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 60);
    }
  };
  /** カードの余白を押したら選択を外す */
  const onBackgroundClick = (e: MouseEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (
      ui.sel &&
      el.closest(".card") &&
      !el.closest(".panel") &&
      !el.closest("button") &&
      !el.closest("summary")
    ) {
      setUi({ sel: null });
    }
  };

  const highlight =
    ui.who !== "all"
      ? `${OWN[ui.who]}が主担当の目標・施策`
      : ui.stg
        ? `${STAGE[ui.stg]}の施策`
        : "";
  const cards = (os: Objective[]) =>
    os.map((o) => <ObjCard key={o.id} ctx={ctx} obj={o} />);

  return (
    <div onClick={onBackgroundClick}>
      <div className="mnav">
        <div className="seg" id="butabs" aria-label="事業">
          {data.bus.map((x) => (
            <button
              key={x.id}
              aria-pressed={x.id === b.id}
              onClick={() => openBu(x.id)}
            >
              {x.name}
            </button>
          ))}
        </div>
        <div className="seg" id="vsw" aria-label="表示の範囲">
          <button
            aria-pressed={!allv}
            onClick={() => setUi({ view: "theme", sel: null })}
          >
            テーマごと
          </button>
          <button
            aria-pressed={allv}
            onClick={() => setUi({ view: "all", sel: null })}
          >
            全体マップ
          </button>
        </div>
        <button
          className="lnk"
          id="optbtn"
          aria-controls="opts"
          aria-expanded={ui.opt}
          onClick={() => setUi({ opt: !ui.opt })}
        >
          表示オプション
        </button>
        {editable ? (
          <button
            className="btn sm pri"
            onClick={() => setConfirming(true)}
            title="今の進捗を、この時点の版（断面）として残します"
          >
            版を作る
          </button>
        ) : null}
        <span className="co" id="m-co">
          {co.name}
        </span>
      </div>

      <div className="card opts" id="opts" hidden={!ui.opt}>
        <div className="grp">
          <b>担当で強調</b>
          <div className="seg" id="who">
            {(["biz", "dx"] as const).map((w) => (
              <button
                key={w}
                aria-pressed={ui.who === w}
                onClick={() =>
                  setUi({ who: ui.who === w ? "all" : w, stg: 0, sel: null })
                }
              >
                {OWN[w]}の担当
              </button>
            ))}
          </div>
        </div>
        <div className="grp">
          <b>DXの段階で強調</b>
          <div className="seg" id="stg">
            {[
              { s: 1, n: "1" },
              { s: 2, n: "2・3" },
              { s: 3, n: "4〜7" },
            ].map(({ s, n }) => (
              <button
                key={s}
                aria-pressed={ui.stg === s}
                onClick={() =>
                  setUi({ stg: ui.stg === s ? 0 : s, who: "all", sel: null })
                }
              >
                <span className={`ipa s${s}`}>{n}</span>
                {STAGE[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="grp">
          <b>分類</b>
          <div className="seg">
            <button
              id="ipatog"
              aria-pressed={ui.ipa}
              onClick={() => setUi({ ipa: !ui.ipa })}
            >
              施策にIPAの取組項目の番号を表示
            </button>
          </div>
        </div>
      </div>

      <div id="fnotes">
        {highlight ? (
          <div className="fnote on">
            <span>
              <b>{highlight}</b>と、そこから先の道筋を強調しています
            </span>
            <button onClick={() => setUi({ who: "all", stg: 0 })}>解除</button>
          </div>
        ) : null}
      </div>

      <div id="hero">
        {!cur ? (
          <div className="card hero">
            <div className="hk">全体マップ</div>
            <h1>{co.name.replace("（架空）", "")}の事業と戦略テーマ</h1>
            <div className="hgrid">
              <dl className="hdl">
                {data.bus.map((x) => (
                  <BuThemes key={x.id} bu={x} onOpen={openTheme} />
                ))}
              </dl>
              <div>
                <div className="hl2">主要な成果指標</div>
                <div className="mets">
                  <MetButton ctx={ctx} obj={data.corp.fin} label="全社の目標" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card hero">
            <div className="hk">
              {b.name}の戦略テーマ
              {b.themes.length > 1
                ? `（${b.themes.indexOf(cur) + 1}／${b.themes.length}）`
                : ""}
              　｜　取り組む期間の目安：
              {HZ[cur.hz]}
            </div>
            <h1>{cur.name}</h1>
            {b.themes.length > 1 ? (
              <div className="tht">
                {b.themes.map((x) => (
                  <button
                    key={x.id}
                    aria-pressed={x.id === cur.id}
                    onClick={() => openTheme(b.id, x.id)}
                  >
                    {x.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="hgrid">
              <dl className="hdl">
                <dt>対象の顧客</dt>
                <dd>{b.customer}</dd>
                <dt>実現したい変化（この事業が目指す姿）</dt>
                <dd>{b.future}</dd>
              </dl>
              <div>
                <div className="hl2">主要な成果指標</div>
                <div className="mets">
                  {b.objs
                    .filter((o) => o.theme === cur.id && o.persp === "cu")
                    .map((o) => (
                      <MetButton key={o.id} ctx={ctx} obj={o} label={PL.cu} />
                    ))}
                  {themeFin(data, b, cur).map((o) => (
                    <MetButton key={o.id} ctx={ctx} obj={o} label={PL.fi} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={cls("mapgrid", ui.sel && "haspanel")} id="mapgrid">
        <div className="card">
          <div
            className={`map enter ${allv ? "v-all" : "v-theme"}`}
            id="mapc"
            ref={mapRef}
          >
            <div className="vst" id="vst" aria-hidden="true">
              {allv ? <i className="x" /> : null}
              <i />
              <i />
              <i />
              <i />
            </div>
            <svg id="links" aria-hidden="true" ref={svgRef} />
            <div className="stick" id="mhead">
              <div className="cols mhead">
                {allv ? <div className="x" /> : null}
                {PERSPS.map((p) => (
                  <div className={`c pc-${p}`} key={p}>
                    <b>
                      {PL[p]}
                      <Info>
                        バランス・スコアカード（BSC）の「{PERSP[p]}の視点」にあたる列です。
                      </Info>
                    </b>
                  </div>
                ))}
              </div>
            </div>
            <div id="bands" key={enterKey}>
              {!cur ? (
                <>
                  <div className="band corp">
                    <div className="corpgrid">
                      <div className="tl">
                        全社
                        <span>{co.name.replace("株式会社（架空）", "")}</span>
                      </div>
                      <div className="goal" />
                      <div>
                        <ObjCard ctx={ctx} obj={data.corp.fin} corp />
                      </div>
                    </div>
                  </div>
                  {data.bus.map((x) => {
                    const col = !!ui.collapsed[x.id];
                    return (
                      <div className="band" data-b={x.id} key={x.id}>
                        <div className="bhead">
                          <button
                            className="tg"
                            aria-label={col ? "開く" : "閉じる"}
                            aria-expanded={!col}
                            onClick={() =>
                              setUi({
                                collapsed: { ...ui.collapsed, [x.id]: !col },
                              })
                            }
                          >
                            {col ? "▶" : "▼"}
                          </button>
                          <button
                            className={cls(
                              "bn",
                              ui.sel === "b:" + x.id && "sel",
                            )}
                            onClick={() => ctx.onSel("b:" + x.id)}
                          >
                            {x.name}
                          </button>
                        </div>
                        {col ? null : (
                          <BuGrid
                            bu={x}
                            data={data}
                            cards={cards}
                            onOpen={openTheme}
                          />
                        )}
                      </div>
                    );
                  })}
                  <Orphans ctx={ctx} />
                </>
              ) : (
                <div className="bgrid one">
                  {BODY_PERSPS.map((p, n) => (
                    <ThemeCell key={p} col={n + 1}>
                      {cards(
                        b.objs.filter(
                          (o) => o.theme === cur.id && o.persp === p,
                        ),
                      )}
                    </ThemeCell>
                  ))}
                  <ThemeCell col={4} top={<FinMixBar mix={finMix(data, b)} compact />}>
                    {cards(themeFin(data, b, cur))}
                  </ThemeCell>
                </div>
              )}
            </div>
          </div>
        </div>
        <aside className="card panel" id="panel" aria-live="polite">
          <Panel
            ctx={ctx}
            onClose={() => setUi({ sel: null })}
            onOpenTheme={openTheme}
          />
        </aside>
      </div>

      {confirming ? (
        <ConfirmModal onClose={() => setConfirming(false)} />
      ) : null}
    </div>
  );
}

/** 全体マップの上部：事業ごとの戦略テーマの一覧 */
function BuThemes({
  bu,
  onOpen,
}: {
  bu: BusinessUnit;
  onOpen: (buId: string, themeId: string) => void;
}) {
  return (
    <>
      <dt>{bu.name}</dt>
      {bu.themes.map((y) => (
        <dd key={y.id}>
          <button onClick={() => onOpen(bu.id, y.id)}>{y.name} ›</button>
        </dd>
      ))}
    </>
  );
}

/** テーマごとの表示の1列。目標がなければ、その旨を出す */
function ThemeCell({
  col,
  top,
  children,
}: {
  col: number;
  top?: ReactNode;
  children: ReactNode[];
}) {
  return (
    <div className="cell" style={{ gridColumn: col, ...colVar(col - 1) }}>
      {top}
      {children.length ? (
        children
      ) : (
        <div className="empty">—</div>
      )}
    </div>
  );
}

/** 全体マップの1事業ぶん：戦略テーマごとの行と、右端の財務の目標 */
function BuGrid({
  bu,
  data,
  cards,
  onOpen,
}: {
  bu: BusinessUnit;
  data: StrategyData;
  cards: (os: Objective[]) => ReactNode[];
  onOpen: (buId: string, themeId: string) => void;
}) {
  return (
    <div className="bgrid">
      {bu.themes.map((y, ti) => {
        const tob = bu.objs.filter((o) => o.theme === y.id);
        return (
          <Fragment key={y.id}>
            <div
              className="lane"
              style={{ gridRow: ti + 1, gridColumn: "1/5" }}
            />
            <div className="tl" style={{ gridRow: ti + 1, gridColumn: 1 }}>
              <span>戦略テーマ</span>
              <button
                className="bh"
                style={{ margin: 0 }}
                onClick={() => onOpen(bu.id, y.id)}
              >
                <span>{y.name}</span>
              </button>
              <span className="go">このテーマを開く ›</span>
            </div>
            {BODY_PERSPS.map((p) => (
              <div
                className="cell"
                key={p}
                style={{
                  gridRow: ti + 1,
                  gridColumn: PCOL[p],
                  ...colVar(PIDX[p] - 1),
                }}
              >
                {cards(tob.filter((o) => o.persp === p))}
              </div>
            ))}
          </Fragment>
        );
      })}
      <div
        className="fincell"
        style={{ gridRow: `1 / span ${bu.themes.length}`, ...colVar(3) }}
      >
        <FinMixBar mix={finMix(data, bu)} compact />
        {cards(bu.objs.filter((o) => o.persp === "fi"))}
      </div>
    </div>
  );
}

/** どの目標にも付いていない施策 */
function Orphans({ ctx }: { ctx: MapCtx }) {
  const orph = ctx.data.inits.filter((i) => !i.attach.length);
  if (!orph.length) return null;
  return (
    <div className="orphan">
      <b className="small">事業の目標との接続が未設定の施策</b>
      <div className="acts" style={{ border: 0, padding: 0, maxWidth: 340 }}>
        {orph.map((i) => (
          <ActButton key={i.id} ctx={ctx} init={i} dimmable />
        ))}
      </div>
    </div>
  );
}

/** 列の番号（0＝学習と成長〜3＝財務）。開いたときに左の列から順に出す遅れに使う */
const colVar = (n: number) => ({ "--col": n }) as CSSProperties;

/** 動きを減らす設定（OSの「視差効果を減らす」など）か */
const calm = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * 目標・施策を押したときの演出。押した箱から波紋が広がり、
 * つながる目標が学習と成長→業務プロセス→顧客→財務の順に、左から右へ波打つように跳ねる。
 */
function useWave(
  data: StrategyData,
  sel: string | null,
  focus: { objs: Set<string> | null; inits: Set<string> | null },
) {
  useEffect(() => {
    if (!sel || calm()) return;
    const id = requestAnimationFrame(() => {
      const [k, a] = sel.split(":");
      const colOf = (oid: string) => {
        const o = objById(data, oid) ?? (data.corp.fin.id === oid ? data.corp.fin : null);
        return o ? PIDX[o.persp] - 1 : 3;
      };
      const STEP = 150;
      // 押したもの：波紋
      const origin =
        k === "o"
          ? document.getElementById("o-" + a)
          : k === "i"
            ? document.querySelector<HTMLElement>(`#mapc [data-i="${a}"]`)
            : document.querySelector<HTMLElement>(`#bands [data-b="${a}"] .bn`);
      origin?.animate(
        [
          { boxShadow: "0 0 0 0 rgba(65,184,213,.75)" },
          { boxShadow: "0 0 0 18px rgba(65,184,213,0)" },
        ],
        { duration: 700, easing: "ease-out" },
      );
      // 一番左の列から右へ順に（左から右へ流れる波）
      const start = Math.min(3, ...[...(focus.objs ?? [])].map(colOf));
      // つながる目標：列ごとに遅らせて跳ねる
      focus.objs?.forEach((oid) => {
        const el = document.getElementById("o-" + oid);
        if (!el || oid === a) return;
        const c = colOf(oid);
        el.animate(
          [
            { transform: "translateY(0) scale(1)" },
            {
              transform: "translateY(-8px) scale(1.04)",
              boxShadow: "0 12px 26px rgba(0,74,173,.28)",
              offset: 0.4,
            },
            { transform: "translateY(1px) scale(.995)", offset: 0.75 },
            { transform: "translateY(0) scale(1)" },
          ],
          {
            duration: 620,
            delay: (c - start) * STEP + 80,
            easing: "cubic-bezier(.3,.7,.4,1)",
          },
        );
      });
      // 付いている施策：その目標の少し前に揺れる
      focus.inits?.forEach((iid) => {
        if (k === "i" && iid === a) return;
        const it = data.inits.find((x) => x.id === iid);
        const c = Math.min(
          3,
          ...(it?.attach.filter((x) => focus.objs?.has(x)).map(colOf) ?? [0]),
        );
        document
          .querySelectorAll<HTMLElement>(`#mapc [data-i="${iid}"]`)
          .forEach((el) =>
            el.animate(
              [
                { transform: "translateX(0)" },
                { transform: "translateX(6px)", offset: 0.35 },
                { transform: "translateX(-2px)", offset: 0.7 },
                { transform: "translateX(0)" },
              ],
              { duration: 520, delay: Math.max(0, c - start) * STEP, easing: "ease-out" },
            ),
          );
      });
    });
    return () => cancelAnimationFrame(id);
    // 選んだときだけ動かす（data・focus の変化では動かさない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);
}
