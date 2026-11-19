"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  confirmProgress,
  deleteConfirmation,
  fetchConfirmations,
  fetchConfirmedVersions,
  resetDemo,
} from "@/lib/api";
import { progOf, stageTop } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Confirmation, ConfirmedVersion } from "@/lib/types";
import { lastAuthor, MRow, Modal, rememberAuthor } from "@/components/Modal";

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

/** いちばん新しい確定版と、その前の版で、位置（道筋の進み・DXの段階）が変わらなかった事業 */
function unchangedBus(vs: ConfirmedVersion[]): string[] {
  const [a, b] = vs;
  if (!a || !b) return [];
  return a.data.bus
    .filter((bu) => {
      const old = b.data.bus.find((x) => x.id === bu.id);
      if (!old) return false;
      return (
        progOf(a.data, bu, "now") === progOf(b.data, old, "now") &&
        stageTop(a.data, bu, "now") === stageTop(b.data, old, "now")
      );
    })
    .map((bu) => bu.name);
}

/** 「進捗を確定」：確定版を残す・消す・デモを初期状態に戻す */
export function ConfirmModal({ onClose }: { onClose: () => void }) {
  const { replace, setUi } = useStore();
  const q = lastQuarter();
  const [y, setY] = useState(q.y);
  const [mo, setMo] = useState(q.m);
  const [by, setBy] = useState(lastAuthor());
  const [list, setList] = useState<Confirmation[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string; same: string[] } | null>(
    null,
  );

  const label = `${y}年${mo}月末`;
  const hit = list?.find((c) => c.label === label);
  const years = Array.from({ length: 5 }, (_, n) => q.y - 1 + n);

  const reload = useCallback(() => {
    fetchConfirmations()
      .then(setList)
      .catch((e) =>
        setErr(
          e instanceof ApiError ? e.message : "確定版の一覧を読めませんでした",
        ),
      );
  }, []);
  useEffect(reload, [reload]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
      reload();
    }
  };

  const confirm = () =>
    run(async () => {
      if (!by.trim()) throw new ApiError("確定した人を入れてください", 0);
      if (
        hit &&
        !window.confirm(`${label}の確定版を上書きします。よろしいですか？`)
      )
        return;
      const d = await confirmProgress({
        label,
        asOf: endOf(y, mo),
        confirmedBy: by.trim(),
      });
      rememberAuthor(by.trim());
      replace(d);
      setUi({ snap: "now" });
      const vs = await fetchConfirmedVersions();
      // いま確定した版と、その1つ前を比べる
      const i = vs.findIndex((v) => v.label === label);
      setDone({ label, same: i >= 0 ? unchangedBus(vs.slice(i, i + 2)) : [] });
    });

  const remove = (c: Confirmation) =>
    run(async () => {
      if (!window.confirm(`${c.label}の確定版を消します。よろしいですか？`))
        return;
      replace(await deleteConfirmation(c.id));
      setDone(null);
    });

  const reset = () =>
    run(async () => {
      if (
        !window.confirm(
          "確定版・進捗・申請の内容を、すべて初期データに戻します。よろしいですか？",
        )
      )
        return;
      replace(await resetDemo());
      setUi({ snap: "now", sel: null });
      setDone(null);
    });

  return (
    <Modal title="進捗を確定" crumb="確定版" onClose={onClose}>
      <p className="small muted" style={{ margin: "0 0 12px" }}>
        今の進捗を確定版として残し、他社と比べる画面に反映します。ふだんの保存は他社と比べる画面には出ません。
      </p>
      <MRow label="確定する期間" req htmlFor="cf-y">
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
            {hit.isSeed
              ? `${label}は出発点の確定版なので、上書きできません`
              : `${label}の確定版はすでにあります。確定すると上書きします`}
          </div>
        ) : null}
      </MRow>
      <MRow label="確定した人" req htmlFor="cf-by">
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
          {done.label}の進捗を確定し、他社と比べる画面に反映しました。
          {done.same.length ? (
            <>
              <br />
              {done.same.join("・")}
              は、前回の確定から位置が変わっていません（指標が動くと、点も動きます）。
            </>
          ) : null}
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
        <button
          className="btn pri"
          onClick={confirm}
          disabled={busy || !!hit?.isSeed}
        >
          {busy ? "処理中…" : hit ? "上書きして確定" : "確定"}
        </button>
      </div>

      <h4 style={{ margin: "18px 0 0", fontSize: 13 }}>確定済みの版</h4>
      {list === null ? (
        <p className="small muted">読み込み中…</p>
      ) : (
        <ul className="clist">
          {list.map((c) => (
            <li key={c.id}>
              <b>{c.label}</b>
              <span className="muted">
                {c.isSeed
                  ? "出発点（初期データ）"
                  : `${c.confirmedAt.slice(0, 10)}　${c.confirmedBy}`}
              </span>
              {c.isSeed ? null : (
                <button
                  className="btn"
                  onClick={() => remove(c)}
                  disabled={busy}
                >
                  削除
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mfoot" style={{ justifyContent: "flex-start" }}>
        <button className="btn sm" onClick={reset} disabled={busy}>
          デモを初期状態に戻す
        </button>
        <span className="small muted">展示で次の人が触る前に使います</span>
      </div>
    </Modal>
  );
}
