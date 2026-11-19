import type { FinMix } from "@/lib/logic";
import { Info } from "./Info";

/** 宣言と実態のずれの言い方（差が20ポイント以上で「寄っている」とする） */
export function mixGapText(m: FinMix) {
  if (m.actual === null) return "財務の目標までつながる施策がまだない";
  const d = m.actual - m.plan;
  if (d <= -20) return "宣言より生産性向上に寄っている";
  if (d >= 20) return "宣言より収益増大に寄っている";
  return "宣言とおおむね一致";
}

/** 1本の帯（左＝収益増大、右＝生産性向上） */
function Split({
  g,
  label,
  compact,
}: {
  g: number;
  label: string;
  compact?: boolean;
}) {
  // 小さい版は数字だけ（名前は下の凡例で示す）
  const t = (name: string, v: number) =>
    v < (compact ? 14 : 18) ? "" : compact ? `${v}%` : `${name} ${v}%`;
  return (
    <div className="fm-row">
      <span className="fm-l">{label}</span>
      <div className="fm-bar" title={`収益増大 ${g}%／生産性向上 ${100 - g}%`}>
        <i className="rev" style={{ width: `${g}%` }}>
          {t("収益増大", g)}
        </i>
        <i className="prod" style={{ width: `${100 - g}%` }}>
          {t("生産性向上", 100 - g)}
        </i>
      </div>
    </div>
  );
}

/**
 * 財務の差を何で埋めるか：宣言（申請のスライダー）と実態（施策がつながる財務の目標）を並べる。
 * compact＝戦略マップの財務の列に置く小さい版
 */
export function FinMixBar({ mix, compact }: { mix: FinMix; compact?: boolean }) {
  const d = mix.actual === null ? 0 : Math.abs(mix.actual - mix.plan);
  return (
    <div className={`fmix${compact ? " compact" : ""}${d >= 20 ? " gap" : ""}`}>
      <div className="fm-h">
        <b>財務の差を何で埋めるか</b>
        <Info>
          宣言＝申請で決めた「差のうち収益増大で埋める割合」。実態＝この事業の施策が、つながりをたどってどちらの財務の目標に行き着くかを施策の数で数えた割合（両方に行き着く施策は半分ずつ）。生産性向上は早く効き、収益増大は時間がかかるため、短期の成果を求められると生産性に偏りやすい、という考え方に基づきます。
        </Info>
      </div>
      {compact ? (
        <div className="fm-key">
          <span>
            <u className="rev" />
            収益増大
          </span>
          <span>
            <u className="prod" />
            生産性向上
          </span>
        </div>
      ) : null}
      <Split g={mix.plan} label="宣言" compact={compact} />
      {mix.actual === null ? (
        <div className="fm-none small muted">実態：財務の目標までつながる施策がまだありません</div>
      ) : (
        <Split g={mix.actual} label="実態" compact={compact} />
      )}
      <div className="fm-note">
        <span className="fm-tag">{mixGapText(mix)}</span>
        {mix.actual !== null ? (
          <span className="muted">
            施策{mix.n}件から
            {mix.none ? `（財務につながらない施策${mix.none}件は除く）` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
