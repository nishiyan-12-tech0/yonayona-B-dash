"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ApiError, resetDemo } from "@/lib/api";
import { StoreProvider, useStore } from "@/lib/store";
import { Logo } from "./Logo";
import { Modal } from "./Modal";

const TABS = [
  { href: "/entry", label: "申請" },
  { href: "/map", label: "戦略マップ" },
  { href: "/compare", label: "他社と比べる" },
  { href: "/meti", label: "参加企業の集計" },
];

/** 全画面で共通の枠（左に画面の切り替え、右にロゴ） */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app">
      <StoreProvider>
        <div className="bar">
          <nav className="tabs" aria-label="画面の切り替え">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={pathname === t.href ? "page" : "false"}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <div className="brand">
            <ResetLogo />
          </div>
        </div>
        {children}
      </StoreProvider>
    </div>
  );
}

/** 右上のロゴ。押すと「デモを初期状態に戻す」の確認を出す（展示の係が使う） */
function ResetLogo() {
  const { refresh, setUi } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = async () => {
    setBusy(true);
    setErr(null);
    try {
      await resetDemo();
      await refresh();
      setUi({ step: 0, ebu: null, sel: null, cb: null, ct: null, snap: "now" });
      setOpen(false);
      router.push("/entry");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "初期状態に戻せませんでした");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        className="logo-btn"
        onClick={() => setOpen(true)}
        aria-label="ミチスジ（デモを初期状態に戻す）"
      >
        <Logo />
      </button>
      {open ? (
        <Modal title="デモを初期状態に戻す" onClose={() => setOpen(false)}>
          <p>デモを初期状態に戻しますか？</p>
          <p className="small muted">
            申請・戦略マップ・進捗・版をすべて消し、申請が入力済みの状態に戻します。
          </p>
          {err ? <p className="merr">{err}</p> : null}
          <div className="mfoot">
            <button className="btn" onClick={() => setOpen(false)} disabled={busy}>
              やめる
            </button>
            <button className="btn pri" onClick={reset} disabled={busy}>
              {busy ? "戻しています…" : "戻す"}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
