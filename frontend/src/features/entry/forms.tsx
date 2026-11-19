import type { ReactNode } from "react";
import {
  CAP,
  CAPS,
  CVP,
  FINKIND,
  HZ,
  IPA,
  IPA_ITEMS,
  PERSP,
  PROG,
} from "@/lib/constants";
import { initsOfBu, progOf } from "@/lib/logic";
import type {
  BusinessUnit,
  Initiative,
  Link,
  Objective,
  Persp,
  StrategyData,
} from "@/lib/types";
import { Heat } from "@/components/Heat";
import { Track } from "@/components/Track";
import { Field, Sel, Table, Txt } from "./fields";

type Update = (mutate: (draft: StrategyData) => void) => void;
export interface FormProps {
  data: StrategyData;
  /** 入力中の事業 */
  bu: BusinessUnit;
  update: Update;
}

/** 指標の欄。今の値は担当者が戦略マップで入れるので、申請では聞かない */
const KPI_KEYS = ["kpi", "base", "target", "due"] as const;
const KPI_HEAD = ["指標", "基準（申請時点）", "目標", "期限"];
const OWNER_OPTIONS = ["事業部", "DX推進部"];

/* ----- 書き換えの小道具 ----- */
const findObj = (d: StrategyData, id: string) =>
  d.bus.flatMap((b) => b.objs).find((o) => o.id === id);
const editBu = (update: Update, id: string, patch: Partial<BusinessUnit>) =>
  update((d) => Object.assign(d.bus.find((b) => b.id === id) ?? {}, patch));
const editObj = (update: Update, id: string, patch: Partial<Objective>) =>
  update((d) => Object.assign(findObj(d, id) ?? {}, patch));
const editInit = (
  update: Update,
  id: string,
  mutate: (i: Initiative) => void,
) =>
  update((d) => {
    const i = d.inits.find((x) => x.id === id);
    if (i) mutate(i);
  });
const editLink = (
  update: Update,
  buId: string,
  n: number,
  patch: Partial<Link>,
) =>
  update((d) =>
    Object.assign(d.bus.find((b) => b.id === buId)?.links[n] ?? {}, patch),
  );

/* ----- 行の追加・削除 ----- */
/** 新しい行のID（申請を丸ごと保存するので、IDはここで決める） */
const newId = (prefix: string) =>
  prefix + Math.random().toString(36).slice(2, 10);

function addObj(update: Update, buId: string, persp: Persp) {
  update((d) => {
    const b = d.bus.find((x) => x.id === buId);
    if (!b) return;
    const o: Objective = {
      id: newId("o_"),
      persp,
      name: "",
      kpi: "",
      base: "",
      target: "",
      due: "",
      owner: "biz",
      partner: "",
    };
    if (persp === "pr" || persp === "lg") o.theme = b.themes[0]?.id;
    if (persp === "lg") {
      o.cap = "inf";
      o.owner = "dx";
    }
    if (persp === "fi") o.kind = 0;
    b.objs.push(o);
  });
}

/** 目標を消す。その目標に付くつながりと、施策の「付ける目標」からも外す */
function delObj(update: Update, obj: Objective) {
  if (!window.confirm(`「${obj.name || "（名前なし）"}」を消しますか？`))
    return;
  update((d) => {
    for (const b of d.bus) {
      b.objs = b.objs.filter((o) => o.id !== obj.id);
      b.links = b.links.filter((l) => l.from !== obj.id && l.to !== obj.id);
    }
    for (const i of d.inits) i.attach = i.attach.filter((a) => a !== obj.id);
  });
}

function AddBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="btns"
      style={{ justifyContent: "flex-start", marginTop: 6 }}
    >
      <button className="btn" onClick={onClick} disabled={disabled}>
        ＋ {label}を追加
      </button>
    </div>
  );
}

function DelCell({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <td>
      <button
        className="btn"
        style={{ padding: "2px 8px", whiteSpace: "nowrap" }}
        onClick={onClick}
        disabled={disabled}
        title={title}
      >
        削除
      </button>
    </td>
  );
}

/* ----- 共通の部品 ----- */
function Hint({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div className="hint" style={style}>
      {children}
    </div>
  );
}

/** 指標・基準・今・目標・期限の5つのセル */
function KpiCells({
  obj,
  onEdit,
}: {
  obj: Objective;
  onEdit: (patch: Partial<Objective>) => void;
}) {
  return (
    <>
      {KPI_KEYS.map((k) => (
        <td key={k}>
          <Txt value={obj[k]} onChange={(v) => onEdit({ [k]: v })} />
        </td>
      ))}
    </>
  );
}

