'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

/** Jeda 15 menit setelah sprint. Bisa dilewati kapan saja, tanpa penalti. */
export function BreakOverlay({ minutes = 15, onClose }: { minutes?: number; onClose: () => void }) {
  const [left, setLeft] = useState(minutes * 60);
  useEffect(() => {
    const end = Date.now() + minutes * 60_000;
    const t = window.setInterval(() => {
      const s = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) onClose();
    }, 1000);
    return () => window.clearInterval(t);
  }, [minutes, onClose]);
  const m = String(Math.floor(left / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Waktu istirahat" className="fixed inset-0 z-[75] grid place-items-center bg-bg/95 px-6 backdrop-blur-sm">
      <div className="max-w-sm text-center">
        <p className="font-heading text-lg font-semibold text-ink">Istirahat dulu</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">Berdiri, minum air, lihat yang jauh. Otak butuh ruang kosong sebelum sprint berikutnya.</p>
        <p className="tabular mt-6 font-heading text-5xl font-bold text-ink">{m}:{s}</p>
        <button type="button" onClick={onClose} className="mt-8 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:text-ink">
          Lewati istirahat
        </button>
      </div>
    </motion.div>
  );
}
