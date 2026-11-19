"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { fetchPeers, fetchVersions } from "@/lib/api";
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
import type { PerspShare, StageCells, StrategyData } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { GridChart, type GridPoint } from "@/components/GridChart";
import { Heat } from "@/components/Heat";
import {
  History,
  versionName,
  type Hist,
} from "@/components/HistoryDrawer";
import { Info } from "@/components/Info";
import { PerspStack } from "@/components/PerspStack";
import { Track } from "@/components/Track";

const swatch = (color: string, round = false) =>
  ({
    "--c": color,
    "--cs": color,
    ...(round ? { borderRadius: "50%" } : {}),
  }) as CSSProperties;

/** 点を打つ1つの時点 */
interface Moment {
  label: string;
  data: StrategyData;
}

/**
 * 自社の事業の点。時点ごとに位置を計算して、事業ごとの軌跡にする（新しい順。[0] が塗りの点）。
 * 実行中のデジタル施策がない時点は点を出さない。
 */
function ownPoints(ms: Moment[]): GridPoint[] {
  const latest = ms[0]?.data;
  if (!latest) return [];
  return latest.bus.flatMap((b, n) => {
    const trail = ms.flatMap((v) => {
      const bu = v.data.bus.find((x) => x.id === b.id);
      if (!bu) return [];
      const st = stageTop(v.data, bu, "now");
      return st ? [{ st, p: progOf(v.data, bu, "now"), label: v.label }] : [];
    });
    if (!trail.length || trail[0].label !== ms[0].label) return [];
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

/** ③ 他社と比べる。塗りの点＝表示している時点（ふだんは日々の進捗）、白抜きの点＝それより前の版 */
export function CompareView() {
  const { data: live } = useStore();
  const [hist, setHist] = useState<Hist>({ kind: "now" });
  if (!live.application) {
    return (
      <section className="view on" aria-label="他社と比べる">
        <History mode="map" value={hist} onChange={setHist} />
        <div className="card">
          まだ戦略マップがありません。「申請」のステップ8で「戦略マップを作成」を押すと、ここで他社と比べられます。
        </div>
      </section>
    );
  }
  const key =
    hist.kind === "version"
      ? `v${hist.id}`
      : `now-${live.application.id}`;
  return (
    <CompareBody key={key} hist={hist} onHist={setHist} live={live} />
  );
}

function CompareBody({
  hist,
  onHist,
  live,
}: {
  hist: Hist;
  onHist: (h: Hist) => void;
  live: StrategyData;
}) {
  const { ui, setUi } = useStore();
  const vid = hist.kind === "version" ? hist.id : undefined;
  const appId =
    hist.kind === "version" ? hist.appId : (live.application?.id ?? 0);
  const loadPeers = useCallback(() => fetchPeers(vid), [vid]);
  const loadVersions = useCallback(() => fetchVersions(appId), [appId]);
  const peerData = useAsync(loadPeers);
  const versions = useAsync(loadVersions);

  const shell = (body: React.ReactNode) => (
    <section className="view on" aria-label="他社と比べる">
      <History mode="map" value={hist} onChange={onHist} />
      {body}
    </section>
  );
  if (!peerData || !versions) return shell(<div className="card muted">読み込み中…</div>);

  /** 点を打つ時点（新しい順）。現在なら日々の進捗＋この申請の版、過去の版ならその版とそれより前の版 */
  let moments: Moment[];
  if (vid) {
    const i = versions.findIndex((v) => v.id === vid);
    moments = (i >= 0 ? versions.slice(i) : []).map((v) => ({
      label: versionName(v),
      data: v.data,
    }));
  } else {
    moments = [
      { label: "現在", data: live },
      ...versions.slice(0, 5).map((v) => ({ label: versionName(v), data: v.data })),
    ];
  }
  if (!moments.length) return shell(<div className="card muted">この版は見つかりませんでした</div>);

  /** 表示している時点 */
  const data: StrategyData = moments[0].data;
  /** その1つ前の時点 */
  const before: StrategyData | null = moments[1]?.data ?? null;
  const latestLabel = moments[0].label;

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
  /** 分母が0のときは0（入力の途中で確定しても NaN にしない） */
  const ratio = (n: number, d: number) => (d ? n / d : 0);
  const reach = ratio(
    objs.filter((o) => {
      const bu = buOfObj(data, o.id);
      return (
        !!bu &&
        [...down(bu, o.id)].some((id) => objById(data, id)?.persp === "fi")
      );
    }).length,
    objs.length,
  );
  const its = data.inits.filter((i) => i.attach.length);
  const share = (fn: (i: (typeof its)[number]) => boolean) =>
    ratio(its.filter(fn).length, its.length);
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
      Math.round(ratio(kp.filter((o) => o.persp === p).length, kp.length) * 100),
    ]),
  ) as PerspShare;

  return shell(
    <>
      <div className="card row">
        <div>
          <b>他社と比べる</b>
          <span className="muted small">　自社：{latestLabel}</span>
          <Info>
            {vid
              ? "自社はこの版の値、他社はこの版を作ったときに残した集計（抽象化データの断面）で比べます。"
              : "自社は戦略マップに入力した日々の進捗、他社は一斉集計（本番は毎晩のバッチ）で比べます。戦略マップで「版を作る」と、その時点が白抜きの点として残ります。"}
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
      <div className="card cmpwide">
        <h2>
          道筋のどこまで進んだか × DXの段階
            <Info>
              点は事業です。横は、道筋のどこまで進んだか（施策から順にたどり、指標が今（申請時点）から目標の方向へ動いたところまで。途中が動いていないと、その先は数えません）。縦は、その事業の道筋にある実行中のデジタル施策のうち、一番上の段階（IPAの3段階）。マスの濃さと数字は、比べる相手の事業がそこにいる割合です。どちらも戦略マップから自動で出します。
            </Info>
          </h2>
          <div id="grid">
            <GridChart
              cells={cells}
              points={ownPoints(moments)}
              label="道筋の進みとDXの段階のマス目"
              size="lg"
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
                {moments.length > 1 ? "　白抜き＝それより前の版" : ""}
              </span>
              <span>数字＝比べる相手の割合（%）</span>
            </div>
          </div>
        </div>
      <div className="cmpgrid">
        <div className="card">
          <h2>
            自社の事業
            <Info>
              実行中のデジタル施策がない事業は、上のマス目には出ません。
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
    </>,
  );
}
