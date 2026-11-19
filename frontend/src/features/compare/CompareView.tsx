"use client";

import type { CSSProperties } from "react";
import { fetchConfirmedVersions, fetchPeers } from "@/lib/api";
import { BCOL, PROG, STAGES } from "@/lib/constants";
import {
  allObjs,
  buOfObj,
  down,
  dxSummary,
  objById,
  pct,
  progOf,
  stageTop,
} from "@/lib/logic";
import { useStore } from "@/lib/store";
import type {
  ConfirmedVersion,
  PerspShare,
  StageCells,
  StrategyData,
} from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { GridChart, type GridPoint } from "@/components/GridChart";
import { Heat } from "@/components/Heat";
import { Info } from "@/components/Info";
import { PerspStack } from "@/components/PerspStack";
import { Track } from "@/components/Track";

const swatch = (color: string, round = false) =>
  ({
    "--c": color,
    "--cs": color,
    ...(round ? { borderRadius: "50%" } : {}),
  }) as CSSProperties;

/**
 * 自社の事業の点。確定版ごとに位置を計算して、事業ごとの軌跡にする（新しい順）。
 * 試行・実行中のデジタル施策がない時点は点を出さない。
 */
function ownPoints(vs: ConfirmedVersion[]): GridPoint[] {
  const latest = vs[0]?.data;
  if (!latest) return [];
  return latest.bus.flatMap((b, n) => {
    const trail = vs.flatMap((v) => {
      const bu = v.data.bus.find((x) => x.id === b.id);
      if (!bu) return [];
      const st = stageTop(v.data, bu, "now");
      return st ? [{ st, p: progOf(v.data, bu, "now"), label: v.label }] : [];
    });
    if (!trail.length || trail[0].label !== vs[0].label) return [];
    return [
      {
        name: b.name,
        short: b.name
          .replace("事業", "")
          .replace("（新規）", "")
          .replace("サービス", ""),
        color: BCOL[n % 3],
        trail,
      },
    ];
  });
}

