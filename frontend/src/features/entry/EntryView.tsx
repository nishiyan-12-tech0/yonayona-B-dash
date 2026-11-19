"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ApiError,
  createApplication,
  discardDraft,
  fetchApplication,
  startDraft,
} from "@/lib/api";
import { useStore, type SaveState } from "@/lib/store";
import type { StrategyData } from "@/lib/types";
import { History, type Hist } from "@/components/HistoryDrawer";
import { Modal } from "@/components/Modal";
import { FORMS } from "./forms";
import { BU_STEPS, STEPS } from "./steps";

const noop = () => {};

/**
 * ① 申請。3つの状態（設計書 v0.4 の 4-2）
 * - 初めての入力：申請がまだない。作成中の申請を入力する
 * - 表示：申請があり、作成中の申請がない。現在の申請を見るだけで出す
 * - 作り直し中：申請があり、作成中の申請がある。作成中の申請を入力する
 */
export function EntryView() {
  const {
    data,
    apps,
    draft,
    updateDraft,
    setDraft,
    flush,
    replace,
    refresh,
    saveState,
    saveError,
    ui,
    setUi,
  } = useStore();
  const router = useRouter();
  const current = apps.find((a) => a.current) ?? null;

  /** 表示しているもの（最初は、作成中の申請があればそれ、なければ現在の申請） */
  const [hist, setHist] = useState<Hist>(
    draft ? { kind: "draft" } : { kind: "now" },
  );
  /** 表示している過去の申請・現在の申請の内容 */
  const [shown, setShown] = useState<StrategyData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  /** 開いている確認（引き継ぐか／作り直しをやめるか／進捗の紐付きが外れるか） */
  const [ask, setAsk] = useState<"carry" | "discard" | "create" | null>(null);

  // 申請がないのに「現在」を見ようとしたら、作成中の申請を出す
  const view: Hist =
    hist.kind === "now" && !current && draft ? { kind: "draft" } : hist;
  const editing = view.kind === "draft" && !!draft;

  /** 見るだけで出す申請のID（作成中の申請を出すときは null） */
  const showId =
    view.kind === "app" ? view.id : view.kind === "now" ? (current?.id ?? null) : null;
  useEffect(() => {
    const id = showId;
    if (!id) return;
    let alive = true;
    fetchApplication(id)
      .then((a) => alive && setShown(a.body))
      .catch(() => alive && setShown(null));
    return () => {
      alive = false;
    };
  }, [showId]);

  const form: StrategyData | null = editing ? draft : shown;

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

  /** ステップを移る。入力中なら書きかけを保存してから */
  const go = (step: number) =>
    editing
      ? run(async () => {
          await flush();
          setUi({ step });
        })
      : setUi({ step });

  const start = (carryOver: boolean) =>
    run(async () => {
      const d = await startDraft(carryOver);
      setDraft(d.body);
      await refresh();
      setAsk(null);
      setHist({ kind: "draft" });
      setUi({ step: 0, ebu: null });
    });

  const discard = () =>
    run(async () => {
      await discardDraft();
      await refresh();
      setAsk(null);
      setHist({ kind: "now" });
      setUi({ step: 0 });
    });

  const create = () =>
    run(async () => {
      await flush();
      const d = await createApplication();
      replace(d);
      await refresh();
      setAsk(null);
      setHist({ kind: "now" });
      setUi({ snap: "now", sel: null, cb: null, ct: null, step: 0 });
      router.push("/map");
    });

  const onCreate = () => {
    if (!draft?.bus.length) {
      setErr("ステップ0で事業を追加してください");
      return;
    }
    if (current) setAsk("create");
    else create();
  };

  if (!form) {
    return (
      <section className="view on" id="v-entry" aria-label="申請">
        <History mode="entry" value={view} onChange={setHist} />
        <div className="card muted">読み込み中…</div>
      </section>
    );
  }

  const step = ui.step;
  const s = STEPS[step];
  const bu = form.bus.find((b) => b.id === ui.ebu) ?? form.bus[0];
  const needBu = BU_STEPS.includes(step);
  const Form = FORMS[step];
  const last = step === STEPS.length - 1;
  const isNow = view.kind === "now";

  return (
    <section className="view on" id="v-entry" aria-label="申請">
      <History mode="entry" value={view} onChange={setHist} />
      <div className="card row">
        <div className="entry-top">
          <b id="e-co">{data.company.name}</b>
          <span className="muted small">
            {editing
              ? "　事業部と経営が事業の目標を先に決め、そのあとDX推進部が加わって作ります"
              : "　出した申請は見るだけです。直すときは、新しい戦略マップを作ります"}
          </span>
          {editing ? <SaveBadge state={saveState} error={saveError} /> : null}
        </div>
        <div className="entry-top" style={{ marginLeft: "auto" }}>
          {isNow && current && !draft ? (
            <button
              className="btn pri"
              onClick={() => setAsk("carry")}
              disabled={busy}
            >
              新しい戦略マップを作る
            </button>
          ) : null}
          {editing && current ? (
            <button
              className="btn"
              onClick={() => setAsk("discard")}
              disabled={busy}
            >
              作り直しをやめる
            </button>
          ) : null}
          <span className="small muted">入力中の事業</span>
          <div className="seg" id="e-bu" style={{ opacity: needBu ? 1 : 0.45 }}>
            {form.bus.map((b) => (
              <button
                key={b.id}
                aria-pressed={bu?.id === b.id}
                disabled={!needBu}
                onClick={() => setUi({ ebu: b.id })}
              >
                {b.name.replace("（新規）", "")}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="entry">
        <div className="card" style={{ padding: 6 }}>
          <ul className="steps" id="steps">
            {STEPS.map((x, i) => (
              <StepItem key={i} group={x.g}>
                <button
                  aria-current={step === i ? "step" : "false"}
                  onClick={() => go(i)}
                  disabled={busy}
                >
                  <span className="n">{i}</span>
                  {x.t}
                </button>
              </StepItem>
            ))}
          </ul>
        </div>
        <div className="card">
          <div id="form" className={editing ? undefined : "ro-form"}>
            <h2>
              {step}. {s.t}
              {needBu && bu ? (
                <span className="small muted">　{bu.name}</span>
              ) : null}
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
            {needBu && !bu ? (
              <p className="muted">
                まず「0. 会社と事業」で、戦略を描く事業を追加してください。
              </p>
            ) : (
              <fieldset className="ro-wrap" disabled={!editing}>
                <Form
                  data={form}
                  bu={bu}
                  update={editing ? updateDraft : noop}
                />
              </fieldset>
            )}
          </div>
          {err ? <p className="merr">{err}</p> : null}
          <div className="btns">
            <button
              className="btn"
              id="prev"
              disabled={step === 0 || busy}
              onClick={() => go(step - 1)}
            >
              {editing ? "保存して前へ" : "前へ"}
            </button>
            {last ? null : (
              <button
                className="btn"
                id="next"
                disabled={busy}
                onClick={() => go(step + 1)}
              >
                {editing ? "保存して次へ" : "次へ"}
              </button>
            )}
            {last && editing ? (
              <button
                className="btn pri"
                id="tomap"
                disabled={busy}
                onClick={onCreate}
              >
                {busy ? "作成しています…" : "戦略マップを作成"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {ask === "carry" ? (
        <Modal title="新しい戦略マップを作る" onClose={() => setAsk(null)}>
          <p>前回の申請内容を引き継ぎますか？</p>
          <p className="small muted">
            引き継ぐと、前回の申請内容から直せます。今（申請時点）の値と施策の申請時点の状態には、戦略マップに入力された最新の値が入ります。
          </p>
          {err ? <p className="merr">{err}</p> : null}
          <div className="mfoot">
            <button className="btn" onClick={() => setAsk(null)} disabled={busy}>
              やめる
            </button>
            <button className="btn" onClick={() => start(false)} disabled={busy}>
              いいえ：空の申請から作る
            </button>
            <button className="btn pri" onClick={() => start(true)} disabled={busy}>
              はい：前回の内容から直す
            </button>
          </div>
        </Modal>
      ) : null}
      {ask === "discard" ? (
        <Modal title="作り直しをやめる" onClose={() => setAsk(null)}>
          <p>作成中の申請を捨てて、現在の申請に戻しますか？</p>
          {err ? <p className="merr">{err}</p> : null}
          <div className="mfoot">
            <button className="btn" onClick={() => setAsk(null)} disabled={busy}>
              やめる
            </button>
            <button className="btn pri" onClick={discard} disabled={busy}>
              捨てる
            </button>
          </div>
        </Modal>
      ) : null}
      {ask === "create" ? (
        <Modal title="新しい戦略マップを作成" onClose={() => setAsk(null)}>
          <p>
            新しい戦略マップを作ると、戦略マップ画面で入力した進捗（指標の今の値、施策の状態・やったこと）との紐付きがすべて外れ、1からになります。
          </p>
          <p className="small muted">
            今の申請・戦略マップ・版は、左上の「過去を見る」からいつでも見られます。
          </p>
          <p>よろしいですか？</p>
          {err ? <p className="merr">{err}</p> : null}
          <div className="mfoot">
            <button className="btn" onClick={() => setAsk(null)} disabled={busy}>
              やめる
            </button>
            <button className="btn pri" onClick={create} disabled={busy}>
              {busy ? "作成しています…" : "作成する"}
            </button>
          </div>
        </Modal>
      ) : null}
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

/** 作成中の申請の保存の状態 */
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
