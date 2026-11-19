/** ミチスジのロゴ（横組み）。元データは 設計/ロゴ/ミチスジ_ロゴ_横_白地.svg（2026-11-17版） */
export function Logo() {
  return (
    // 静的エクスポートのため next/image ではなく img で読み込む
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.svg" alt="ミチスジ" className="logo" />
  );
}
