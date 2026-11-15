import { PROG, STAGE } from '@/lib/constants';
import type { Stage, StageCells } from '@/lib/types';

export interface GridPoint {
  name: string;
  short: string;
  color: string;
  st: number;
  p: number;
  /** 2026年3月末の位置 */
  st0: number;
  p0: number;
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
export function GridChart({ cells, points, label }: { cells: StageCells; points: GridPoint[]; label: string }) {
  const mx = Math.max(1, ...ROWS.flatMap((r) => cells[r]));
  // 自社の点：同じマスに重なるときは縦にずらす
  const pts = points.map((q, n) => {
    const off = (n - (points.length - 1) / 2) * 22 + 8;
    return { ...q, off, x: cx(q.p) - 34, y: cy(q.st) + off };
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ maxWidth: W, display: 'block' }}>
      {PROG.map((t, p) => (
        <text
          key={p}
          x={cx(p)}
          y={14}
          textAnchor="middle"
          fontSize="11.5"
          fontWeight={p ? 700 : 400}
          fill={p ? 'var(--ink)' : 'var(--muted)'}
        >
          {p ? t : 'まだ動いていない'}
        </text>
      ))}
      <text x={L + CW} y={28} fontSize="10.5" fill="var(--muted)">
        道筋の進み（先行）
      </text>
      <text x={W - 8} y={28} textAnchor="end" fontSize="10.5" fill="var(--muted)">
        （遅行）→
      </text>
      {ROWS.map((st) => (
        <g key={st}>
          <text x={L - 10} y={cy(st) + 4} textAnchor="end" fontSize="11.5" fontWeight={700} fill="var(--ink)">
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
              <text x={L + CW * p + 10} y={T + CH * (3 - st) + 18} fontSize="11" fill="var(--muted)">
                {v ? v + '%' : ''}
              </text>
            </g>
          ))}
        </g>
      ))}
      {pts.map((q) => {
        if (!(q.st0 && (q.st0 !== q.st || q.p0 !== q.p))) return null;
        const x0 = cx(q.p0) - 34;
        const y0 = cy(q.st0) + q.off;
        return (
          <g key={q.name}>
            <line x1={x0} y1={y0} x2={q.x - 9} y2={q.y} stroke={q.color} strokeWidth={2} strokeDasharray="4 3" />
            <circle cx={x0} cy={y0} r={6} fill="var(--surface)" stroke={q.color} strokeWidth={2}>
              <title>{`${q.name}（2026年3月末）`}</title>
            </circle>
          </g>
        );
      })}
      {pts.map((q) => (
        <g key={q.name}>
          <circle cx={q.x} cy={q.y} r={8} fill={q.color} stroke="var(--surface)" strokeWidth={1.5}>
            <title>{`${q.name}：${STAGE[q.st]}・${PROG[q.p]}`}</title>
          </circle>
          <text x={q.x + 12} y={q.y + 4} fontSize="11" fontWeight={700} fill="var(--ink)">
            {q.short}
          </text>
        </g>
      ))}
    </svg>
  );
}
