import { PERSP, PERSPS } from '@/lib/constants';
import type { PerspShare } from '@/lib/types';

/** 指標の視点別の構成（積み上げの横棒） */
export function PerspStack({ share }: { share: PerspShare }) {
  return (
    <div className="stack">
      {PERSPS.map((p) => (
        <i key={p} className={`p-${p}`} style={{ width: `${share[p]}%` }} title={`${PERSP[p]} ${share[p]}%`} />
      ))}
    </div>
  );
}
