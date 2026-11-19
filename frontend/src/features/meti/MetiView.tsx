"use client";

import { useCallback, useState, type CSSProperties } from "react";
import { fetchMetiSummary } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { GridChart } from "@/components/GridChart";
import { History, type Hist } from "@/components/HistoryDrawer";
import { Info } from "@/components/Info";
import { PerspStack } from "@/components/PerspStack";

const swatch = (color: string) =>
  ({ "--c": color, "--cs": color }) as CSSProperties;

/** ④ 参加企業の集計（経産省）。左上の「過去を見る」で版の時点を選ぶと、その時点の断面から集計する */
export function MetiView() {
  const [hist, setHist] = useState<Hist>({ kind: "now" });
  return (
    <MetiBody
      key={hist.kind === "version" ? hist.id : "now"}
      hist={hist}
      onHist={setHist}
    />
  );
}

function MetiBody({ hist, onHist }: { hist: Hist; onHist: (h: Hist) => void }) {
  const vid = hist.kind === "version" ? hist.id : undefined;
  const load = useCallback(() => fetchMetiSummary(vid), [vid]);
  const meti = useAsync(load);
  if (!meti) {
    return (
      <section className="view on" aria-label="参加企業の集計">
        <History mode="meti" value={hist} onChange={onHist} />
      </section>
    );
  }
  const companies = meti.companies;

  return (
    <section className="view on" aria-label="参加企業の集計">
      <History mode="meti" value={hist} onChange={onHist} />
      <div className="card">
        <h2>
          参加企業の現在地{vid ? "（この時点の断面）" : ""}
          <Info>
            各社の今の戦略と日々の進捗から、段階・道筋の進み・件数だけを抜き出したデータ（抽象化データ）を集計しています。戦略の中身は含みません。本番は毎晩のバッチで更新します。過去の時点は、版を作ったときに残した断面から集計します（集計した日時：
            {meti.extractedAt.replace("T", " ")}）。
          </Info>
        </h2>
        <div className="summary">
          {meti.stats.map((s) => (
            <div className="stat" key={s.label}>
              <b>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="cmpgrid">
        <div className="card">
          <h2>
            参加企業の全事業：道筋の進み × DXの段階
            <Info>
              数字は、全事業のうちそのマスにいる事業の割合です。段階が高くても、道筋を右へ進んでいない事業が多いことが分かります。評価・表彰の基準を「どの段階の施策で、道筋のどこまで進んだか」で示すための材料になります。
            </Info>
          </h2>
          <div id="mgrid">
            <GridChart
              cells={meti.cells}
              points={[]}
              label="参加企業の全事業の分布"
            />
          </div>
        </div>
        <div className="card">
          <h2>業種別：顧客・財務まで道筋が進んだ事業の割合</h2>
          <div
            id="industry"
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr 44px",
              gap: "8px 12px",
              alignItems: "center",
            }}
          >
            {meti.industries.map((r) => (
              <IndustryRow key={r.name} name={r.name} value={r.reached} />
            ))}
          </div>
          <h2 style={{ marginTop: 18 }}>
            指標はどの視点に置かれているか
            <Info>
              参考：IPA『DX動向2026』では、成果指標の対象は「内向きの業務改革（社内の効率化）」が80.0%、「外向きの業務改革（新たなビジネスや顧客価値の創出）」が33.5%（p.19 図表2-15、複数回答）。参加企業の中でこの偏りがどう変わるかを定点で見ます。
            </Info>
          </h2>
          <div className="legend" style={{ marginBottom: 8 }}>
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
          <div
            id="persp"
            style={{
              display: "grid",
              gridTemplateColumns: "110px 1fr",
              gap: "8px 12px",
              alignItems: "center",
            }}
          >
            {meti.perspRows.map((r) => (
              <PerspRow key={r.name} name={r.name}>
                <PerspStack share={r.persp} />
              </PerspRow>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <h2>企業一覧</h2>
        <div className="scroll">
          <table id="cos">
            <tbody>
              <tr>
                <th>企業名</th>
                <th>業種</th>
                <th>対象の事業</th>
                <th>道筋が一番進んだ事業（段階・進み）</th>
                <th>最終更新</th>
              </tr>
              {companies.map((c) => (
                <tr key={c.name} className={c.own ? "own" : undefined}>
                  <td>{c.name}</td>
                  <td>{c.industry}</td>
                  <td>{c.buCount}</td>
                  <td>{c.best}</td>
                  <td>{c.updatedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function IndustryRow({ name, value }: { name: string; value: number }) {
  return (
    <>
      <span className="small">{name}</span>
      <div className="bw" style={{ height: 12 }}>
        <i style={{ width: `${value * 2}%`, background: "var(--accent)" }} />
      </div>
      <span className="small">{value}%</span>
    </>
  );
}

function PerspRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="small">{name}</span>
      {children}
    </>
  );
}
