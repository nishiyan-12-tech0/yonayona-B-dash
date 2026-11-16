import type { CSSProperties, ReactNode } from "react";

/** 文字の入力欄 */
export function Txt({
  value,
  onChange,
  placeholder,
  style,
  type = "text",
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  type?: "text" | "date";
}) {
  return (
    <input
      type={type}
      value={value ?? ""}
      placeholder={placeholder}
      style={style}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/**
 * 番号で選ぶ選択欄。options の並び順がそのまま値（0, 1, 2…）になります。
 * blank を渡すと先頭に「選ばない」選択肢が付き、そのときの値は null です。
 */
export function Sel({
  options,
  value,
  onChange,
  blank,
  disabled,
}: {
  options: string[];
  value: number | null;
  onChange: (v: number | null) => void;
  blank?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value === null ? "" : String(value)}
      disabled={disabled}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
    >
      {blank !== undefined ? <option value="">{blank}</option> : null}
      {options.map((t, i) => (
        <option key={i} value={i}>
          {t}
        </option>
      ))}
    </select>
  );
}

/** ラベルと入力欄の組。wide＝表などを横いっぱいに置く */
export function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="field"
      style={wide ? { gridTemplateColumns: "1fr" } : undefined}
    >
      <label>{label}</label>
      {children}
    </div>
  );
}

/** 見出し行つきの表 */
export function Table({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <table>
      <tbody>
        <tr>
          {head.map((h, i) => (
            <th key={i}>{h}</th>
          ))}
        </tr>
        {children}
      </tbody>
    </table>
  );
}
