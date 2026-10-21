'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';

type Phase = 'idle' | 'running' | 'paused' | 'done';
const STORAGE_KEY = 'sb-focus-block';
const PRESETS = [
  { value: '25', label: '25m' },
  { value: '50', label: '50m' },
  { value: '90', label: '90m' },
];

const R = 54;
const C = 2 * Math.PI * R;

function fmt(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Time-block execution. Remaining time is derived from an end timestamp, not
 * from counting ticks, so a throttled background tab cannot make it drift.
 */
export function FocusTimer({ focusOn }: { focusOn?: string | null }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState('90');
  const [phase, setPhase] = useState<Phase>('idle');
  const [remaining, setRemaining] = useState(90 * 60_000);
  const endAt = useRef<number>(0);
  const total = Number(minutes) * 60_000;

  const finish = useCallback(() => {
    setPhase('done');
    setRemaining(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    toast({ message: 'Blok fokus selesai. Berdiri dan istirahat sebentar.' });
  }, [toast]);

  // Restore a block that was running when the page was reloaded.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { endAt: number; minutes: string } | null;
      if (saved && saved.endAt > Date.now()) {
        endAt.current = saved.endAt;
        setMinutes(saved.minutes);
        setRemaining(saved.endAt - Date.now());
        setPhase('running');
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const left = endAt.current - Date.now();
      if (left <= 0) {
        window.clearInterval(id);
        finish();
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, finish]);

  function start() {
    endAt.current = Date.now() + (phase === 'paused' ? remaining : total);
    if (phase !== 'paused') setRemaining(total);
    setPhase('running');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ endAt: endAt.current, minutes }));
    } catch {
      /* ignore */
    }
  }

  function pause() {
    setRemaining(Math.max(0, endAt.current - Date.now()));
    setPhase('paused');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function reset() {
    setPhase('idle');
    setRemaining(total);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function pick(v: string) {
    setMinutes(v);
    setPhase('idle');
    setRemaining(Number(v) * 60_000);
  }

  const progress = phase === 'idle' ? 0 : 1 - remaining / total;
  const running = phase === 'running';

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative h-36 w-36 shrink-0" role="timer" aria-label={`Sisa waktu ${fmt(remaining)}`}>
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgb(var(--line))" strokeWidth="7" />
          <motion.circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={phase === 'done' ? 'rgb(var(--mint))' : 'rgb(var(--brand-solid))'}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            animate={{ strokeDashoffset: C * (1 - progress) }}
            transition={{ duration: running ? 0.3 : 0.6, ease: 'linear' }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="tabular font-heading text-[26px] font-bold leading-none text-ink">{fmt(remaining)}</p>
            <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              {phase === 'running' ? 'fokus' : phase === 'paused' ? 'jeda' : phase === 'done' ? 'selesai' : 'siap'}
            </p>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-3.5 text-center sm:text-left">
        <div>
          <p className="text-xs font-medium text-ink-faint">Blok fokus</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink">
            {focusOn ? <>Kerjakan <span className="font-semibold">{focusOn}</span>. Abaikan semua yang lain sampai blok ini selesai.</> : 'Pilih satu hal. Abaikan semua yang lain sampai blok ini selesai.'}
          </p>
        </div>
        <Segmented label="Durasi blok" size="sm" value={minutes} onChange={pick} options={PRESETS} className={running ? 'pointer-events-none opacity-50' : ''} />
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          {running ? (
            <Button size="sm" variant="secondary" onClick={pause}>
              <Pause size={14} /> Jeda
            </Button>
          ) : (
            <Button size="sm" onClick={phase === 'done' ? reset : start}>
              {phase === 'done' ? <RotateCcw size={14} /> : <Play size={14} />}
              {phase === 'paused' ? 'Lanjut' : phase === 'done' ? 'Blok baru' : 'Mulai'}
            </Button>
          )}
          {(phase === 'running' || phase === 'paused') && (
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw size={14} /> Ulang
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
