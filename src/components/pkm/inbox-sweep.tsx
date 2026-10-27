'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, CalendarPlus, Inbox, Sun, Trash2, X } from 'lucide-react';
import { deferTask, dropTask, planTask } from '@/app/actions/today';
import { useToast } from '@/components/ui/toast';
import type { ActionResult } from '@/lib/types';

const CHOICES = [
  { key: '1', label: 'Hari ini', icon: Sun, tone: 'bg-brand-solid text-white', run: (id: string) => planTask(id, 'today') },
  { key: '2', label: 'Besok', icon: CalendarPlus, tone: 'bg-surface-2 text-ink', run: (id: string) => planTask(id, 'tomorrow') },
  { key: '3', label: 'Minggu depan', icon: CalendarClock, tone: 'bg-surface-2 text-ink', run: (id: string) => deferTask(id, 7) },
  { key: '4', label: 'Buang', icon: Trash2, tone: 'bg-danger-soft text-danger', run: (id: string) => dropTask(id) },
] as const;

/**
 * Proses inbox satu per satu: satu pikiran di layar, empat pilihan, lanjut.
 * Keputusan disimpan di belakang layar supaya kartu berikutnya langsung muncul.
 */
export function InboxSweep({ items, onClose }: { items: { id: string; title: string }[]; onClose: (changed: boolean) => void }) {
  const toast = useToast();
  const [list] = useState(items);
  const [at, setAt] = useState(0);
  const [failed, setFailed] = useState(0);
  const current = list[at];

  function choose(run: (id: string) => Promise<ActionResult>) {
    if (!current) return;
    setAt((i) => i + 1);
    run(current.id)
      .then((r) => {
        if (!r.ok) throw new Error();
      })
      .catch(() => setFailed((n) => n + 1));
  }

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(at > 0);
      const c = CHOICES.find((x) => x.key === e.key);
      if (c && current) choose(c.run);
      if (e.key === 'ArrowRight' && current) setAt((i) => i + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, current]);

  useEffect(() => {
    if (!current && failed) toast({ kind: 'error', message: `${failed} item belum tersimpan. Masih ada di inbox.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return createPortal(
    <div className="fixed inset-0 z-[75] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <motion.div className="absolute inset-0 bg-navy/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => onClose(at > 0)} aria-hidden="true" />
      <motion.div role="dialog" aria-modal="true" aria-label="Proses inbox" className="glass relative w-full max-w-md overflow-hidden rounded-card p-5 shadow-lift" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
            <Inbox size={13} /> Inbox · {Math.min(at + 1, list.length)} dari {list.length}
          </p>
          <button type="button" onClick={() => onClose(at > 0)} aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-xl text-ink-faint hover:bg-surface-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full rounded-full bg-ranger" initial={false} animate={{ width: `${(at / list.length) * 100}%` }} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {current ? (
            <motion.div key={current.id} initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -40, opacity: 0, transition: { duration: 0.12 } }}>
              <p className="mt-6 min-h-[64px] font-heading text-[22px] font-bold leading-snug text-ink">{current.title}</p>
              <p className="mt-1 text-sm text-ink-faint">Kapan ini dikerjain?</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {CHOICES.map((c) => (
                  <button key={c.key} type="button" onClick={() => choose(c.run)} className={`flex h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold transition hover:brightness-105 active:scale-[0.98] ${c.tone}`}>
                    <c.icon size={16} /> {c.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setAt((i) => i + 1)} className="mt-2 h-10 w-full text-sm text-ink-faint hover:text-ink">
                Lewati, putuskan nanti
              </button>
              <p className="hidden text-center text-[11px] text-ink-faint sm:block">Tombol 1–4 · → lewati · Esc tutup</p>
            </motion.div>
          ) : (
            <motion.div key="done" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-6 text-center">
              <p className="text-4xl" aria-hidden="true">🧠✨</p>
              <p className="mt-3 font-heading text-xl font-bold text-ink">Inbox beres. Kepala lega.</p>
              <button type="button" autoFocus onClick={() => onClose(true)} className="mt-5 h-12 w-full rounded-2xl bg-ranger font-bold text-white">
                Balik ke misi
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
}
