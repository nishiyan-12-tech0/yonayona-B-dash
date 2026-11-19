import type { CSSProperties } from "react";
import type { MetiHint } from "@/lib/types";

/** 経産省の次の一手の示唆（当てはまる割合が大きい順） */
export function Hints({ hints }: { hints: MetiHint[] }) {
  return (
    <ol className="hints">
      {hints.map((h, i) => (
        <li
          key={h.key}
          className={i === 0 ? "top" : undefined}
          style={{ "--d": `${i * 120}ms` } as CSSProperties}
        >
          <div className="hn">{i + 1}</div>
          <div className="hb">
            <div className="hw">
              <span className="hwhere">{h.where}</span>
              <span className="hshare">
                <b>{h.share}%</b>
                <span className="muted small">
                  （{h.n}
                  {h.unit}）
                </span>
              </span>
            </div>
            <div className="ht">{h.title}</div>
            <div className="hbar">
              <i style={{ width: `${Math.min(100, h.share)}%` }} />
            </div>
            <div className="hf small muted">{h.fact}</div>
            <div className="hm">
              <span>次の一手（示唆）</span>
              {h.move}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
