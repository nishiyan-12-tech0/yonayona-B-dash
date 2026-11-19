"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveVersion } from "@/lib/api";
import { useStore, type SaveState } from "@/lib/store";
import { FORMS } from "./forms";
import { BU_STEPS, STEPS } from "./steps";

/** ① 申請 */
export function EntryView() {
  const { data, update, ui, setUi, flush, saveState, saveError } = useStore();
  const router = useRouter();
  const [moving, setMoving] = useState(false);

  /** 書きかけを保存し、申請内容を版として残してから戦略マップへ */
  const toMap = async () => {
    setMoving(true);
    try {
      await flush();
      await saveVersion();
    } catch {
      // 版が残せなくても、戦略マップは見られるようにする
    }
    setUi({ snap: "now", sel: null });
    router.push("/map");
  };

  const step = ui.step;
  const s = STEPS[step];
  const bu = data.bus.find((b) => b.id === ui.ebu) ?? data.bus[0];
  const needBu = BU_STEPS.includes(step);
  const Form = FORMS[step];

  return (
    <section className="view on" id="v-entry" aria-label="申請">
      <div className="card row">
        <div>
          <b id="e-co">{data.company.name}</b>
          <span className="muted small">
            　事業部と経営が事業の目標を先に決め、そのあとDX推進部が加わって作ります
          </span>
        </div>
        <SaveBadge state={saveState} error={saveError} />
        <span className="small muted" style={{ marginLeft: "auto" }}>
          入力中の事業
        </span>
        <div className="seg" id="e-bu" style={{ opacity: needBu ? 1 : 0.45 }}>
          {data.bus.map((b) => (
            <button
              key={b.id}
              aria-pressed={bu.id === b.id}
              disabled={!needBu}
              onClick={() => setUi({ ebu: b.id })}
            >
              {b.name.replace("（新規）", "")}
            </button>
          ))}
        </div>
      </div>
      <div className="entry">
        <div className="card" style={{ padding: 6 }}>
          <ul className="steps" id="steps">
            {STEPS.map((x, i) => (
              <StepItem key={i} group={x.g}>
                <button
                  aria-current={step === i ? "step" : "false"}
                  onClick={() => setUi({ step: i })}
                >
                  <span className="n">{i}</span>
                  {x.t}
                </button>
              </StepItem>
            ))}
          </ul>
        </div>
        <div className="card">
          <div id="form">
            <h2>
              {step}. {s.t}
              {needBu ? <span className="small muted">　{bu.name}</span> : null}
            </h2>
            <p className="stepq">{s.q}</p>
            <div className="lead">
              <b>ここで決めること</b>
              <span>{s.dec}</span>
              <b>主に話す人</b>
              <span>{s.who}</span>
              <b>決まると</b>
              <span>{s.then}</span>
            </div>
            <Form data={data} bu={bu} update={update} />
          </div>
          <div className="btns">
            <button
              className="btn"
              id="prev"
              disabled={step === 0}
              onClick={() => setUi({ step: step - 1 })}
            >
              前へ
            </button>
            <button
              className="btn"
              id="next"
              disabled={step === STEPS.length - 1}
              onClick={() => setUi({ step: step + 1 })}
            >
              次へ
            </button>
            <button
              className="btn pri"
              id="tomap"
              disabled={moving}
              onClick={toMap}
            >
              {moving ? "保存しています…" : "入力内容で戦略マップを表示"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** 左の一覧の1行。グループの先頭なら、グループ名の行を上に足す */
function StepItem({
  group,
  children,
}: {
  group: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {group ? <li className="grp">{group}</li> : null}
      <li>{children}</li>
    </>
  );
}

/** 申請の保存の状態 */
function SaveBadge({
  state,
  error,
}: {
  state: SaveState;
  error: string | null;
}) {
  if (state === "idle") return null;
  const text =
    state === "saving"
      ? "保存中…"
      : state === "saved"
        ? "保存しました"
        : `保存できませんでした（${error ?? ""}）。次の入力のときにもう一度送ります`;
  return (
    <span className={`savest${state === "error" ? " err" : ""}`} role="status">
      {text}
    </span>
  );
}
