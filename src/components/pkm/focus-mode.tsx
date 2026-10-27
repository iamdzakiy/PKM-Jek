'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pause, Play, Plus, Rocket, X } from 'lucide-react';
import { usePrefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';

type Phase = 'running' | 'paused' | 'checkin' | 'over';

const R = 120;
const C = 2 * Math.PI * R;
/** Check-in yang tidak dijawab selama ini = kemungkinan besar sudah pindah fokus. */
const CHECKIN_GRACE_MS = 60_000;

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Mode fokus layar penuh untuk satu misi. Sisa waktu dihitung dari timestamp
 * akhir (tidak melenceng di tab yang di-throttle). Tiap beberapa menit muncul
 * "Masih di sini?"; kalau tidak dijawab, timer berhenti sendiri supaya
 * menit yang hilang tidak ikut terhitung fokus.
 */
export function FocusMode({ title, hint, onDone, onClose, chime }: { title: string; hint?: string | null; onDone: () => void; onClose: () => void; chime: (big?: boolean) => void }) {
  const [prefs] = usePrefs();
  const total = useRef(prefs.focusMin * 60_000);
  const [phase, setPhase] = useState<Phase>('running');
  const [left, setLeft] = useState(total.current);
  const [autoPaused, setAutoPaused] = useState(false);
  const endAt = useRef(Date.now() + total.current);
  const nextCheck = useRef(prefs.checkInMin > 0 ? Date.now() + prefs.checkInMin * 60_000 : Infinity);
  const checkSince = useRef(0);

  const pause = useCallback(() => {
    setLeft(endAt.current - Date.now());
    setPhase('paused');
  }, []);

  const resume = useCallback(() => {
    endAt.current = Date.now() + left;
    nextCheck.current = prefs.checkInMin > 0 ? Date.now() + prefs.checkInMin * 60_000 : Infinity;
    setAutoPaused(false);
    setPhase('running');
  }, [left, prefs.checkInMin]);

  useEffect(() => {
    if (phase !== 'running' && phase !== 'checkin') return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const remaining = endAt.current - now;
      if (remaining <= 0) {
        setLeft(0);
        setPhase('over');
        chime(true);
        return;
      }
      if (phase === 'running') {
        setLeft(remaining);
        if (now >= nextCheck.current && remaining > 30_000) {
          checkSince.current = now;
          setPhase('checkin');
          chime();
        }
      } else if (now - checkSince.current > CHECKIN_GRACE_MS) {
        // Tidak dijawab: hentikan di saat check-in muncul, bukan sekarang.
        endAt.current += now - checkSince.current;
        setLeft(endAt.current - now);
        setAutoPaused(true);
        setPhase('paused');
      } else {
        setLeft(remaining);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, chime]);

  // Layar tetap nyala selama fokus (kalau browser mendukung).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => undefined);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === ' ' && phase !== 'over' && phase !== 'checkin') {
        e.preventDefault();
        if (phase === 'running') pause();
        else resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, pause, resume, onClose]);

  function stillHere() {
    nextCheck.current = Date.now() + prefs.checkInMin * 60_000;
    setPhase('running');
  }

  function extend() {
    endAt.current = Date.now() + 5 * 60_000;
    total.current = Math.max(total.current, 5 * 60_000);
    nextCheck.current = prefs.checkInMin > 0 ? Date.now() + prefs.checkInMin * 60_000 : Infinity;
    setLeft(5 * 60_000);
    setPhase('running');
  }

  function finish() {
    onDone();
    onClose();
  }

  const pct = Math.min(1, Math.max(0, left / total.current));

  return createPortal(
    <motion.div role="dialog" aria-modal="true" aria-label="Mode fokus" className="fixed inset-0 z-[80] flex flex-col bg-[#0B0E14] text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-solid/25 blur-[120px]" />
      <div className="relative flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/60">
          <Rocket size={13} /> Mode fokus
        </p>
        <button type="button" onClick={onClose} aria-label="Keluar dari mode fokus" className="grid h-10 w-10 place-items-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h2 className="max-w-xl font-heading text-[26px] font-bold leading-tight sm:text-[32px]">{title}</h2>
        {hint && <p className="mt-2 max-w-md text-sm text-white/60">{hint}</p>}

        <div className="relative mt-8 h-[min(72vw,280px)] w-[min(72vw,280px)]">
          <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="140" cy="140" r={R} fill="none" strokeWidth="10" className="stroke-white/10" />
            <circle cx="140" cy="140" r={R} fill="none" strokeWidth="10" strokeLinecap="round" className={cn('transition-[stroke-dashoffset] duration-300', phase === 'over' ? 'stroke-ranger' : 'stroke-gold')} strokeDasharray={C} strokeDashoffset={C * (1 - pct)} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-[56px] font-bold leading-none tabular" role="timer" aria-live="off">
              {fmt(left)}
            </span>
            <span className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">{phase === 'paused' ? (autoPaused ? 'Dijeda otomatis' : 'Dijeda') : phase === 'over' ? 'Waktu habis' : `dari ${prefs.focusMin} menit`}</span>
          </div>
        </div>

        {autoPaused && phase === 'paused' && <p className="mt-4 text-sm text-gold">Nggak ada jawaban, jadi aku jeda. Lanjut kalau udah balik.</p>}
      </div>

      <div className="relative mx-auto w-full max-w-md space-y-2.5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {phase === 'over' ? (
          <>
            <button type="button" onClick={finish} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ranger text-base font-extrabold uppercase tracking-wide shadow-[0_5px_0_rgb(40_110_25)] transition active:translate-y-[3px] active:shadow-[0_2px_0_rgb(40_110_25)]">
              <Check size={20} strokeWidth={3.2} /> Mission cleared
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" onClick={extend} className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-white/10 text-sm font-semibold ring-1 ring-inset ring-white/15 hover:bg-white/15">
                <Plus size={16} /> 5 menit lagi
              </button>
              <button type="button" onClick={onClose} className="h-12 rounded-2xl bg-white/10 text-sm font-semibold ring-1 ring-inset ring-white/15 hover:bg-white/15">
                Istirahat dulu
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button type="button" onClick={finish} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-ranger text-base font-extrabold uppercase tracking-wide shadow-[0_5px_0_rgb(40_110_25)] transition active:translate-y-[3px] active:shadow-[0_2px_0_rgb(40_110_25)]">
              <Check size={20} strokeWidth={3.2} /> Selesai
            </button>
            <button type="button" onClick={phase === 'running' ? pause : resume} aria-label={phase === 'running' ? 'Jeda' : 'Lanjut'} className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10 ring-1 ring-inset ring-white/15 hover:bg-white/15">
              {phase === 'running' || phase === 'checkin' ? <Pause size={20} /> : <Play size={20} />}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'checkin' && (
          <motion.div className="absolute inset-0 z-10 flex items-end justify-center bg-black/50 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div role="alertdialog" aria-label="Masih di sini?" className="w-full max-w-sm rounded-card bg-[#161B26] p-6 text-center ring-1 ring-white/10" initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, opacity: 0 }}>
              <p className="font-heading text-2xl font-bold">Masih di sini?</p>
              <p className="mt-1 text-sm text-white/60">Kalau tadi sempat melipir, nggak apa-apa. Balik aja ke misinya.</p>
              <div className="mt-5 grid gap-2">
                <button type="button" autoFocus onClick={stillHere} className="h-12 rounded-2xl bg-gold font-bold text-navy hover:brightness-105">
                  Masih fokus
                </button>
                <button type="button" onClick={stillHere} className="h-11 rounded-2xl bg-white/10 text-sm font-semibold hover:bg-white/15">
                  Tadi kedistrak, lanjut lagi
                </button>
                <button type="button" onClick={onClose} className="h-10 text-sm text-white/60 hover:text-white">
                  Udahan dulu
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}
