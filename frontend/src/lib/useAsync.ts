"use client";

import { useEffect, useState } from "react";

/** データ取得の結果を持つ。届くまでは null。失敗したら error に日本語の説明が入る */
export function useAsync<T>(load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    let alive = true;
    load()
      .then((v) => {
        if (alive) setValue(v);
      })
      .catch((e: unknown) => console.error(e));
    return () => {
      alive = false;
    };
  }, [load]);
  return value;
}
