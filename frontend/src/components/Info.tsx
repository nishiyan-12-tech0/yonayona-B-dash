"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** 補足の吹き出しの幅 */
const W = 320;

type Pos = { left: number; top?: number; bottom?: number };

/**
 * 補足の「ⓘ」。ふだんは出さず、カーソルを合わせる・タップする・フォーカスすると出る。
 * 地図やカードのはみ出し（overflow）で切れないよう、吹き出しは画面に固定して出す。
 */
export function Info({
  children,
  label = "補足を表示",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(
      Math.max(r.left + r.width / 2 - W / 2, 8),
      window.innerWidth - W - 8,
    );
    // 画面の下のほうなら上に出す
    setPos(
      r.bottom > window.innerHeight * 0.6
        ? { left, bottom: window.innerHeight - r.top + 6 }
        : { left, top: r.bottom + 6 },
    );
  };
  const hide = () => setPos(null);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  return (
    <span className="info" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={btn}
        type="button"
        className="info-btn"
        aria-label={label}
        aria-describedby={pos ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          show();
        }}
        onFocus={show}
        onBlur={hide}
      >
        i
      </button>
      {pos ? (
        <span
          role="tooltip"
          id={id}
          className="info-pop"
          style={{ ...pos, width: W }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
