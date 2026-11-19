import { PROG } from "@/lib/constants";

/** 道筋の進みの4段のバー。was＝比べる時点（前の確定版）の進み（薄い色で出す） */
export function Track({ p, was = 0 }: { p: number; was?: number }) {
  return (
    <>
      <div className="trk">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} className={n <= p ? "on" : was && n <= was ? "was" : ""} />
        ))}
      </div>
      <div className="trkl">
        {[1, 2, 3, 4].map((n) => (
          <span key={n}>{PROG[n]}</span>
        ))}
      </div>
    </>
  );
}
