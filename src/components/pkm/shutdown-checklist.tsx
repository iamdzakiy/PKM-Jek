'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EASE } from '@/components/motion/primitives';

const STEPS = [
  'Tangkap semua yang masih menggantung di kepala',
  'Proses catatan yang baru masuk',
  'Perbarui status tugas hari ini',
  'Jadwalkan time-block untuk besok',
  'Nyatakan "Shutdown selesai"',
];

function todayKey() {
  // en-CA formats as YYYY-MM-DD; pinned to Jakarta so "today" matches the user's day.
  return `sb-shutdown-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())}`;
}

export function ShutdownChecklist() {
  const [done, setDone] = useState<boolean[]>(() => STEPS.map(() => false));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(todayKey()) ?? 'null') as boolean[] | null;
      if (Array.isArray(saved) && saved.length === STEPS.length) setDone(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  function persist(next: boolean[]) {
    setDone(next);
    try {
      localStorage.setItem(todayKey(), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const count = done.filter(Boolean).length;
  const complete = ready && count === STEPS.length;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-medium text-ink-faint tabular">
          {count} dari {STEPS.length} langkah
        </p>
        {count > 0 && (
          <button type="button" onClick={() => persist(STEPS.map(() => false))} className="inline-flex items-center gap-1 text-xs text-ink-faint transition hover:text-ink">
            <RotateCcw size={12} /> Atur ulang
          </button>
        )}
      </div>

      <ul className="space-y-1">
        {STEPS.map((step, i) => (
          <li key={step}>
            <button
              type="button"
              role="checkbox"
              aria-checked={done[i]}
              onClick={() => persist(done.map((d, j) => (j === i ? !d : d)))}
              className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-surface-2"
            >
              <span
                className={cn(
                  'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
                  done[i] ? 'border-brand-solid bg-brand-solid text-white' : 'border-ink-faint/60 group-hover:border-brand-solid'
                )}
              >
                <AnimatePresence initial={false}>
                  {done[i] && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 26 }}>
                      <Check size={13} strokeWidth={3.2} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
              <span className={cn('text-sm transition-colors', done[i] ? 'text-ink-faint line-through decoration-ink-faint/50' : 'text-ink')}>{step}</span>
            </button>
          </li>
        ))}
      </ul>

      <AnimatePresence>
        {complete && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-mint-soft px-4 py-3">
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true">
                <motion.circle cx="13" cy="13" r="11" stroke="rgb(var(--mint))" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, ease: EASE }} />
                <motion.path d="m8 13.5 3.5 3.5L18 10" stroke="rgb(var(--mint))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.45, ease: EASE }} />
              </svg>
              <div>
                <p className="text-sm font-semibold text-mint">Shutdown selesai</p>
                <p className="text-xs text-ink-soft">Semua loop tertutup. Tutup pekerjaan dan nikmati malammu.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
