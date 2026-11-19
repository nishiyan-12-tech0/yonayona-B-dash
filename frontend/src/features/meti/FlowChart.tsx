import type { CSSProperties } from "react";
import { STAGE } from "@/lib/constants";
import type { MetiFlow } from "@/lib/types";

/** 各段の名前（k 以上まで進んだ事業） */
const STEP = [
  "参加企業の全事業",
  "学習と成長まで動いた",
  "業務プロセスまで動いた",
  "顧客まで動いた",
  "財務まで動いた",
];
/** 止まっている場所の名前（progress＝k の事業） */
const STOP = [
  "指標がまだ動いていない",
  "学習と成長で止まっている",
  "業務プロセスで止まっている",
  "顧客で止まっている",
];
/** DXの段階の色（0＝未到達〜3＝DX） */
export const STAGE_COL = ["var(--faint)", "var(--cyan)", "var(--accent-2)", "var(--accent)"];

/**
 * どこで詰まっているか：道筋を「学習と成長→業務プロセス→顧客→財務」と進むにつれて、
 * 事業がどれだけ減るかを、DXの段階で塗り分けた帯で出す。一番減るところを「最大の詰まり」として目立たせる
 */
export function FlowChart({ flow }: { flow: MetiFlow[] }) {
  const N = flow[0]?.n || 1;
  const drops = flow.slice(0, -1).map((f, k) => f.n - flow[k + 1].n);
  // 「まだ動いていない」は入口の問題なので、詰まりの判定は学習と成長より先で見る
  const worst = drops.reduce((w, d, k) => (k >= 1 && d > drops[w] ? k : w), 1);
  return (
    <div className="flow2">
      <div className="legend" style={{ marginBottom: 10 }}>
        <span className="small muted">帯の色＝DXの段階：</span>
        {[1, 2, 3, 0].map((st) => (
          <span key={st}>
            <span
              className="sw"
              style={{ "--c": STAGE_COL[st], "--cs": STAGE_COL[st] } as CSSProperties}
            />
            {st ? STAGE[st] : "デジタル施策なし"}
          </span>
        ))}
      </div>
      {flow.map((f, k) => (
        <div key={f.k}>
          <div
            className="fl-row"
            style={{ "--d": `${k * 140}ms` } as CSSProperties}
          >
            <span className="fl-name">
              <b>{STEP[k]}</b>
            </span>
            <div className="fl-track">
              <div className="fl-bar" style={{ width: `${(f.n / N) * 100}%` }}>
                {[1, 2, 3, 0].map((st) =>
                  f.byStage[st] ? (
                    <i
                      key={st}
                      style={{
                        flexGrow: f.byStage[st],
                        background: STAGE_COL[st],
                      }}
                      title={`${STAGE[st] === "未到達" ? "デジタル施策なし" : STAGE[st]}：${f.byStage[st]}事業`}
                    />
                  ) : null,
                )}
              </div>
            </div>
            <span className="fl-n">
              <b>{f.n}</b>事業
              <em>{Math.round((f.n / N) * 100)}%</em>
            </span>
          </div>
          {k < flow.length - 1 ? (
            <div
              className={`fl-drop${k === worst ? " worst" : ""}`}
              style={{ "--d": `${k * 140 + 70}ms` } as CSSProperties}
            >
              <span className="fl-arrow">▼</span>
              <span>
                {STOP[k]}：<b>{drops[k]}事業</b>
                {f.n ? `（この段の${Math.round((drops[k] / f.n) * 100)}%）` : ""}
              </span>
              {k === worst ? <span className="fl-tag">最大の詰まり</span> : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
