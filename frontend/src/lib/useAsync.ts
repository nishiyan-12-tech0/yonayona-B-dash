"use client";

import { useEffect, useState } from "react";

/** データ取得の結果を持つ。届くまでは null */
export function useAsync<T>(load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((v) => {
      if (alive) setValue(v);
    });
    return () => {
      alive = false;
    };
  }, [load]);
  return value;
}
