import type { MetiMix } from "@/lib/types";

const W = 560;
const H = 400;
const L = 54;
const R = 16;
const T = 24;
const B = 50;
const x = (v: number) => L + ((W - L - R) * v) / 100;
const y = (v: number) => T + ((H - T - B) * (100 - v)) / 100;

/** 道筋の進みで点を塗り分ける */
const group = (p: number) => (p >= 3 ? 2 : p === 2 ? 1 : 0);
const GCOL = ["var(--faint)", "var(--amber)", "var(--accent)"];
export const GNAME = ["学習と成長まで（またはまだ）", "業務プロセスで止まっている", "顧客・財務まで進んだ"];

/**
 * 宣言と実態の散布図。1点＝1事業。横＝宣言（申請のスライダー）、縦＝実態（施策がつながる財務の目標）。
 * 斜めの線より下＝宣言より施策が生産性向上に寄っている。20ポイント以上下の帯を塗る
 */
export function MixScatter({ mix }: { mix: MetiMix }) {
  // 同じ値の点が重ならないよう、決まったずらし方で少しずらす
  const seen = new Map<string, number>();
  const pts = mix.points.map((q) => {
    const k = `${q.plan}-${q.actual}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    const a = n * 2.4;
    const r = n ? 3 + n * 1.3 : 0;
    return { ...q, cx: x(q.plan) + Math.cos(a) * r, cy: y(q.actual) + Math.sin(a) * r };
  });
  const ticks = [0, 20, 40, 60, 80, 100];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="宣言と実態の散布図" style={{ display: "block" }}>
      {/* 生産性に寄っている帯（実態 ≦ 宣言 − 20） */}
      <polygon
        points={`${x(20)},${y(0)} ${x(100)},${y(80)} ${x(100)},${y(0)}`}
        fill="var(--amber)"
        fillOpacity={0.1}
      />
      <text x={x(97)} y={y(6)} textAnchor="end" fontSize={12} fill="var(--amber)" fontWeight={700}>
        宣言より生産性向上に寄っている
      </text>
      <text x={x(3)} y={y(94)} fontSize={12} fill="var(--muted)">
        宣言より収益増大に寄っている
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(100)} stroke="var(--line)" />
          <line x1={x(0)} x2={x(100)} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={x(t)} y={y(0) + 16} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {t}%
          </text>
          <text x={x(0) - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
            {t}%
          </text>
        </g>
      ))}
      <line
        x1={x(0)}
        y1={y(0)}
        x2={x(100)}
        y2={y(100)}
        stroke="var(--muted)"
        strokeDasharray="5 4"
      />
      <text
        x={x(78)}
        y={y(78) - 8}
        fontSize={11}
        fill="var(--muted)"
        transform={`rotate(${(-Math.atan((H - T - B) / (W - L - R)) * 180) / Math.PI} ${x(78)} ${y(78) - 8})`}
      >
        宣言どおり
      </text>
      {/* 平均の移動：宣言の平均 → 実態の平均 */}
      <line
        x1={x(mix.planAvg)}
        y1={y(mix.planAvg)}
        x2={x(mix.planAvg)}
        y2={y(mix.actualAvg)}
        stroke="var(--ng)"
        strokeWidth={2}
        markerEnd="url(#mixah)"
      />
      <defs>
        <marker id="mixah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0L10,5L0,10z" style={{ fill: "var(--ng)" }} />
        </marker>
      </defs>
      {pts.map((q, i) => (
        <circle
          key={i}
          className="mx-pt"
          cx={q.cx}
          cy={q.cy}
          r={4.5}
          fill={GCOL[group(q.p)]}
          fillOpacity={0.8}
          stroke="var(--surface)"
          strokeWidth={1}
          style={{ animationDelay: `${(i % 40) * 18}ms` }}
        >
          <title>{`宣言 収益増大${q.plan}% → 実態 ${q.actual}%`}</title>
        </circle>
      ))}
      <text
        x={x(mix.planAvg) + 8}
        y={(y(mix.planAvg) + y(mix.actualAvg)) / 2}
        fontSize={12}
        fontWeight={700}
        fill="var(--ng)"
        stroke="var(--surface)"
        strokeWidth={4}
        paintOrder="stroke"
      >
        平均 {mix.planAvg}% → {mix.actualAvg}%
      </text>
      <text x={(x(0) + x(100)) / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="var(--ink)" fontWeight={700}>
        宣言：差のうち収益増大で埋める割合（申請のスライダー）
      </text>
      <text
        x={14}
        y={(y(0) + y(100)) / 2}
        textAnchor="middle"
        fontSize={12}
        fill="var(--ink)"
        fontWeight={700}
        transform={`rotate(-90 14 ${(y(0) + y(100)) / 2})`}
      >
        実態：収益増大につながる施策
      </text>
    </svg>
  );
}
