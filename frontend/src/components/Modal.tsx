"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";

/**
 * ポップアップの枠。「×」「Esc」・外側を押すと onClose。
 * dirty（書きかけ）のときは、閉じる前に確かめる。
 */
export function Modal({
  title,
  crumb,
  dirty,
  onClose,
  children,
}: {
  title: string;
  crumb?: string;
  dirty?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const tryClose = useCallback(() => {
    if (!dirty || window.confirm("入力を捨てますか？")) onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tryClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryClose]);

  // 開いたら最初の入力欄へ
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, []);

  return (
    <div
      className="modal-bg"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tryClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={box}
      >
        <div className="ph">
          <span className="kb">{crumb ?? ""}</span>
          <button className="px" aria-label="閉じる" onClick={() => tryClose()}>
            ×
          </button>
        </div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/** ポップアップの1行（見出し＋入力欄） */
export function MRow({
  label,
  req,
  htmlFor,
  children,
}: {
  label: string;
  req?: boolean;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mrow">
      <label htmlFor={htmlFor} className={req ? "req" : undefined}>
        {label}
      </label>
      <div>{children}</div>
    </div>
  );
}

/** 入力した人の名前を、次に開いたときにも入れておく（ブラウザごと） */
const AUTHOR_KEY = "michisuji.author";
export function lastAuthor(): string {
  try {
    return window.localStorage.getItem(AUTHOR_KEY) ?? "";
  } catch {
    return "";
  }
}
export function rememberAuthor(name: string) {
  try {
    window.localStorage.setItem(AUTHOR_KEY, name);
  } catch {
    // 保存できなくてもよい
  }
}

/** 今日（YYYY-MM-DD、手元の時刻） */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
