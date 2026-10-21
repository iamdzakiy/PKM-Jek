import { GrowBar } from '@/components/motion/primitives';
import { PV_WEIGHTS, type PreservationValueBreakdown } from '@/lib/memory/scoring';
import { pct } from '@/lib/utils';

const ROWS: { key: keyof typeof PV_WEIGHTS; label: string; hint: string }[] = [
  { key: 'UI', label: 'Investasi', hint: 'Seberapa sering kamu mengedit dan mengerjakannya' },
  { key: 'G', label: 'Gravitasi', hint: 'Jumlah koneksi: topik, orang, proyek' },
  { key: 'SG', label: 'Social Graph', hint: 'Pentingnya orang yang terhubung' },
  { key: 'P', label: 'Popularitas', hint: 'Total interaksi sepanjang hidup catatan' },
  { key: 'C', label: 'Coverage', hint: 'Seberapa mewakili topiknya' },
  { key: 'Q', label: 'Quality', hint: 'Kelengkapan isi' },
];

export function PvBreakdown({ breakdown }: { breakdown: PreservationValueBreakdown }) {
  return (
    <ul className="space-y-3">
      {ROWS.map((r, i) => (
        <li key={r.key} title={r.hint}>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-ink">
              {r.label} <span className="font-normal text-ink-faint">× {Math.round(PV_WEIGHTS[r.key] * 100)}%</span>
            </span>
            <span className="tabular text-ink-soft">{pct(breakdown[r.key])}%</span>
          </div>
          <GrowBar value={breakdown[r.key]} className="bg-mint" delay={i * 0.06} />
        </li>
      ))}
    </ul>
  );
}
