import { PROG, STAGE } from "@/lib/constants";
import type { Stage, StageCells } from "@/lib/types";

/** 確定版1つぶんの位置 */
export interface GridStep {
  st: number;
  p: number;
  /** 確定版の期間（例：2026年9月末） */
  label: string;
}

export interface GridPoint {
  name: string;
  short: string;
  color: string;
  /** 確定版ごとの位置。新しい順（[0] がいちばん新しい＝塗りの点） */
  trail: GridStep[];
}

const W = 700;
const L = 158;
const T = 34;
const CW = (W - L - 6) / 5;
const CH = 92;
const H = T + CH * 3 + 8;
const cx = (p: number) => L + CW * p + CW / 2;
const cy = (st: number) => T + CH * (3 - st) + CH / 2;
const ROWS: Stage[] = [3, 2, 1];

/** マス目：横＝道筋の進み（0〜4）、縦＝DXの段階（1〜3）。cells は割合(%)、points は自社の事業 */
export function GridChart({
  cells,
  points,
  label,
}: {
  cells: StageCells;
  points: GridPoint[];
  label: string;
}) {
  const mx = Math.max(1, ...ROWS.flatMap((r) => cells[r]));
  // 自社の点：事業ごとに縦にずらす。同じ事業の古い点が同じマスに重なるときは左にずらす
  const pts = points.map((q, n) => {
    const off = (n - (points.length - 1) / 2) * 22 + 8;
    const steps = q.trail.map((s, j) => {
      const same = q.trail
        .slice(0, j)
        .filter((x) => x.st === s.st && x.p === s.p).length;
      return { ...s, x: cx(s.p) - 34 - same * 15, y: cy(s.st) + off };
    });
    return { ...q, steps };
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{ maxWidth: W, display: "block" }}
    >
      {PROG.map((t, p) => (
        <text
          key={p}
          x={cx(p)}
          y={14}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight={p ? 700 : 400}
          fill={p ? "var(--ink)" : "var(--muted)"}
        >
          {p ? t : "まだ動いていない"}
        </text>
      ))}
      <text x={L + CW} y={28} fontSize="10.5" fill="var(--muted)">
        道筋の進み（先行）
      </text>
      <text
        x={W - 8}
        y={28}
        textAnchor="end"
        fontSize="10.5"
        fill="var(--muted)"
      >
        （遅行）→
      </text>
      {ROWS.map((st) => (
        <g key={st}>
          <text
            x={L - 10}
            y={cy(st) + 4}
            textAnchor="end"
            fontSize="11.5"
            fontWeight={700}
            fill="var(--ink)"
          >
            {STAGE[st]}
          </text>
          {cells[st].map((v, p) => (
            <g key={p}>
              <rect
                x={L + CW * p + 2}
                y={T + CH * (3 - st) + 2}
                width={CW - 4}
                height={CH - 4}
                rx={8}
                fill="var(--accent-2)"
                fillOpacity={((v / mx) * 0.5).toFixed(2)}
                stroke="var(--line)"
              />
              <text
                x={L + CW * p + 10}
                y={T + CH * (3 - st) + 18}
                fontSize="11"
                fill="var(--muted)"
              >
                {v ? v + "%" : ""}
              </text>
            </g>
          ))}
        </g>
      ))}
      {pts.map((q) => {
        const old = q.steps.slice(1);
        if (!old.length) return null;
        // 古い順に線でつなぐ（軌跡）
        const line = [...q.steps].reverse();
        return (
          <g key={q.name + "-trail"}>
            <polyline
              points={line
                .map(
                  (s, j) => `${j === line.length - 1 ? s.x - 9 : s.x},${s.y}`,
                )
                .join(" ")}
              fill="none"
              stroke={q.color}
              strokeWidth={2}
              strokeDasharray="4 3"
              strokeOpacity={0.8}
            />
            {old.map((s, j) => (
              <circle
                key={s.label}
                cx={s.x}
                cy={s.y}
                r={6}
                fill="var(--surface)"
                stroke={q.color}
                strokeWidth={2}
                opacity={Math.max(0.35, 1 - j * 0.18)}
              >
                <title>{`${q.name}（${s.label}）：${STAGE[s.st]}・${PROG[s.p]}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
      {pts.map((q) => {
        const s = q.steps[0];
        if (!s) return null;
        return (
          <g key={q.name}>
            <circle
              cx={s.x}
              cy={s.y}
              r={8}
              fill={q.color}
              stroke="var(--surface)"
              strokeWidth={1.5}
            >
              <title>{`${q.name}（${s.label}）：${STAGE[s.st]}・${PROG[s.p]}`}</title>
            </circle>
            <text
              x={s.x + 12}
              y={s.y + 4}
              fontSize="11"
              fontWeight={700}
              fill="var(--ink)"
            >
              {q.short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
