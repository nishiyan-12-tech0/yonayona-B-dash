"use client";

import { useState } from "react";
import { ApiError, saveInitiativeProgress } from "@/lib/api";
import { EXEC, VERIFY } from "@/lib/constants";
import { useStore } from "@/lib/store";
import type { Initiative } from "@/lib/types";
import { lastAuthor, MRow, Modal, rememberAuthor } from "@/components/Modal";

/** 施策の「進捗を入力」（担当者。前に入れた内容を上書き） */
export function InitiativeProgressModal({
  init: it,
  crumb,
  onClose,
}: {
  init: Initiative;
  crumb: string;
  onClose: () => void;
}) {
  const { replace } = useStore();
  const p = it.progress;
  const start = {
    exec: it.exec,
    verify: it.verify,
    kpiCur: it.cur ?? "",
    did: p?.did ?? "",
    result: p?.result ?? "",
    author: p?.author || lastAuthor(),
  };
  const [f, setF] = useState(start);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(f) !== JSON.stringify(start);
  /** 試行中・実行中のときだけ、効果の検証を選べる */
  const canVerify = f.exec === 1 || f.exec === 2;

  const missing = [
    !f.did.trim() && "やったこと",
    !f.author.trim() && "入力した人",
  ].filter(Boolean);

  const save = async () => {
    if (missing.length) {
      setErr(`${missing.join("・")}を入れてください`);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const d = await saveInitiativeProgress(it.id, {
        exec: f.exec,
        verify: canVerify ? f.verify : 0,
        kpiCur: f.kpiCur.trim(),
        did: f.did.trim(),
        result: f.result.trim(),
        author: f.author.trim(),
      });
      rememberAuthor(f.author.trim());
      replace(d);
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "保存できませんでした");
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`進捗を入力：${it.name}`}
      crumb={crumb}
      dirty={dirty}
      onClose={onClose}
    >
      <p className="crumb small muted">
        上が決めた施策を、今の期間にどう進めたかを書きます。
      </p>
      <MRow label="実行の状態" req htmlFor="ip-e">
        <select
          id="ip-e"
          value={f.exec}
          onChange={(e) => {
            const exec = Number(e.target.value);
            set({ exec, verify: exec === 1 || exec === 2 ? f.verify : 0 });
          }}
        >
          {EXEC.map((x, n) => (
            <option key={n} value={n}>
              {x}
            </option>
          ))}
        </select>
      </MRow>
      <MRow label="効果の検証" req htmlFor="ip-v">
        <select
          id="ip-v"
          value={canVerify ? f.verify : 0}
          disabled={!canVerify}
          onChange={(e) => set({ verify: Number(e.target.value) })}
        >
          {VERIFY.map((x, n) => (
            <option key={n} value={n}>
              {x}
            </option>
          ))}
        </select>
        {canVerify ? null : (
          <div className="hint">試行中・実行中のときに選べます</div>
        )}
      </MRow>
      {it.kpi ? (
        <MRow label="施策の指標の今の値" htmlFor="ip-k">
          <input
            id="ip-k"
            value={f.kpiCur}
            placeholder={`例：${it.target || it.base || ""}`}
            onChange={(e) => set({ kpiCur: e.target.value })}
          />
          <div className="hint">
            {it.kpi}　基準 {it.base || "—"} → 目標 {it.target || "—"}
          </div>
        </MRow>
      ) : null}
      <MRow label="やったこと" req htmlFor="ip-d">
        <textarea
          id="ip-d"
          value={f.did}
          placeholder="例：連携の対象を組立ラインの全設備に広げ、欠損の監視を自動にした"
          onChange={(e) => set({ did: e.target.value })}
        />
      </MRow>
      <MRow label="結果・わかったこと" htmlFor="ip-r">
        <textarea
          id="ip-r"
          value={f.result}
          placeholder="例：欠損なし率が91%から95%に。夜間の設備はまだ取れていない"
          onChange={(e) => set({ result: e.target.value })}
        />
      </MRow>
      <MRow label="入力した人" req htmlFor="ip-a">
        <input
          id="ip-a"
          value={f.author}
          placeholder="例：DX推進部 佐藤"
          onChange={(e) => set({ author: e.target.value })}
        />
      </MRow>
      {err ? <p className="merr">{err}</p> : null}
      <p className="small muted" style={{ margin: "8px 0 0" }}>
        保存すると戦略マップにすぐ出ます。他社と比べる画面には、「進捗を確定」したときに出ます。
      </p>
      <div className="mfoot">
        <button className="btn" onClick={onClose} disabled={busy}>
          やめる
        </button>
        <button className="btn pri" onClick={save} disabled={busy}>
          {busy ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}
