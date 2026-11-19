"use client";

import {
  Fragment,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { HZ, OWN, PCOL, PERSP, PERSPS, PL, STAGE } from "@/lib/constants";
import { focusSets, themeFin } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { BusinessUnit, Objective, Persp } from "@/lib/types";
import {
  ActButton,
  cls,
  MetButton,
  ObjCard,
  prevLabel,
  type MapCtx,
} from "./cards";
import { ConfirmModal } from "./ConfirmModal";
import { Info } from "@/components/Info";
import { Panel } from "./Panel";
import { useLinks } from "./useLinks";

const BODY_PERSPS: Persp[] = ["lg", "pr", "cu"];

/** ② 戦略マップ。事業がまだ1つもなければ、申請への案内だけを出す */
export function MapView() {
  const { data } = useStore();
  if (!data.bus.length) {
    return (
      <section className="view on" aria-label="戦略マップ">
        <div className="card">
          まだ事業がありません。「申請」で事業と目標を入力すると、ここに戦略マップが出ます。
        </div>
      </section>
    );
  }
  return <MapBody />;
}

function MapBody() {
  const { data, ui, setUi } = useStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  /** 「進捗を確定」のポップアップを開いているか */
  const [confirming, setConfirming] = useState(false);
  /** 比べる時点（直近の確定版）の名前 */
  const prev = prevLabel(data);

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
  useLinks(mapRef, svgRef, data, focus.objs);

  const ctx: MapCtx = {
    data,
    snap: ui.snap,
    showIpa: ui.ipa,
    sel: ui.sel,
    focus,
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
    <section
      className="view on"
      id="v-map"
      aria-label="戦略マップ"
      onClick={onBackgroundClick}
    >
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
        {ui.snap === "now" ? (
          <button
            className="btn sm pri"
            onClick={() => setConfirming(true)}
            title="今の進捗を確定版にして、他社と比べる画面に反映します"
          >
            進捗を確定
          </button>
        ) : null}
        <span className="co" id="m-co">
          {co.name}
        </span>
      </div>

      <div className="card opts" id="opts" hidden={!ui.opt}>
        <div className="grp">
          <b>表示する時点</b>
          <div className="seg" id="snap">
            <button
              aria-pressed={ui.snap === "now"}
              onClick={() => setUi({ snap: "now" })}
            >
              現在
            </button>
            {data.snap?.prev ? (
              <button
                aria-pressed={ui.snap === "mar"}
                onClick={() => setUi({ snap: "mar" })}
              >
                {prev}（前回の確定）
              </button>
            ) : null}
          </div>
        </div>
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
        {ui.snap === "mar" ? (
          <div className="fnote on">
            <span>
              <b>{prev}</b>（前回の確定）を表示中
            </span>
            <button onClick={() => setUi({ snap: "now" })}>現在に戻す</button>
          </div>
        ) : null}
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
            className={`map ${allv ? "v-all" : "v-theme"}`}
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
                  <div className="c" key={p}>
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
            <div id="bands">
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
                          <BuGrid bu={x} cards={cards} onOpen={openTheme} />
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
                  <ThemeCell col={4}>{cards(themeFin(data, b, cur))}</ThemeCell>
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

      <details className="card dbox" id="diffbox" hidden={ui.snap !== "now"}>
        <summary>{prev}（前回の確定）から変わったこと</summary>
        <ul className="diff">
          {data.diffs.length ? (
            data.diffs.map((d, n) => <li key={n}>{d}</li>)
          ) : (
            <li className="muted">
              なし
            </li>
          )}
        </ul>
      </details>
      {confirming ? (
        <ConfirmModal onClose={() => setConfirming(false)} />
      ) : null}
    </section>
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
function ThemeCell({ col, children }: { col: number; children: ReactNode[] }) {
  return (
    <div className="cell" style={{ gridColumn: col }}>
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
  cards,
  onOpen,
}: {
  bu: BusinessUnit;
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
                style={{ gridRow: ti + 1, gridColumn: PCOL[p] }}
              >
                {cards(tob.filter((o) => o.persp === p))}
              </div>
            ))}
          </Fragment>
        );
      })}
      <div
        className="fincell"
        style={{ gridRow: `1 / span ${bu.themes.length}` }}
      >
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
