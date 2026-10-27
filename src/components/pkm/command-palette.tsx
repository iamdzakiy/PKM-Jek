'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CalendarDays, CheckSquare, CornerDownLeft, FolderKanban, Hash, Moon, NotebookText, Plus, Search, User } from 'lucide-react';
import { quickCapture } from '@/app/actions/capture';
import { searchEverything, type SearchHit, type SearchResult } from '@/app/actions/search';
import { useToast } from '@/components/ui/toast';
import { EASE } from '@/components/motion/primitives';
import { cn } from '@/lib/utils';
import { ALL_NAV } from './nav';

const KIND_ICON: Record<SearchHit['kind'], typeof Search> = {
  note: NotebookText,
  task: CheckSquare,
  project: FolderKanban,
  topic: Hash,
  person: User,
  event: CalendarDays,
};

const EXAMPLES = ['rapat minggu lalu soal sponsor', '#imd', 'statdas kemarin', 'ide bisnis'];

/** Pertanyaan, tag, atau kata waktu = niatnya mencari, bukan menangkap. */
function looksLikeSearch(q: string) {
  return /\?\s*$|^(apa|kapan|siapa|di ?mana|gimana|bagaimana|cari|mana|yang)\b|^#\S+$|\b(kemarin|minggu lalu|minggu ini|bulan lalu|bulan ini|hari ini)\b/i.test(q.trim());
}

type Row = { key: string; label: string; sub?: string | null; meta?: string | null; icon: typeof Search; sunk?: boolean; run: () => void; tone?: 'capture' };

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [active, setActive] = useState(0);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    if (!open) return;
    setQ('');
    setResult(null);
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Cari setelah jeda singkat mengetik.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setResult(null);
      return;
    }
    const t = window.setTimeout(() => {
      startSearch(async () => {
        try {
          setResult(await searchEverything(text));
        } catch {
          setResult({ hits: [], when: null, terms: [] });
        }
      });
    }, 180);
    return () => window.clearTimeout(t);
  }, [q]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function capture() {
    const text = q.trim();
    if (!text) return;
    const fd = new FormData();
    fd.set('text', text);
    fd.set('device', 'text');
    startSave(async () => {
      const r = await quickCapture(fd);
      toast({ kind: r.ok ? 'success' : 'error', message: r.message ?? (r.ok ? 'Tertangkap.' : 'Belum tersimpan.'), href: r.href });
      if (r.ok) onClose();
    });
  }

  const rows: Row[] = useMemo(() => {
    const text = q.trim();
    if (!text) {
      return ALL_NAV.slice(0, 6).map((n) => ({ key: n.href, label: n.label, icon: n.icon, run: () => go(n.href) }));
    }
    const captureRow: Row = { key: 'capture', label: `Tangkap “${text.length > 60 ? `${text.slice(0, 60)}…` : text}”`, sub: 'Masuk catatan atau inbox. #hariini, #besok, #imd juga jalan.', icon: Plus, run: capture, tone: 'capture' };
    const lower = text.toLowerCase();
    const pages: Row[] = ALL_NAV.filter((n) => n.label.toLowerCase().startsWith(lower)).slice(0, 3).map((n) => ({ key: `nav-${n.href}`, label: `Buka ${n.label}`, icon: n.icon, run: () => go(n.href) }));
    const hits: Row[] = (result?.hits ?? []).map((h) => ({ key: `${h.kind}-${h.id}`, label: h.title, sub: h.snippet, meta: h.meta, icon: KIND_ICON[h.kind], sunk: h.sunk, run: () => go(h.href) }));
    return looksLikeSearch(text) ? [...pages, ...hits, captureRow] : [captureRow, ...pages, ...hits];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, result]);

  useEffect(() => setActive(0), [rows.length, q]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) capture();
      else rows[active]?.run();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-3 pt-[9vh] sm:px-4">
          <motion.div className="absolute inset-0 bg-navy/60 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Cari atau tangkap"
            className="glass relative w-full max-w-xl overflow-hidden rounded-2xl shadow-lift"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.24, ease: EASE }}
          >
            <div className="flex items-center gap-3 border-b border-line/60 px-4">
              <Search size={18} className={cn('shrink-0', searching ? 'animate-pulse text-info' : 'text-ink-faint')} />
              <input
                ref={inputRef}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Cari, atau tulis buat ditangkap…"
                aria-label="Cari atau tangkap"
                aria-controls="cp-list"
                aria-activedescendant={rows[active] ? `cp-${rows[active].key}` : undefined}
                className="h-14 min-w-0 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint"
              />
              {saving && <span className="text-xs text-ink-faint">Menyimpan…</span>}
            </div>

            {result?.when && (
              <p className="flex items-center gap-1.5 px-4 pt-2.5 text-xs text-info">
                <Moon size={12} /> Rentang waktu: {result.when}
              </p>
            )}

            <ul id="cp-list" role="listbox" className="max-h-[56vh] overflow-y-auto p-2">
              {rows.map((r, i) => (
                <li key={r.key} id={`cp-${r.key}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={r.run}
                    className={cn('flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition', i === active ? (r.tone === 'capture' ? 'bg-ranger/15' : 'bg-brand-soft') : 'hover:bg-surface-2/60')}
                  >
                    <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg', r.tone === 'capture' ? 'bg-ranger text-white' : 'bg-surface-2 text-ink-soft')}>
                      <r.icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{r.label}</span>
                        {r.sunk && <span className="shrink-0 rounded bg-surface-2 px-1.5 text-[10px] font-semibold text-ink-faint">diarsipkan</span>}
                      </span>
                      {r.sub && <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">{r.sub}</span>}
                    </span>
                    {r.meta && <span className="shrink-0 pt-0.5 text-[11px] text-ink-faint">{r.meta}</span>}
                    {i === active && <CornerDownLeft size={14} className="mt-1 shrink-0 text-ink-faint" aria-hidden="true" />}
                  </button>
                </li>
              ))}
              {q.trim().length >= 2 && !searching && result && result.hits.length === 0 && (
                <li className="px-3 py-3 text-sm text-ink-faint">Belum ketemu. Coba kata lain, atau tekan Enter buat menangkapnya.</li>
              )}
            </ul>

            {!q && (
              <div className="border-t border-line/60 px-4 py-3">
                <p className="text-xs text-ink-faint">Coba ketik:</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} type="button" onClick={() => setQ(ex)} className="inline-flex items-center gap-1 rounded-lg bg-surface-2/70 px-2 py-1 text-xs text-ink-soft hover:text-ink">
                      {ex} <ArrowRight size={11} />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="hidden border-t border-line/60 px-4 py-2 text-[11px] text-ink-faint sm:block">↑↓ pilih · Enter buka · Ctrl+Enter selalu tangkap · Esc tutup</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
