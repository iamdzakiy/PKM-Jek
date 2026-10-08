'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Two-step delete: first click arms it for 4 seconds, second click confirms. */
export function ConfirmDelete({ action, label = 'Hapus' }: { action: () => Promise<void>; label?: string }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  async function confirm() {
    setBusy(true);
    try {
      await action();
    } catch {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {armed ? (
        <motion.div key="armed" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setArmed(false)}>
            Batal
          </Button>
          <Button size="sm" loading={busy} onClick={confirm} className="bg-danger text-white hover:brightness-110">
            Ya, hapus
          </Button>
        </motion.div>
      ) : (
        <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Button size="sm" variant="danger" onClick={() => setArmed(true)}>
            <Trash2 size={14} /> {label}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
