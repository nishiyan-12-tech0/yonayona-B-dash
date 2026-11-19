import { PROG, STAGE } from "@/lib/constants";
import type { Stage, StageCells } from "@/lib/types";

/** 1つの時点の位置 */
export interface GridStep {
  st: number;
  p: number;
  /** 時点の名前（例：現在、第2版 2026年12月末） */
  label: string;
}

export interface GridPoint {
  name: string;
  short: string;
  color: string;
  /** 時点ごとの位置。新しい順（[0] が塗りの点＝表示している時点、残りが白抜きの点＝それより前の版） */
  trail: GridStep[];
}

/** 図の大きさ。lg＝他社と比べる（横いっぱい）、sm＝参加企業の集計（今までの大きさ） */
export type GridSize = "lg" | "sm";

function geom(size: GridSize) {
  const k = size === "lg" ? 1.3 : 1;
  const W = size === "lg" ? 1160 : 700;
  const L = Math.round(158 * k);
  const T = Math.round(22 * k);
  const CW = (W - L - 6) / 5;
  const CH = Math.round(92 * k);
  const H = T + CH * 3 + 8;
  return {
    k,
    W,
    L,
    T,
    CW,
    CH,
    H,
    cx: (p: number) => L + CW * p + CW / 2,
    cy: (st: number) => T + CH * (3 - st) + CH / 2,
  };
}
const ROWS: Stage[] = [3, 2, 1];

/** マス目：横＝道筋の進み（0〜4）、縦＝DXの段階（1〜3）。cells は割合(%)、points は自社の事業 */
export function GridChart({
  cells,
  points,
  label,
  size = "sm",
}: {
  cells: StageCells;
  points: GridPoint[];
  label: string;
  size?: GridSize;
}) {
  const { k, W, L, T, CW, CH, H, cx, cy } = geom(size);
  const fs = (n: number) => (n * k).toFixed(1);
  const mx = Math.max(1, ...ROWS.flatMap((r) => cells[r]));
  // 自社の点：事業ごとに縦にずらす。同じ事業の古い点が同じマスに重なるときは左にずらす
  const pts = points.map((q, n) => {
    const off = ((n - (points.length - 1) / 2) * 22 + 8) * k;
    const steps = q.trail.map((s, j) => {
      const same = q.trail
        .slice(0, j)
        .filter((x) => x.st === s.st && x.p === s.p).length;
      return { ...s, x: cx(s.p) - 34 * k - same * 15 * k, y: cy(s.st) + off };
    });
    return { ...q, steps };
  });
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{ maxWidth: size === "lg" ? "100%" : W, display: "block" }}
    >
      {PROG.map((t, p) => (
        <text
          key={p}
          x={cx(p)}
          y={14 * k}
          textAnchor="middle"
          fontSize={fs(11.5)}
          fontWeight={p ? 700 : 400}
          fill={p ? "var(--ink)" : "var(--muted)"}
        >
          {p ? t : "まだ動いていない"}
        </text>
      ))}
      {ROWS.map((st) => (
        <g key={st}>
          <text
            x={L - 10}
            y={cy(st) + 4}
            textAnchor="end"
            fontSize={fs(11.5)}
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
                x={L + CW * p + 10 * k}
                y={T + CH * (3 - st) + 18 * k}
                fontSize={fs(11)}
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
                  (s, j) =>
                    `${j === line.length - 1 ? s.x - 9 * k : s.x},${s.y}`,
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
                r={6 * k}
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
              r={8 * k}
              fill={q.color}
              stroke="var(--surface)"
              strokeWidth={1.5}
            >
              <title>{`${q.name}（${s.label}）：${STAGE[s.st]}・${PROG[s.p]}`}</title>
            </circle>
            <text
              x={s.x + 12 * k}
              y={s.y + 4 * k}
              fontSize={fs(11)}
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
