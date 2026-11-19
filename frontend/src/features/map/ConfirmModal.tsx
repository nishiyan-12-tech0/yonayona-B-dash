"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, createVersion, deleteVersion } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { MapVersionMeta } from "@/lib/types";
import { lastAuthor, MRow, Modal, rememberAuthor } from "@/components/Modal";
import { versionName } from "@/components/HistoryDrawer";

const QUARTERS = [3, 6, 9, 12];

/** 期間の末日（YYYY-MM-DD） */
function endOf(y: number, m: number) {
  const last = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${last}`;
}

/** 今日の直前の四半期の末 */
function lastQuarter(): { y: number; m: number } {
  const d = new Date();
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const q = [...QUARTERS].reverse().find((x) => x < m);
  return q ? { y, m: q } : { y: y - 1, m: 12 };
}

/** 「版を作る」：今の進捗を、ある時点の断面として残す・手で作った版を消す */
export function ConfirmModal({ onClose }: { onClose: () => void }) {
  const { apps, refresh } = useStore();
  const q = lastQuarter();
  const [y, setY] = useState(q.y);
  const [mo, setMo] = useState(q.m);
  const [by, setBy] = useState(lastAuthor());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<MapVersionMeta | null>(null);

  const list = apps.find((a) => a.current)?.versions ?? [];
  const label = `${y}年${mo}月末`;
  const hit = list.find((v) => v.label === label);
  const years = Array.from({ length: 5 }, (_, n) => q.y - 1 + n);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };

  const make = () =>
    run(async () => {
      if (!by.trim()) throw new ApiError("作った人を入れてください", 0);
      if (
        hit &&
        !window.confirm(`${label}の版を上書きします。よろしいですか？`)
      )
        return;
      const v = await createVersion({
        label,
        asOf: endOf(y, mo),
        createdBy: by.trim(),
      });
      rememberAuthor(by.trim());
      await refresh();
      setDone(v);
    });

  const remove = (v: MapVersionMeta) =>
    run(async () => {
      if (!window.confirm(`${versionName(v)}を消します。よろしいですか？`))
        return;
      await deleteVersion(v.id);
      await refresh();
      setDone(null);
    });

  return (
    <Modal title="版を作る" crumb="版（断面）" onClose={onClose}>
      <p className="small muted" style={{ margin: "0 0 12px" }}>
        今の進捗を、この時点の版として残します。他社と比べる画面に固定の点が1つ増え、左の「過去を見る」からいつでも見られます。ふだんの進捗の入力は、版を作らなくても戦略マップと他社と比べる画面に出ます。
      </p>
      <MRow label="版の時点" req htmlFor="cf-y">
        <div className="row" style={{ gap: 6 }}>
          <select
            id="cf-y"
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            style={{ width: "auto" }}
          >
            {years.map((v) => (
              <option key={v} value={v}>
                {v}年
              </option>
            ))}
          </select>
          <select
            value={mo}
            onChange={(e) => setMo(Number(e.target.value))}
            style={{ width: "auto" }}
          >
            {QUARTERS.map((v) => (
              <option key={v} value={v}>
                {v}月末
              </option>
            ))}
          </select>
        </div>
        {hit ? (
          <div className="hint" style={{ color: "var(--ng)" }}>
            {label}の版（第{hit.no}版）はすでにあります。作ると上書きします
          </div>
        ) : null}
      </MRow>
      <MRow label="作った人" req htmlFor="cf-by">
        <input
          id="cf-by"
          value={by}
          placeholder="例：DX推進部長"
          onChange={(e) => setBy(e.target.value)}
        />
      </MRow>
      {err ? <p className="merr">{err}</p> : null}
      {done ? (
        <p className="mok">
          第{done.no}版（{done.label}）を作りました。他社と比べる画面に固定の点を追加しました。
          <br />
          <Link href="/compare" onClick={onClose}>
            他社と比べる画面を見る ›
          </Link>
        </p>
      ) : null}
      <div className="mfoot">
        <button className="btn" onClick={onClose} disabled={busy}>
          閉じる
        </button>
        <button className="btn pri" onClick={make} disabled={busy}>
          {busy ? "処理中…" : hit ? "上書きして作る" : "版を作る"}
        </button>
      </div>

      <h4 style={{ margin: "18px 0 0", fontSize: 13 }}>この申請の版</h4>
      <ul className="clist">
        {list.map((v) => (
          <li key={v.id}>
            <b>{versionName(v)}</b>
            <span className="muted">
              {v.createdAt.slice(0, 10)}　{v.createdBy}
            </span>
            {v.kind === "manual" ? (
              <button
                className="btn"
                onClick={() => remove(v)}
                disabled={busy}
              >
                削除
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