/** ③ 他社と比べる */
export function CompareView() {
  const { ui, setUi } = useStore();
  const peerData = useAsync(fetchPeers);
  /** 確定版（新しい順）。この画面は確定版だけで描く（ふだんの保存は出さない） */
  const versions = useAsync(fetchConfirmedVersions);
  if (!peerData || !versions || !versions.length) return null;
  /** いちばん新しい確定版 */
  const data: StrategyData = versions[0].data;
  /** その1つ前の確定版 */
  const before: StrategyData | null = versions[1]?.data ?? null;
  const latestLabel = versions[0].label;

  const inds = new Set(data.bus.map((b) => b.industry));
  const peers = peerData.points.filter(
    (p) => ui.peer === "all" || inds.has(p.ind),
  );
  const cells: StageCells = {
    1: [0, 0, 0, 0, 0],
    2: [0, 0, 0, 0, 0],
    3: [0, 0, 0, 0, 0],
  };
  peers.forEach((p) => cells[p.st][p.p]++);
  STAGES.forEach((r) => {
    cells[r] = cells[r].map((v) => Math.round((v / peers.length) * 100));
  });

  // 項目ごとの比較（自社は単純な割合。売上での重み付けはしない）
  const objs = allObjs(data).filter((o) => o.persp !== "fi");
  const reach =
    objs.filter((o) => {
      const bu = buOfObj(data, o.id);
      return (
        !!bu &&
        [...down(bu, o.id)].some((id) => objById(data, id)?.persp === "fi")
      );
    }).length / objs.length;
  const its = data.inits.filter((i) => i.attach.length);
  const share = (fn: (i: (typeof its)[number]) => boolean) =>
    its.filter(fn).length / its.length;
  const avg = peerData.avg;
  const rows: [string, number, number][] = [
    ["財務までつながる目標", pct(reach), avg.reach],
    [
      "実行条件の確保がある施策",
      pct(share((i) => i.checks.condition)),
      avg.condition,
    ],
    [
      "検証日が決まっている施策",
      pct(share((i) => i.checks.review)),
      avg.review,
    ],
    [
      "検証が済んだ施策",
      pct(share((i) => i.verify >= 2)),
      avg.verified,
    ],
  ];
  const kp = allObjs(data).filter((o) => o.kpi);
  const own = Object.fromEntries(
    (["lg", "pr", "cu", "fi"] as const).map((p) => [
      p,
      Math.round((kp.filter((o) => o.persp === p).length / kp.length) * 100),
    ]),
  ) as PerspShare;

  return (
    <section className="view on" aria-label="他社と比べる">
      <div className="card row">
        <div>
          <b>他社と比べる</b>
          <span className="muted small">　最新の確定：{latestLabel}</span>
          <Info>
            他社は年度末の集計（2026年3月末）、自社は確定した進捗で比べます。ふだんの保存は出ません。戦略マップで「進捗を確定」すると、ここに反映されます。
          </Info>
        </div>
        <span className="small muted" style={{ marginLeft: "auto" }}>
          比べる相手
        </span>
        <div className="seg" id="peer">
          <button
            aria-pressed={ui.peer === "same"}
            onClick={() => setUi({ peer: "same" })}
          >
            同じ業種の事業
          </button>
          <button
            aria-pressed={ui.peer === "all"}
            onClick={() => setUi({ peer: "all" })}
          >
            参加企業の全事業
          </button>
        </div>
      </div>
      <div className="cmpgrid">
        <div className="card">
          <h2>
            道筋のどこまで進んだか × DXの段階
            <Info>
              点は事業です。横は、道筋のどこまで進んだか（施策から順にたどり、指標が基準値から目標の方向へ動いたところまで。途中が動いていないと、その先は数えません）。縦は、その事業の道筋にある試行・実行中のデジタル施策のうち、一番上の段階（IPAの3段階）。マスの濃さと数字は、比べる相手の事業がそこにいる割合です。どちらも戦略マップから自動で出します。
            </Info>
          </h2>
          <div id="grid">
            <GridChart
              cells={cells}
              points={ownPoints(versions)}
              label="道筋の進みとDXの段階のマス目"
            />
            <div className="legend" style={{ marginTop: 6 }}>
              {data.bus.map((b, n) => (
                <span key={b.id}>
                  <span className="sw" style={swatch(BCOL[n % 3], true)} />
                  {b.name}
                </span>
              ))}
              <span>
                塗り＝{latestLabel}
                {versions.length > 1 ? "　白抜き＝前回まで" : ""}
              </span>
              <span>数字＝比べる相手の割合（%）</span>
            </div>
          </div>
        </div>
        <div className="card">
          <h2>
            自社の事業
            <Info>
              試行・実行中のデジタル施策がない事業は、左のマス目には出ません。
            </Info>
          </h2>
          <div className="bul" id="bulist">
            {data.bus.map((b, n) => {
              const p = progOf(data, b, "now");
              const old = before?.bus.find((x) => x.id === b.id);
              const p0 = before && old ? progOf(before, old, "now") : p;
              return (
                <div key={b.id}>
                  <h3>
                    <u style={{ background: BCOL[n % 3] }} />
                    {b.name}
                  </h3>
                  <div className="small">
                    道筋にあるDX：{dxSummary(data, b)}
                  </div>
                  <div className="small">
                    道筋の進み：{p0 !== p ? PROG[p0] + " → " : ""}
                    <b>{p ? PROG[p] + "まで" : PROG[0]}</b>
                  </div>
                  <Track p={p} was={p0} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="cmpgrid">
        <div className="card">
          <h2>
            項目ごとの比較
            <Info>
              施策・目標の件数は会社ごとに切り分け方が違うため、割合だけで比べます。財務までつながる目標＝財務の目標まで矢印がつながっている目標。実行条件＝予算・工数・権限・データの提供者。検証日＝検証と次の判断をする日。検証が済んだ＝効果あり・なしのどちらかが出たもの。
            </Info>
          </h2>
          <div className="bars" id="bars">
            {rows.map(([t, a, b]) => (
              <div key={t}>
                <div className="bt">{t}</div>
                <div className="br">
                  <div className="bw">
                    <i
                      style={{ width: `${a}%`, background: "var(--accent)" }}
                    />
                  </div>
                  <span className="small">{a}%</span>
                </div>
                <div className="br" style={{ marginTop: 3 }}>
                  <div className="bw">
                    <i style={{ width: `${b}%`, background: "var(--faint)" }} />
                  </div>
                  <span className="small muted">{b}%</span>
                </div>
              </div>
            ))}
            <div>
              <div className="bt">指標の視点別の構成</div>
              <div className="legend" style={{ marginBottom: 4 }}>
                <span>
                  <span className="sw" style={swatch("var(--cyan)")} />
                  学習と成長
                </span>
                <span>
                  <span className="sw" style={swatch("var(--accent-2)")} />
                  業務プロセス
                </span>
                <span>
                  <span className="sw" style={swatch("var(--accent)")} />
                  顧客
                </span>
                <span>
                  <span className="sw" style={swatch("var(--gray)")} />
                  財務
                </span>
              </div>
              <PerspStack share={own} />
              <div style={{ height: 4 }} />
              <PerspStack share={avg.persp} />
              <div className="small muted" style={{ marginTop: 3 }}>
                上：自社　下：比べる相手の平均
              </div>
            </div>
          </div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span>
              <span className="sw o-dx" />
              自社（{latestLabel}）
            </span>
            <span>
              <span className="sw" style={swatch("var(--faint)")} />
              比べる相手の平均
            </span>
          </div>
        </div>
        <div className="card">
          <h2>
            道筋にあるDX（IPAの7項目）
            <Info>
              その項目の施策がある事業について、その施策から道筋がどこまで進んだかを出しています。「—」は、その項目の施策がまだないところ。
              <br />
              1. アナログ・物理データのデジタル化／2. 業務の効率化による生産性の向上／3. 既存製品・サービスの高付加価値化／4. 新規製品・サービスの創出／5. 組織横断／全体の業務・製造プロセスのデジタル化／6. 顧客起点の価値創出によるビジネスモデルの根本的な変革／7. 企業文化や組織マインドの根本的な変革
              <br />
              出典：IPA『DX動向2026』データ集 p.2
            </Info>
          </h2>
          <div id="heat">
            <Heat data={data} snap="now" />
          </div>
        </div>
      </div>
    </section>
  );
}
