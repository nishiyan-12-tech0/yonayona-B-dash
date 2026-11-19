"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { PIDX } from "@/lib/constants";
import type { StrategyData } from "@/lib/types";

/** 開いたときの矢印の出始め（箱が左の列から出そろうころ）と、1列ぶんの遅れ（ms） */
const ENTER_BASE = 380;
const ENTER_STEP = 120;
/** 選んだ道筋を流れる光の、1列ぶんの遅れ（秒） */
const FLOW_STEP = 0.15;

const MARKERS =
  '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--muted)"/></marker><marker id="ahd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0L10,5L0,10z" style="fill:var(--accent)"/></marker></defs>';

/**
 * 目標どうしのつながりの矢印を描く。
 * 箱の位置は画面に出てからでないと分からないので、描画のたびに位置を測って SVG に書き込みます。
 * 箱は id="o-目標ID" で探します（ObjCard が付けている）。
 */
export function useLinks(
  mapRef: RefObject<HTMLDivElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  data: StrategyData,
  focusObjs: Set<string> | null,
  /** 表示の切り替え。変わったら矢印を左から順に引き直す */
  enterKey = "",
) {
  /** 表示を切り替えた時刻（矢印を描く演出の起点） */
  const entered = useRef({ key: "", at: 0 });
  /** 描き終えたあとに矢じりを付けて引き直すタイマー */
  const after = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** 最新の draw（タイマーから呼ぶため） */
  const drawRef = useRef<() => void>(() => {});
  const draw = useCallback(() => {
    // 表示が切り替わってから初めて描くときを、演出の起点にする
    if (entered.current.key !== enterKey) {
      entered.current = { key: enterKey, at: performance.now() };
    }
    const svg = svgRef.current;
    const map = mapRef.current;
    if (!svg || !map || !map.offsetParent) return;
    const R = map.getBoundingClientRect();
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // 切り替えた直後の描き直しは、経った時間だけ演出を進めた状態で描く（何度描き直しても途中から続く）
    const since = performance.now() - entered.current.at;
    const enterEnd = ENTER_BASE + ENTER_STEP * 4 + 700;
    const entering = !calm && since < enterEnd;
    let p = MARKERS;
    let dots = "";
    data.bus.forEach((b) => {
      const col = (id: string) => {
        const o = b.objs.find((x) => x.id === id);
        return o ? PIDX[o.persp] - 1 : 3;
      };
      b.links.forEach((l) => {
        const A = document.getElementById("o-" + l.from);
        const B = document.getElementById("o-" + l.to);
        if (!A || !B) return;
        const a = A.getBoundingClientRect();
        const c = B.getBoundingClientRect();
        const x1 = a.right - R.left;
        const y1 = a.top + a.height / 2 - R.top;
        const x2 = c.left - R.left - 2;
        const y2 = c.top + c.height / 2 - R.top;
        const dx = Math.max(12, (x2 - x1) / 2);
        const on = !focusObjs || (focusObjs.has(l.from) && focusObjs.has(l.to));
        const hi = !!focusObjs && on;
        const d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
        const fc = col(l.from);
        const anim = entering
          ? ` class="lk-in" pathLength="1" style="stroke:var(${hi ? "--accent" : "--muted"});animation-delay:${Math.round(ENTER_BASE + fc * ENTER_STEP - since)}ms"`
          : ` class="${hi ? "lk-hi" : "lk"}" style="stroke:var(${hi ? "--accent" : "--muted"})"`;
        // 描いている途中は矢じりだけ先に見えてしまうので付けず、描き終えたら引き直して付ける
        const marker = entering ? "" : ` marker-end="url(#${hi ? "ahd" : "ah"})"`;
        p += `<path d="${d}" fill="none"${anim} stroke-width="${hi ? 2.6 : 1.5}" opacity="${on ? 0.9 : 0.13}"${marker}/>`;
        // 選んだ道筋には、左から右へ光が流れる
        if (hi && !calm) {
          // 動き出すまでは見えないようにする（始点に出るまで左上に止まって見えるため）
          dots += `<circle r="4" class="lk-dot" opacity="0"><animateMotion dur="1.3s" begin="indefinite" repeatCount="indefinite" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .6 1" path="${d}" data-delay="${fc * FLOW_STEP}"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.85;1" dur="1.3s" begin="indefinite" repeatCount="indefinite" data-delay="${fc * FLOW_STEP}"/></circle>`;
        }
      });
    });
    svg.innerHTML = p + dots;
    if (entering) {
      clearTimeout(after.current);
      after.current = setTimeout(
        () => requestAnimationFrame(() => drawRef.current()),
        enterEnd - since + 30,
      );
    }
    svg.querySelectorAll("animateMotion, animate").forEach((m) => {
      const el = m as SVGAnimationElement;
      try {
        el.beginElementAt(Number(el.dataset.delay ?? 0));
      } catch {
        // SVGのアニメーションに対応していないブラウザでは光は出さない
      }
    });
  }, [mapRef, svgRef, data, focusObjs, enterKey]);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);
  useEffect(() => () => clearTimeout(after.current), []);

  // 画面が描き変わるたびに引き直す
  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  });

  // 幅や高さが変わったとき（ウィンドウ、詳細の開閉、フォントの読み込み）も引き直す
  useEffect(() => {
    const redraw = () => requestAnimationFrame(draw);
    window.addEventListener("resize", redraw);
    const ro = new ResizeObserver(redraw);
    if (mapRef.current) ro.observe(mapRef.current);
    document.fonts?.ready.then(redraw);
    return () => {
      window.removeEventListener("resize", redraw);
      ro.disconnect();
    };
  }, [draw, mapRef]);
}
