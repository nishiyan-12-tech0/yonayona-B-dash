'use client';

import { useCallback, useEffect, type RefObject } from 'react';
import type { StrategyData } from '@/lib/types';

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
) {
  const draw = useCallback(() => {
    const svg = svgRef.current;
    const map = mapRef.current;
    if (!svg || !map || !map.offsetParent) return;
    const R = map.getBoundingClientRect();
    let p = MARKERS;
    data.bus.forEach((b) => {
      b.links.forEach((l) => {
        const A = document.getElementById('o-' + l.from);
        const B = document.getElementById('o-' + l.to);
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
        p += `<path d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}" fill="none" style="stroke:var(${hi ? '--accent' : '--muted'})" stroke-width="${hi ? 2.4 : 1.5}" opacity="${on ? 0.9 : 0.13}" marker-end="url(#${hi ? 'ahd' : 'ah'})"/>`;
      });
    });
    svg.innerHTML = p;
  }, [mapRef, svgRef, data, focusObjs]);

  // 画面が描き変わるたびに引き直す
  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  });

  // 幅や高さが変わったとき（ウィンドウ、詳細の開閉、フォントの読み込み）も引き直す
  useEffect(() => {
    const redraw = () => requestAnimationFrame(draw);
    window.addEventListener('resize', redraw);
    const ro = new ResizeObserver(redraw);
    if (mapRef.current) ro.observe(mapRef.current);
    document.fonts?.ready.then(redraw);
    return () => {
      window.removeEventListener('resize', redraw);
      ro.disconnect();
    };
  }, [draw, mapRef]);
}