function OwnerSel({
  owner,
  onChange,
}: {
  owner: string;
  onChange: (o: "biz" | "dx") => void;
}) {
  return (
    <Sel
      options={OWNER_OPTIONS}
      value={owner === "dx" ? 1 : 0}
      onChange={(v) => onChange(v === 1 ? "dx" : "biz")}
    />
  );
}

function ThemeSel({
  bu,
  value,
  onChange,
}: {
  bu: BusinessUnit;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      {bu.themes.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/** その事業の目標から選ぶ選択欄 */
function ObjSel({
  bu,
  value,
  blank,
  onChange,
}: {
  bu: BusinessUnit;
  value: string;
  blank: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{blank}</option>
      {bu.objs.map((o) => (
        <option key={o.id} value={o.id}>
          {PERSP[o.persp] + "：" + o.name}
        </option>
      ))}
    </select>
  );
}

/* ----- 0. 会社と事業 ----- */
function Step0({ data, update }: FormProps) {
  const fin = data.corp.fin;
  return (
    <>
      <Field label="全社の財務目標" wide>
        <Table head={["目標", ...KPI_HEAD]}>
          <tr>
            {(["name", ...KPI_KEYS] as const).map((k) => (
              <td key={k}>
                <Txt
                  value={fin[k]}
                  onChange={(v) =>
                    update((d) => Object.assign(d.corp.fin, { [k]: v }))
                  }
                />
              </td>
            ))}
          </tr>
        </Table>
      </Field>
      <Field label="対象にする事業" wide>
        <Table
          head={["事業名", "業種", "全社売上に占める割合（%）", "責任者", ""]}
        >
          {data.bus.map((b) => (
            <tr key={b.id}>
              <td>
                <Txt
                  value={b.name}
                  onChange={(v) => editBu(update, b.id, { name: v })}
                />
              </td>
              <td>
                <Txt
                  value={b.industry}
                  onChange={(v) => editBu(update, b.id, { industry: v })}
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={b.share}
                  onChange={(e) =>
                    editBu(update, b.id, { share: Number(e.target.value) })
                  }
                />
              </td>
              <td>
                <Txt
                  value={b.owner}
                  onChange={(v) => editBu(update, b.id, { owner: v })}
                />
              </td>
              <DelCell
                disabled={data.bus.length <= 1}
                title="事業は1つ以上必要です"
                onClick={() => {
                  if (
                    !window.confirm(
                      `「${b.name || "（名前なし）"}」とその目標・つながりを消しますか？`,
                    )
                  )
                    return;
                  update((d) => {
                    const ids = new Set(
                      d.bus.find((x) => x.id === b.id)?.objs.map((o) => o.id),
                    );
                    d.bus = d.bus.filter((x) => x.id !== b.id);
                    for (const i of d.inits)
                      i.attach = i.attach.filter((a) => !ids.has(a));
                  });
                }}
              />
            </tr>
          ))}
        </Table>
        <AddBtn
          label="事業"
          onClick={() =>
            update(
              (d) =>
                void d.bus.push({
                  id: newId("b_"),
                  name: "",
                  industry: "",
                  share: 0,
                  owner: "",
                  cvp: 0,
                  customer: "",
                  future: "",
                  gap: "",
                  growth: 50,
                  confBy: "",
                  confAt: "",
                  themes: [{ id: newId("t_"), name: "", hz: 0 }],
                  objs: [],
                  links: [],
                }),
            )
          }
        />
        <Hint>売上がまだない新規事業は0%にします。</Hint>
      </Field>
    </>
  );
}

/* ----- 1. 財務の目標 ----- */
function Step1({ bu, update }: FormProps) {
  const fs = bu.objs.filter((o) => o.persp === "fi");
  return (
    <>
      <Field label="今との差">
        <div>
          <Txt
            value={bu.gap}
            onChange={(v) => editBu(update, bu.id, { gap: v })}
          />
          <Hint>中期経営計画の目標と、今の差</Hint>
        </div>
      </Field>
      <Field label="差の埋め方">
        <div>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={bu.growth}
            style={{ width: "100%" }}
            onChange={(e) =>
              editBu(update, bu.id, { growth: Number(e.target.value) })
            }
          />
          <div className="split">
            <i style={{ width: `${bu.growth}%`, background: "var(--accent)" }}>
              収益増大 {bu.growth}%
            </i>
            <i
              style={{
                width: `${100 - bu.growth}%`,
                background: "var(--gray)",
              }}
            >
              生産性向上 {100 - bu.growth}%
            </i>
          </div>
          <Hint>
            生産性向上（効率化）だけで差を埋める計画か、収益増大も描けているかが、最初に見えます。
          </Hint>
        </div>
      </Field>
      <Field label="財務の目標" wide>
        <Table head={["目標", "種類", ...KPI_HEAD, ""]}>
          {fs.map((o) => (
            <tr key={o.id}>
              <td>
                <Txt
                  value={o.name}
                  onChange={(v) => editObj(update, o.id, { name: v })}
                />
              </td>
              <td>
                <Sel
                  options={FINKIND}
                  value={o.kind ?? null}
                  onChange={(v) => editObj(update, o.id, { kind: v ?? 0 })}
                />
              </td>
              <KpiCells obj={o} onEdit={(p) => editObj(update, o.id, p)} />
              <DelCell onClick={() => delObj(update, o)} />
            </tr>
          ))}
        </Table>
        <AddBtn
          label="財務の目標"
          onClick={() => addObj(update, bu.id, "fi")}
        />
      </Field>
    </>
  );
}

/* ----- 2. 顧客への価値 ----- */
function Step2({ bu, update }: FormProps) {
  const cs = bu.objs.filter((o) => o.persp === "cu");
  return (
    <>
      <Field label="対象の顧客">
        <Txt
          value={bu.customer}
          onChange={(v) => editBu(update, bu.id, { customer: v })}
        />
      </Field>
      <Field label="顧客価値提案の類型">
        <div>
          <Sel
            options={CVP}
            value={bu.cvp}
            onChange={(v) => editBu(update, bu.id, { cvp: v ?? 0 })}
          />
          <Hint>
            一つを選びます。「すべてを少しずつ」は戦略にならない、という考え方です（Kaplan
            &amp; Norton『戦略マップ』）。
          </Hint>
        </div>
      </Field>
      <Field label="将来の提供価値">
        <div>
          <textarea
            value={bu.future}
            onChange={(e) => editBu(update, bu.id, { future: e.target.value })}
          />
          <Hint>
            技術名を使わずに書けるか確認してください（例：×AI導入　○設備を止めない保守）
          </Hint>
        </div>
      </Field>
      <Field label="顧客の成果目標" wide>
        <Table head={["目標", ...KPI_HEAD, ""]}>
          {cs.map((o) => (
            <tr key={o.id}>
              <td>
                <Txt
                  value={o.name}
                  onChange={(v) => editObj(update, o.id, { name: v })}
                />
              </td>
              <KpiCells obj={o} onEdit={(p) => editObj(update, o.id, p)} />
              <DelCell onClick={() => delObj(update, o)} />
            </tr>
          ))}
        </Table>
        <AddBtn
          label="顧客の成果目標"
          onClick={() => addObj(update, bu.id, "cu")}
        />
      </Field>
    </>
  );
}

/* ----- 3. 戦略テーマと業務 ----- */
function Step3({ bu, update }: FormProps) {
  const ps = bu.objs.filter((o) => o.persp === "pr");
  const editTheme = (themeId: string, patch: { name?: string; hz?: number }) =>
    update((d) =>
      Object.assign(
        d.bus
          .find((b) => b.id === bu.id)
          ?.themes.find((t) => t.id === themeId) ?? {},
        patch,
      ),
    );
  return (
    <>
      <Field label="戦略テーマ（1〜3個）" wide>
        <Table head={["テーマ名", "取り組む期間の目安", ""]}>
          {bu.themes.map((t) => (
            <tr key={t.id}>
              <td>
                <Txt
                  value={t.name}
                  onChange={(v) => editTheme(t.id, { name: v })}
                />
              </td>
              <td>
                <Sel
                  options={HZ}
                  value={t.hz}
                  onChange={(v) => editTheme(t.id, { hz: v ?? 0 })}
                />
              </td>
              <DelCell
                disabled={bu.themes.length <= 1}
                title="戦略テーマは1個以上必要です"
                onClick={() => {
                  if (
                    !window.confirm(
                      `テーマ「${t.name || "（名前なし）"}」を消しますか？このテーマの目標は、残りのテーマに移ります。`,
                    )
                  )
                    return;
                  update((d) => {
                    const b = d.bus.find((x) => x.id === bu.id);
                    if (!b) return;
                    b.themes = b.themes.filter((x) => x.id !== t.id);
                    const first = b.themes[0]?.id;
                    for (const o of b.objs)
                      if (o.theme === t.id) o.theme = first;
                  });
                }}
              />
            </tr>
          ))}
        </Table>
        <AddBtn
          label="戦略テーマ"
          disabled={bu.themes.length >= 3}
          onClick={() =>
            update(
              (d) =>
                void d.bus
                  .find((x) => x.id === bu.id)
                  ?.themes.push({ id: newId("t_"), name: "", hz: 0 }),
            )
          }
        />
      </Field>
      <Field label="変える業務" wide>
        <Table head={["目標", "テーマ", "主担当", "協働", ...KPI_HEAD, ""]}>
          {ps.map((o) => (
            <tr key={o.id}>
              <td>
                <Txt
                  value={o.name}
                  onChange={(v) => editObj(update, o.id, { name: v })}
                />
              </td>
              <td>
                <ThemeSel
                  bu={bu}
                  value={o.theme}
                  onChange={(v) => editObj(update, o.id, { theme: v })}
                />
              </td>
              <td>
                <OwnerSel
                  owner={o.owner}
                  onChange={(v) => editObj(update, o.id, { owner: v })}
                />
              </td>
              <td>
                <Txt
                  value={o.partner}
                  onChange={(v) => editObj(update, o.id, { partner: v })}
                />
              </td>
              <KpiCells obj={o} onEdit={(p) => editObj(update, o.id, p)} />
              <DelCell onClick={() => delObj(update, o)} />
            </tr>
          ))}
        </Table>
        <AddBtn
          label="変える業務"
          onClick={() => addObj(update, bu.id, "pr")}
        />
      </Field>
      <Field label="事業側で確認した人・日付">
        <div className="row">
          <Txt
            value={bu.confBy}
            placeholder="例：産業機器事業部長"
            style={{ flex: 1 }}
            onChange={(v) => editBu(update, bu.id, { confBy: v })}
          />
          <Txt
            type="date"
            value={bu.confAt}
            style={{ width: 170 }}
            onChange={(v) => editBu(update, bu.id, { confAt: v })}
          />
        </div>
      </Field>
    </>
  );
}

/* ----- 4. 必要な力と施策 ----- */
function Step4({ data, bu, update }: FormProps) {
  const ls = bu.objs.filter((o) => o.persp === "lg");
  const inBu = (id: string) => bu.objs.some((o) => o.id === id);
  // この事業の目標に付いている施策と、どこにも付いていない施策
  const its = data.inits.filter((i) => i.attach.some(inBu) || !i.attach.length);
  return (
    <>
      <Field label="必要な力（学習と成長の目標）" wide>
        <Table
          head={["目標", "資本の種類", "テーマ", "主担当", ...KPI_HEAD, ""]}
        >
          {ls.map((o) => (
            <tr key={o.id}>
              <td>
                <Txt
                  value={o.name}
                  onChange={(v) => editObj(update, o.id, { name: v })}
                />
              </td>
              <td>
                <Sel
                  options={CAPS.map((c) => CAP[c])}
                  value={o.cap ? CAPS.indexOf(o.cap) : null}
                  onChange={(v) => editObj(update, o.id, { cap: CAPS[v ?? 0] })}
                />
              </td>
              <td>
                <ThemeSel
                  bu={bu}
                  value={o.theme}
                  onChange={(v) => editObj(update, o.id, { theme: v })}
                />
              </td>
              <td>
                <OwnerSel
                  owner={o.owner}
                  onChange={(v) => editObj(update, o.id, { owner: v })}
                />
              </td>
              <KpiCells obj={o} onEdit={(p) => editObj(update, o.id, p)} />
              <DelCell onClick={() => delObj(update, o)} />
            </tr>
          ))}
        </Table>
        <AddBtn label="必要な力" onClick={() => addObj(update, bu.id, "lg")} />
        <Hint>
          データ・システムは情報資本、スキル・人数は人的資本、文化・協働の仕組みは組織資本です。
        </Hint>
      </Field>
      <Field label="施策（チップ）" wide>
        <Table
          head={[
            "施策",
            "付ける目標（この事業）",
            "主担当",
            "デジタル",
            "IPA項目",
            "施策の指標",
            "基準",
            "目標",
            "",
          ]}
        >
          {its.map((i) => {
            const mine = i.attach.find(inBu) || "";
            const edit = (mutate: (x: Initiative) => void) =>
              editInit(update, i.id, mutate);
            return (
              <tr key={i.id}>
                <td>
                  <Txt
                    value={i.name}
                    onChange={(v) => edit((x) => void (x.name = v))}
                  />
                  {i.attach.length > 1 ? (
                    <Hint>複数の事業に付く施策</Hint>
                  ) : null}
                  {!i.attach.length ? (
                    <Hint style={{ color: "var(--ng)" }}>
                      どの目標にも付いていない
                    </Hint>
                  ) : null}
                </td>
                <td>
                  <ObjSel
                    bu={bu}
                    value={mine}
                    blank="付けない"
                    onChange={(v) =>
                      edit((x) => {
                        x.attach = x.attach.filter((a) => a !== mine);
                        if (v) x.attach.push(v);
                      })
                    }
                  />
                </td>
                <td>
                  <OwnerSel
                    owner={i.owner}
                    onChange={(v) => edit((x) => void (x.owner = v))}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={i.digital}
                    onChange={(e) =>
                      edit((x) => {
                        x.digital = e.target.checked;
                        if (!x.digital) x.ipa = null;
                        else if (!x.ipa) x.ipa = 2;
                      })
                    }
                  />
                </td>
                <td>
                  <Sel
                    options={IPA_ITEMS.map((k) => k + ". " + IPA[k])}
                    value={i.ipa ? i.ipa - 1 : null}
                    blank="—"
                    disabled={!i.digital}
                    onChange={(v) =>
                      edit((x) => void (x.ipa = v === null ? null : v + 1))
                    }
                  />
                </td>
                {(["kpi", "base", "target"] as const).map((k) => (
                  <td key={k}>
                    <Txt
                      value={i[k]}
                      placeholder={
                        k === "kpi" ? "例：連携できた設備の台数" : ""
                      }
                      onChange={(v) => edit((x) => void (x[k] = v))}
                    />
                  </td>
                ))}
                <DelCell
                  onClick={() => {
                    if (
                      !window.confirm(
                        `施策「${i.name || "（名前なし）"}」を消しますか？`,
                      )
                    )
                      return;
                    update(
                      (d) =>
                        void (d.inits = d.inits.filter((x) => x.id !== i.id)),
                    );
                  }}
                />
              </tr>
            );
          })}
        </Table>
        <AddBtn
          label="施策"
          onClick={() =>
            update(
              (d) =>
                void d.inits.push({
                  id: newId("i_"),
                  name: "",
                  attach: [],
                  owner: "dx",
                  partner: "",
                  digital: true,
                  ipa: 2,
                  ev: "",
                  kpi: "",
                  base: "",
                  target: "",
                  exec: 0,
                  verify: 0,
                  checks: { condition: false, review: false },
                }),
            )
          }
        />
        <Hint>
          IPA項目は、施策が何を変えるかで企業が選びます。段階は、項目1＝デジタイゼーション、項目2・3＝デジタライゼーション、項目4〜7＝DXとして自動で表示します。
        </Hint>
      </Field>
    </>
  );
}

/* ----- 5. つながりと検証 ----- */
function Step5({ bu, update }: FormProps) {
  const editBuLinks = (mutate: (links: Link[]) => void) =>
    update((d) => {
      const b = d.bus.find((x) => x.id === bu.id);
      if (b) mutate(b.links);
    });
  return (
    <Field label="目標どうしのつながり" wide>
      <Table
        head={[
          "元の目標",
          "先の目標",
          "理由（仮説）",
          "成り立つ条件",
          "次に確かめること",
          "時期",
          "",
        ]}
      >
        {bu.links.map((l, n) => (
          <tr key={n}>
            <td>
              <ObjSel
                bu={bu}
                value={l.from}
                blank="—"
                onChange={(v) => editLink(update, bu.id, n, { from: v })}
              />
            </td>
            <td>
              <ObjSel
                bu={bu}
                value={l.to}
                blank="—"
                onChange={(v) => editLink(update, bu.id, n, { to: v })}
              />
            </td>
            {(["reason", "cond", "check", "date"] as const).map((k) => (
              <td key={k}>
                <Txt
                  value={l[k]}
                  onChange={(v) => editLink(update, bu.id, n, { [k]: v })}
                />
              </td>
            ))}
            <td>
              <button
                className="btn"
                style={{ padding: "2px 8px" }}
                onClick={() => editBuLinks((ls) => void ls.splice(n, 1))}
              >
                削除
              </button>
            </td>
          </tr>
        ))}
      </Table>
      <div className="btns" style={{ justifyContent: "flex-start" }}>
        <button
          className="btn"
          onClick={() =>
            editBuLinks(
              (ls) =>
                void ls.push({
                  from: "",
                  to: "",
                  reason: "",
                  cond: "",
                  check: "",
                  date: "",
                }),
            )
          }
        >
          ＋ つながりを追加
        </button>
      </div>
      <Hint>
        つながりは「因果の仮説」です。半年〜1年ごとの更新で、確かめた結果と、変えたかどうかを記録します。
      </Hint>
    </Field>
  );
}

/* ----- 6. 実行の準備 ----- */
function Step6({ data, bu, update }: FormProps) {
  const its = initsOfBu(data, bu);
  return (
    <Field label="施策ごとの実行の準備" wide>
      <Table
        head={[
          "施策",
          "実行条件の確保",
          "検証と次の判断日",
          "決めた場（会議体・日付・資料）",
        ]}
      >
        {its.map((i) => (
          <tr key={i.id}>
            <td>
              {i.name}
              {i.digital ? null : <Hint>デジタル以外</Hint>}
            </td>
            {(["condition", "review"] as const).map((c) => (
              <td key={c}>
                <input
                  type="checkbox"
                  checked={i.checks[c]}
                  onChange={(e) =>
                    editInit(
                      update,
                      i.id,
                      (x) => void (x.checks[c] = e.target.checked),
                    )
                  }
                />
              </td>
            ))}
            <td>
              <Txt
                value={i.ev}
                onChange={(v) => editInit(update, i.id, (x) => void (x.ev = v))}
              />
            </td>
          </tr>
        ))}
      </Table>
      <Hint>
        実行条件＝予算・工数・権限・データの提供者。事業部とDX推進部の目標の合意は、この申請を一緒に作る時点で済んでいるので、別には聞きません。評価・報酬の変更は条件にしません。
      </Hint>
    </Field>
  );
}

/* ----- 7. 道筋にあるDX（自動） ----- */
function Step7({ data }: FormProps) {
  return (
    <>
      <Field label="道筋にあるDX（入力なし・自動）" wide>
        <Heat data={data} snap="now" />
        <Hint>
          その項目の施策がある事業について、その施策から道筋がどこまで進んだかを出しています。「未着手／取り組み中／成果が出ている」の自己申告はしません。
          <br />
          項目：{IPA_ITEMS.map((k) => k + ". " + IPA[k]).join("／")}
          （1＝デジタイゼーション、2・3＝デジタライゼーション、4〜7＝DX。分類の出典：IPA『DX動向2025』本文
          p.16 図表1-19）
        </Hint>
      </Field>
      <Field label="事業ごとの道筋の進み" wide>
        <div className="bul">
          {data.bus.map((b) => {
            const p = progOf(data, b, "now");
            return (
              <div key={b.id}>
                <b className="small">{b.name}</b>：
                <span className="small">
                  {p ? PROG[p] + "まで指標が動いた" : PROG[0]}
                </span>
                <Track p={p} />
              </div>
            );
          })}
        </div>
      </Field>
    </>
  );
}

/* ----- 8. 一枚で確認 ----- */
function Step8({ data }: FormProps) {
  const lines = (xs: string[]) =>
    xs.map((x, n) => (
      <span key={n}>
        {n ? <br /> : null}
        {x}
      </span>
    ));
  return (
    <Field label="一枚で読み合わせ" wide>
      <Table
        head={["事業", "財務", "顧客", "業務プロセス", "学習と成長", "施策"]}
      >
        {data.bus.map((b) => (
          <tr key={b.id}>
            <td>{b.name}</td>
            {(["fi", "cu", "pr", "lg"] as const).map((p) => (
              <td key={p}>
                {lines(b.objs.filter((o) => o.persp === p).map((o) => o.name))}
              </td>
            ))}
            <td>{lines(initsOfBu(data, b).map((i) => i.name))}</td>
          </tr>
        ))}
      </Table>
    </Field>
  );
}

/** ステップ番号の順に並べた入力欄 */
export const FORMS = [
  Step0,
  Step1,
  Step2,
  Step3,
  Step4,
  Step5,
  Step6,
  Step7,
  Step8,
];
