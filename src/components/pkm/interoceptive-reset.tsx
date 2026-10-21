'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { logResetSession } from '@/app/actions/adhd';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

// Tarik 4, tahan 4, hembus 6 (detik). Lingkaran mengembang dan menyusut mengikuti.
const PHASES = [
  { label: 'Tarik napas', s: 4, scale: 1 },
  { label: 'Tahan', s: 4, scale: 1 },
  { label: 'Hembuskan pelan', s: 6, scale: 0.6 },
] as const;
const LENGTHS = [1, 2, 5];

export function InteroceptiveReset() {
  const toast = useToast();
  const [minutes, setMinutes] = useState(2);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [left, setLeft] = useState(0);
  const start = useRef(0);

  useEffect(() => {
    if (!running) return;
    let idx = 0;
    let t: number;
    const step = () => {
      setPhase(idx % 3);
      t = window.setTimeout(() => {
        idx += 1;
        step();
      }, PHASES[idx % 3].s * 1000);
    };
    step();
    const clock = window.setInterval(() => {
      const remain = Math.max(0, Math.round((start.current + minutes * 60_000 - Date.now()) / 1000));
      setLeft(remain);
      if (remain === 0) finish(true);
    }, 500);
    return () => {
      window.clearTimeout(t);
      window.clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  function begin() {
    start.current = Date.now();
    setLeft(minutes * 60);
    setRunning(true);
  }
  async function finish(complete: boolean) {
    setRunning(false);
    if (!complete) return;
    try {
      const r = await logResetSession(minutes, 'napas 4-4-6');
      toast({ message: r.message ?? 'Selesai.' });
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  const p = PHASES[phase];
  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="relative grid h-64 w-64 place-items-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-brand-soft"
          animate={{ scale: running ? p.scale : 0.8 }}
          transition={{ duration: running ? (phase === 1 ? 0.2 : p.s) : 0.4, ease: 'easeInOut' }}
        />
        <div className="relative text-center">
          <p className="font-heading text-lg font-semibold text-ink" aria-live="polite">{running ? p.label : 'Siap?'}</p>
          {running && <p className="tabular mt-1 text-sm text-ink-soft">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>}
        </div>
      </div>
      {running ? (
        <Button variant="secondary" onClick={() => finish(false)}>Berhenti, tidak apa-apa</Button>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2" role="radiogroup" aria-label="Lama reset">
            {LENGTHS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={minutes === m} onClick={() => setMinutes(m)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${minutes === m ? 'border-brand-solid bg-brand-soft text-brand' : 'border-line text-ink-soft hover:text-ink'}`}>
                {m} menit
              </button>
            ))}
          </div>
          <Button onClick={begin}>Mulai</Button>
        </div>
      )}
    </div>
  );
}
