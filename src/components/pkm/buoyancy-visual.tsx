'use client';

import { motion } from 'framer-motion';

// Each chip drifts between the three bands: afloat (Last Focus), mid-water (Aktif), sunk (Forgotten).
const CHIPS = [
  { label: 'Ide judul skripsi', left: '4%', ys: [8, 70, 150, 70, 8], dur: 22, delay: 0 },
  { label: 'Jadwal praktikum', left: '46%', ys: [150, 70, 8, 70, 150], dur: 19, delay: 1.5 },
  { label: 'Referensi PIMO', left: '18%', ys: [70, 8, 8, 70, 150, 70], dur: 24, delay: 3 },
  { label: 'Catatan kuliah umum', left: '52%', ys: [8, 8, 70, 150, 150, 70, 8], dur: 26, delay: 0.8 },
  { label: 'Draf proposal', left: '10%', ys: [150, 150, 70, 8, 70, 150], dur: 21, delay: 2.2 },
  { label: 'Link lomba lama', left: '40%', ys: [70, 150, 150, 70, 8, 70], dur: 25, delay: 4 },
];

const BANDS = [
  { label: 'Last Focus', y: 8 },
  { label: 'Aktif', y: 70 },
  { label: 'Forgotten', y: 150 },
];

export function BuoyancyVisual() {
  return (
    <div className="relative h-[210px] w-full max-w-md" aria-hidden="true">
      {BANDS.map((b) => (
        <div key={b.label} className="absolute inset-x-0 flex items-center gap-3" style={{ top: b.y + 12 }}>
          <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">{b.label}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ))}
      {CHIPS.map((c) => (
        <motion.div
          key={c.label}
          className="absolute rounded-lg border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white/85 shadow-sm"
          style={{ left: c.left, top: 0 }}
          initial={{ y: c.ys[0] }}
          animate={{ y: c.ys, opacity: c.ys.map((y) => (y < 40 ? 1 : y < 100 ? 0.65 : 0.3)) }}
          transition={{ duration: c.dur, delay: c.delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          {c.label}
        </motion.div>
      ))}
    </div>
  );
}
