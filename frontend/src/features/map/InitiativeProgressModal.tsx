"use client";

import { useState } from "react";
import { ApiError, saveInitiativeProgress } from "@/lib/api";
import { VERIFY } from "@/lib/constants";
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
        verify: f.verify,
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
      {it.exec === 0 ? (
        <p className="small" style={{ margin: "0 0 8px" }}>
          この施策は今「未着手」です。進捗を保存すると「実行中」になります。
        </p>
      ) : null}
      <MRow label="効果の検証" req htmlFor="ip-v">
        <select
          id="ip-v"
          value={f.verify}
          onChange={(e) => set({ verify: Number(e.target.value) })}
        >
          {VERIFY.map((x, n) => (
            <option key={n} value={n}>
              {x}
            </option>
          ))}
        </select>
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
            {it.kpi}　申請時点 {it.base || "—"} → 目標 {it.target || "—"}
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
        保存すると、戦略マップと他社と比べる画面にすぐ出ます。
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
