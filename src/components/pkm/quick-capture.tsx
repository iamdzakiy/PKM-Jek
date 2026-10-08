'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CornerDownLeft, X } from 'lucide-react';
import { quickCapture } from '@/app/actions/capture';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EASE } from '@/components/motion/primitives';

const TAGS = ['#task', '#idea', '#insight'];

export function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  function addTag(tag: string) {
    const el = textRef.current;
    if (!el) return;
    el.value = `${el.value}${el.value && !el.value.endsWith(' ') ? ' ' : ''}${tag} `;
    el.focus();
  }

  function submitOnShortcut(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            className="absolute inset-0 bg-navy/60 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qc-title"
            className="relative w-full max-w-xl rounded-2xl border border-line bg-surface p-5 shadow-lift"
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={{ duration: 0.26, ease: EASE }}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 id="qc-title" className="font-heading text-base font-semibold text-ink">
                  Tangkap cepat
                </h2>
                <p className="mt-0.5 text-sm text-ink-soft">Tulis apa saja. Kosongkan kepala, sisanya diurus sistem.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">
                <X size={17} />
              </Button>
            </div>

            <ActionForm action={quickCapture} onDone={(r) => r.ok && onClose()} className="space-y-3">
              <Textarea
                ref={textRef}
                name="text"
                rows={5}
                autoFocus
                required
                onKeyDown={submitOnShortcut}
                placeholder={'Baris pertama jadi judul.\nTambah #idea, #task, atau #nama-topik di mana saja.'}
                aria-label="Isi catatan"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {TAGS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => addTag(t)}
                      className="rounded-md border border-line bg-surface-2/60 px-2 py-1 text-xs font-medium text-ink-soft transition hover:border-brand-solid/50 hover:text-brand"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="hidden items-center gap-1 text-xs text-ink-faint sm:inline-flex">
                    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px]">Ctrl</kbd>
                    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px]">
                      <CornerDownLeft size={10} className="inline" aria-label="Enter" />
                    </kbd>
                  </span>
                  <SubmitButton>Simpan</SubmitButton>
                </div>
              </div>
            </ActionForm>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
