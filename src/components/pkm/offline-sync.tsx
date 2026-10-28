'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { flush, useOutbox } from '@/lib/offline/outbox';

/**
 * Pasang service worker, kirim ulang outbox saat online, dan tampilkan pil
 * kecil "Offline · N menunggu sync" supaya jelas apa yang belum terkirim.
 */
export function OfflineSync() {
  const router = useRouter();
  const toast = useToast();
  const pending = useOutbox();
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    try {
      const { sent, rejected } = await flush();
      if (sent) {
        toast({ message: `Online lagi. ${sent} perubahan tersinkron ☁️` });
        router.refresh();
      }
      if (rejected.length) toast({ kind: 'error', message: `Ditolak server: ${rejected.slice(0, 2).join(', ')}${rejected.length > 2 ? '…' : ''}` });
    } finally {
      setSyncing(false);
    }
  }, [router, toast]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      void sync();
    };
    const down = () => setOnline(false);
    const visible = () => document.visibilityState === 'visible' && void sync();
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    document.addEventListener('visibilitychange', visible);
    void sync();
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [sync]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js')
      .then(async (reg) => {
        await navigator.serviceWorker.ready;
        if (navigator.onLine) (reg.active ?? reg.waiting ?? reg.installing)?.postMessage('warm');
      })
      .catch(() => undefined);
  }, []);

  const show = !online || pending.length > 0;
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={() => void sync()}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className="glass fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-ink shadow-lift md:bottom-5"
          aria-live="polite"
        >
          {online ? <RefreshCw size={14} className={syncing ? 'animate-spin text-info' : 'text-info'} /> : <CloudOff size={14} className="text-gold" />}
          {online ? (syncing ? 'Lagi sync…' : `${pending.length} menunggu sync · ketuk buat kirim`) : `Offline${pending.length ? ` · ${pending.length} menunggu sync` : ' · perubahan disimpan di HP'}`}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
