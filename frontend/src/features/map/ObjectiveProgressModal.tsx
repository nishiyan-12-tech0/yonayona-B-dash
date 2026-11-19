"use client";

import { useState } from "react";
import { ApiError, saveObjectiveProgress } from "@/lib/api";
import { IS, REASON } from "@/lib/constants";
import { indState } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Objective } from "@/lib/types";
import {
  lastAuthor,
  MRow,
  Modal,
  rememberAuthor,
  today,
} from "@/components/Modal";

/** 目標の「進捗を入力」（担当者。前に入れた内容を上書き） */
export function ObjectiveProgressModal({
  obj,
  crumb,
  onClose,
}: {
  obj: Objective;
  crumb: string;
  onClose: () => void;
}) {
  const { replace } = useStore();
  const p = obj.progress;
  const init = {
    value: obj.cur ?? "",
    at: p?.at || today(),
    reason: p?.reason ?? null,
    memo: p?.memo ?? "",
    author: p?.author || lastAuthor(),
  };
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const dirty = JSON.stringify(f) !== JSON.stringify(init);

  // 入力した値で「指標の動き」を先に計算する。横ばい・悪化なら理由を必須に
  // （保存すると担当者の入力になるので、申請時点と同じ値は「横ばい」として扱う）
  const st0 = indState({ ...obj, cur: f.value }, "now");
  const st = st0 === "start" ? "flat" : st0;
  const needReason = st === "flat" || st === "worse";

  const missing = [
    !f.value.trim() && "指標の今の値",
    !f.at && "測った日",
    needReason && f.reason === null && "動かなかった・下がった理由",
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
      const d = await saveObjectiveProgress(obj.id, {
        value: f.value.trim(),
        at: f.at,
        reason: f.reason,
        memo: f.memo,
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
      title={`進捗を入力：${obj.name}`}
      crumb={crumb}
      dirty={dirty}
      onClose={onClose}
    >
      <p className="crumb small muted">
        指標：{obj.kpi}　申請時点 {obj.base || "—"} → 目標 {obj.target || "—"}（
        {obj.due || "期限未設定"}）
      </p>
      <MRow label="指標の今の値" req htmlFor="op-v">
        <input
          id="op-v"
          value={f.value}
          placeholder={`例：${obj.target || obj.base || ""}`}
          onChange={(e) => set({ value: e.target.value })}
        />
        <div className="hint">
          単位まで書きます（例：月42件、91%）。申請時点と比べると
          <span className={`is ${st}`} style={{ marginLeft: 4 }}>
            {IS[st]}
          </span>
        </div>
      </MRow>
      <MRow label="測った日" req htmlFor="op-at">
        <input
          id="op-at"
          type="date"
          value={f.at}
          onChange={(e) => set({ at: e.target.value })}
        />
      </MRow>
      <MRow label="動かなかった・下がった理由" req={needReason} htmlFor="op-r">
        <select
          id="op-r"
          value={f.reason === null ? "" : String(f.reason)}
          onChange={(e) =>
            set({
              reason: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        >
          <option value="">
            {needReason ? "選んでください" : "—（動いているときは不要）"}
          </option>
          {REASON.map((r, n) => (
            <option key={n} value={n}>
              {r}
            </option>
          ))}
        </select>
      </MRow>
      <MRow label="メモ" htmlFor="op-m">
        <textarea
          id="op-m"
          value={f.memo}
          placeholder="測り方・気づいたことなど"
          onChange={(e) => set({ memo: e.target.value })}
        />
      </MRow>
      <MRow label="入力した人" req htmlFor="op-a">
        <input
          id="op-a"
          value={f.author}
          placeholder="例：産業機器事業部 田中"
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
