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

/** 全画面で共通の枠（左に画面の切り替え、右にロゴ） */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="app">
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
          <Logo />
        </div>
      </div>
      <StoreProvider>{children}</StoreProvider>
    </div>
  );
}
