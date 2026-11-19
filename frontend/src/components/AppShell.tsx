"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { StoreProvider } from "@/lib/store";
import { Logo } from "./Logo";

const TABS = [
  { href: "/entry", label: "申請" },
  { href: "/map", label: "戦略マップ" },
  { href: "/compare", label: "他社と比べる" },
  { href: "/meti", label: "参加企業の集計" },
];

/** 全画面で共通の枠（ロゴと画面の切り替え） */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app">
      <div className="bar">
        <div className="brand">
          <Logo />
        </div>
      </div>
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
      <StoreProvider>{children}</StoreProvider>
    </div>
  );
}
