"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { ApplicationMeta, MapVersionMeta } from "@/lib/types";

/**
 * 過去を見る（設計書 v0.4 の 4-1）。各画面の左上の「過去を見る」から、左にサイドメニューを出す。
 * 過去は見るだけ。入力・版を作る・作り直しは「現在」のときだけ。
 */

/** 表示しているもの */
export type Hist =
  /** 現在（申請画面では現在の申請、戦略マップ・他社比較・集計では日々の進捗） */
  | { kind: "now" }
  /** 作成中の申請（申請画面だけ） */
  | { kind: "draft" }
  /** 過去の申請の内容（申請画面だけ） */
  | { kind: "app"; id: number }
  /** 版 */
  | { kind: "version"; id: number; appId: number };

/** 申請画面／戦略マップ・他社と比べる／参加企業の集計 */
export type HistMode = "entry" | "map" | "meti";

/** 「2026-11-20T01:25…」→「2026年11月20日」（time なら「2026年11月20日 1:25」） */
export function dateJa(iso: string, time = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso || "");
  if (!m) return "";
  const d = `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
  return time && m[4] ? `${d} ${Number(m[4])}:${m[5]}` : d;
}

/** 「2026年11月20日の申請」。同じ日に申請がほかにもあれば、時刻も付ける */
export const appName = (
  a: Pick<ApplicationMeta, "id" | "submittedAt">,
  apps: Pick<ApplicationMeta, "id" | "submittedAt">[] = [],
) => {
  const day = a.submittedAt.slice(0, 10);
  const dup = apps.some((x) => x.id !== a.id && x.submittedAt.slice(0, 10) === day);
  return `${dateJa(a.submittedAt, dup)}の申請`;
};

/** 版の時点の名前（作成時点・置き換え時点は日付を添える） */
export const versionWhen = (v: MapVersionMeta) =>
  v.kind === "manual" ? v.label : `${v.label}（${dateJa(v.asOf)}）`;

/** 参加企業の集計のメニューの名前。作成時点・置き換え時点が同じ日にほかにもあれば、時刻も付ける */
function metiWhen(v: MapVersionMeta, apps: ApplicationMeta[]) {
  if (v.kind === "manual") return v.label;
  const dup = apps
    .flatMap((a) => a.versions)
    .some(
      (x) =>
        x.id !== v.id &&
        x.kind !== "manual" &&
        x.asOf === v.asOf,
    );
  return `${v.label}（${dup ? dateJa(v.createdAt, true) : dateJa(v.asOf)}）`;
}

/** 「第2版　2026年12月末」 */
export const versionName = (v: MapVersionMeta) =>
  `第${v.no}版　${versionWhen(v)}`;

const same = (a: Hist, b: Hist) =>
  a.kind === b.kind &&
  (a.kind === "now" ||
    a.kind === "draft" ||
    (a as { id: number }).id === (b as { id: number }).id);

/** 表示しているものの名前 */
export function histLabel(
  h: Hist,
  mode: HistMode,
  apps: ApplicationMeta[],
): string {
  const cur = apps.find((a) => a.current);
  if (h.kind === "draft") return "作成中の申請";
  if (h.kind === "now") {
    if (mode === "entry")
      return cur ? `${appName(cur, apps)}（現在）` : "作成中の申請";
    return "現在";
  }
  if (h.kind === "app") {
    const a = apps.find((x) => x.id === h.id);
    return a ? appName(a, apps) : "過去の申請";
  }
  const a = apps.find((x) => x.id === h.appId);
  const v = a?.versions.find((x) => x.id === h.id);
  if (!a || !v) return "過去の版";
  return mode === "meti"
    ? metiWhen(v, apps)
    : `${appName(a, apps)}　${versionName(v)}`;
}

/** 画面の上の「表示中：○○　過去を見る」と、過去を表示中の帯と、サイドメニュー */
export function History({
  mode,
  value,
  onChange,
}: {
  mode: HistMode;
  value: Hist;
  onChange: (h: Hist) => void;
}) {
  const { apps, draft } = useStore();
  const [open, setOpen] = useState(false);
  const past = value.kind === "app" || value.kind === "version";
  const label = histLabel(value, mode, apps);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const pick = (h: Hist) => {
    onChange(h);
    setOpen(false);
  };
  const item = (key: string, h: Hist, children: ReactNode) => (
    <li key={key}>
      <button
        aria-current={same(h, value) ? "true" : "false"}
        onClick={() => pick(h)}
      >
        {children}
      </button>
    </li>
  );

  const nowHist: Hist = { kind: "now" };
  let menu: ReactNode;
  if (mode === "entry") {
    menu = (
      <ul className="hlist">
        {draft ? item("draft", { kind: "draft" }, "作成中") : null}
        {apps.map((a) =>
          item(
            `a${a.id}`,
            a.current ? nowHist : { kind: "app", id: a.id },
            <>
              {appName(a, apps)}
              {a.current ? <span className="hnow">現在</span> : null}
            </>,
          ),
        )}
      </ul>
    );
  } else if (mode === "map") {
    menu = apps.map((a) => (
      <div className="hgrp" key={a.id}>
        <div className="hgt">
          {appName(a, apps)}
          {a.current ? <span className="hnow">現在</span> : null}
        </div>
        <ul className="hlist">
          {a.current
            ? item(
                "now",
                nowHist,
                <>
                  現在<span className="muted small">（日々の進捗）</span>
                </>,
              )
            : null}
          {a.versions.map((v) =>
            item(
              `v${v.id}`,
              { kind: "version", id: v.id, appId: a.id },
              versionName(v),
            ),
          )}
        </ul>
      </div>
    ));
  } else {
    const all = apps
      .flatMap((a) => a.versions.map((v) => ({ a, v })))
      .sort(
        (x, y) =>
          y.v.asOf.localeCompare(x.v.asOf) ||
          y.v.createdAt.localeCompare(x.v.createdAt),
      );
    menu = (
      <ul className="hlist">
        {item("now", nowHist, "現在")}
        {all.map(({ a, v }) =>
          item(
            `v${v.id}`,
            { kind: "version", id: v.id, appId: a.id },
            metiWhen(v, apps),
          ),
        )}
      </ul>
    );
  }

  return (
    <>
      <div className="hbar">
        <span className="small muted">表示中：</span>
        <b className="small">{label}</b>
        <button
          className="btn sm"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="hdrawer"
        >
          🕘 過去を見る
        </button>
      </div>
      {past ? (
        <div className="hpast" role="status">
          <span>
            <b>{label}</b>を表示しています（見るだけ）
          </span>
          <button className="btn sm" onClick={() => onChange(nowHist)}>
            現在に戻す
          </button>
        </div>
      ) : null}
      <div
        className={`hback${open ? " on" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <nav
        id="hdrawer"
        className={`hdrawer${open ? " on" : ""}`}
        aria-label="過去を見る"
        aria-hidden={!open}
      >
        <div className="ph">
          <b>過去を見る</b>
          <button className="px" aria-label="閉じる" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
        <p className="small muted" style={{ margin: "0 0 10px" }}>
          過去は見るだけです。入力できるのは現在だけです。
        </p>
        {apps.length || draft ? (
          menu
        ) : (
          <p className="small muted">まだ過去のものはありません。</p>
        )}
      </nav>
    </>
  );
}
