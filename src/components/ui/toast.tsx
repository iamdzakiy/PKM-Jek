'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, X } from 'lucide-react';

type ToastKind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  href?: string;
}
type Notify = (t: { kind?: ToastKind; message: string; href?: string }) => void;

const ToastContext = createContext<Notify>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((cur) => cur.filter((t) => t.id !== id)), []);

  const notify = useCallback<Notify>(
    ({ kind = 'success', message, href }) => {
      const id = nextId.current++;
      setItems((cur) => [...cur.slice(-2), { id, kind, message, href }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3800);
    },
    [dismiss]
  );

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[80] flex flex-col items-center gap-2 px-4 md:inset-x-auto md:bottom-6 md:right-6 md:items-end"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-lift"
            >
              <span
                className={
                  t.kind === 'error'
                    ? 'grid h-6 w-6 shrink-0 place-items-center rounded-full bg-danger-soft text-danger'
                    : 'grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-soft text-mint'
                }
              >
                {t.kind === 'error' ? <AlertCircle size={14} /> : <Check size={14} strokeWidth={3} />}
              </span>
              <p className="min-w-0 flex-1 text-sm text-ink">{t.message}</p>
              {t.href && (
                <Link href={t.href} onClick={() => dismiss(t.id)} className="shrink-0 text-sm font-semibold text-brand hover:underline">
                  Buka
                </Link>
              )}
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Tutup" className="shrink-0 text-ink-faint hover:text-ink">
                <X size={15} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
