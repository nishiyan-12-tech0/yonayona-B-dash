import { IPA, IPA_ITEMS, PROGS } from '@/lib/constants';
import { itemRows } from '@/lib/logic';
import type { Snap, StrategyData } from '@/lib/types';

/** 道筋にあるDX（事業 × IPAの7項目）の表 */
export function Heat({ data, snap }: { data: StrategyData; snap: Snap }) {
  return (
    <table className="heat">
      <tbody>
        <tr>
          <th>事業</th>
          {IPA_ITEMS.map((k) => (
            <th key={k} title={IPA[k]}>
              {k}
            </th>
          ))}
        </tr>
        {data.bus.map((b) => {
          const rs = itemRows(data, b, snap);
          return (
            <tr key={b.id}>
              <td>{b.name}</td>
              {IPA_ITEMS.map((k) => {
                const r = rs.find((x) => x.k === k);
                return (
                  <td key={k}>
                    {r ? (
                      <span
                        className={`hc ${r.p >= 3 ? 'h2' : r.p >= 1 ? 'h1' : 'h0'}`}
                        title={r.its.map((i) => i.name).join('・')}
                      >
                        {PROGS[r.p]}
                        {r.p ? 'まで' : ''}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
