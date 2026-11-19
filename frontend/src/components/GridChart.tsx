import { useEffect, useRef, useState } from "react";
import { PROG, STAGE } from "@/lib/constants";
import type { Stage, StageCells } from "@/lib/types";

/** 1つの時点の位置 */
export interface GridStep {
  st: number;
  p: number;
  /** 時点の名前（例：現在、第2版 2026年12月末） */
  label: string;
  /** 時点の日付（ISO。例：2026-12-31）。点の横に「26/12/31」と書く */
  date?: string;
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
export function GridChart(props: {
  cells: StageCells;
  points: GridPoint[];
  label: string;
  size?: GridSize;
}) {
  return props.size === "lg" ? <WideGrid {...props} /> : <SmallGrid {...props} />;
}

function SmallGrid({
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

/** 「2026-12-31」→「26/12/31」 */
export function shortDate(iso?: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[1].slice(2)}/${Number(m[2])}/${Number(m[3])}` : "";
}

/**
 * 他社と比べる用の大きいマス目。描く幅を実際の画面の幅に合わせ（1単位＝1px）、
 * 文字はほかの文字と同じ大きさのまま、マスだけを画面いっぱいに広げる。
 * 点は小さくし、同じマスに入る点は古い順に左から並べて、日付を添える。
 */
function WideGrid({
  cells,
  points,
  label,
}: {
  cells: StageCells;
  points: GridPoint[];
  label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1200);
  const [vh, setVh] = useState(900);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      setW(Math.max(640, Math.round(el.clientWidth)));
      setVh(window.innerHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const L = 150;
  const T = 26;
  const CW = (W - L - 4) / 5;
  const CH = Math.round(Math.min(250, Math.max(150, (vh - 300) / 3)));
  const H = T + CH * 3 + 6;
  const cx0 = (p: number) => L + CW * p;
  const cy = (st: number) => T + CH * (3 - st) + CH / 2;
  const mx = Math.max(1, ...ROWS.flatMap((r) => cells[r]));

  // 事業ごとに、マスの中の高さ（レーン）を分ける
  const N = Math.max(1, points.length);
  const laneGap = Math.min(52, (CH - 34) / N);
  const pts = points.map((q, n) => {
    const dy = (n - (N - 1) / 2) * laneGap + 6;
    // 古い順に並べ直し、マスごとに左から詰める
    const asc = q.trail.map((s, j) => ({ ...s, latest: j === 0 })).reverse();
    const byCell = new Map<string, number>();
    asc.forEach((s) => {
      const k = `${s.st}-${s.p}`;
      byCell.set(k, (byCell.get(k) ?? 0) + 1);
    });
    const seen = new Map<string, number>();
    const steps = asc.map((s) => {
      const k = `${s.st}-${s.p}`;
      const i = seen.get(k) ?? 0;
      seen.set(k, i + 1);
      const cnt = byCell.get(k) ?? 1;
      // 最新の点の右に事業名を書くので、その分を空けておく
      const room = CW - 30 - (s.latest || i === cnt - 1 ? 46 : 0);
      const step = Math.min(30, room / Math.max(1, cnt));
      return {
        ...s,
        x: cx0(s.p) + 16 + i * step,
        y: cy(s.st) + dy,
        idx: i,
        cnt,
        step,
      };
    });
    return { ...q, steps };
  });

  return (
    <div ref={wrap} style={{ width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        role="img"
        aria-label={label}
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        {PROG.map((t, p) => (
          <text
            key={p}
            x={cx0(p) + CW / 2}
            y={16}
            textAnchor="middle"
            fontSize={12.5}
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
              fontSize={12.5}
              fontWeight={700}
              fill="var(--ink)"
            >
              {STAGE[st]}
            </text>
            {cells[st].map((v, p) => (
              <g key={p}>
                <rect
                  x={cx0(p) + 2}
                  y={T + CH * (3 - st) + 2}
                  width={CW - 4}
                  height={CH - 4}
                  rx={10}
                  fill="var(--accent-2)"
                  fillOpacity={((v / mx) * 0.5).toFixed(2)}
                  stroke="var(--line)"
                />
                <text
                  x={cx0(p) + 10}
                  y={T + CH * (3 - st) + 18}
                  fontSize={12}
                  fill="var(--muted)"
                >
                  {v ? v + "%" : ""}
                </text>
              </g>
            ))}
          </g>
        ))}
        {pts.map((q) => (
          <polyline
            key={q.name + "-line"}
            points={q.steps.map((s) => `${s.x},${s.y}`).join(" ")}
            fill="none"
            stroke={q.color}
            strokeWidth={1.3}
            strokeDasharray="3 3"
            strokeOpacity={0.7}
          />
        ))}
        {pts.map((q) =>
          q.steps.map((s, j) => {
            // 混んでいるマスでは、日付はマスの最初・最後と最新の点だけに書く
            const showDate =
              s.step >= 22 || s.latest || s.idx === 0 || s.idx === s.cnt - 1;
            const up = j % 2 === 0;
            const tip = `${q.name}（${s.label}${s.date ? "・" + shortDate(s.date) : ""}）：${STAGE[s.st]}・${PROG[s.p]}`;
            return (
              <g key={q.name + j}>
                {s.latest ? (
                  <circle cx={s.x} cy={s.y} r={9} fill={q.color} opacity={0.18} />
                ) : null}
                <circle
                  cx={s.x}
                  cy={s.y}
                  r={s.latest ? 5 : 3.4}
                  fill={s.latest ? q.color : "var(--surface)"}
                  stroke={s.latest ? "var(--surface)" : q.color}
                  strokeWidth={s.latest ? 1.2 : 1.6}
                >
                  <title>{tip}</title>
                </circle>
                {showDate && s.date ? (
                  <text
                    x={s.x}
                    y={up ? s.y - 8 : s.y + 15}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={s.latest ? 700 : 400}
                    fill={s.latest ? "var(--ink)" : "var(--muted)"}
                  >
                    {shortDate(s.date)}
                  </text>
                ) : null}
                {s.latest ? (
                  <text
                    x={s.x + 10}
                    y={s.y + 4}
                    fontSize={12}
                    fontWeight={700}
                    fill="var(--ink)"
                  >
                    {q.short}
                  </text>
                ) : null}
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
