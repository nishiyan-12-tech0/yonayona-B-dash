import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Azure Static Web Apps へ静的サイトとしてデプロイするため、ビルド結果を out/ に書き出す。
  // cacheComponents / partialPrefetching (PPR) は静的エクスポートと併用できないため無効にしている。
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
