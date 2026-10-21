'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { toggleHotTopic } from '@/app/actions/pimo';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export function TopicChip({ id, name, isHot, notes }: { id: string; name: string; isHot: boolean; notes: number }) {
  const toast = useToast();
  const [hot, setHot] = useState(isHot);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !hot;
    setHot(next);
    setBusy(true);
    try {
      const r = await toggleHotTopic(id, next);
      if (!r.ok) throw new Error(r.message);
    } catch {
      setHot(!next);
      toast({ kind: 'error', message: 'Gagal memperbarui topik.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn('flex items-center gap-3 rounded-card border bg-surface py-2.5 pl-4 pr-2.5 shadow-card transition-colors', hot ? 'border-warn/50' : 'border-line')}>
      <span className="text-sm font-semibold text-ink">#{name}</span>
      <Badge>{notes} catatan</Badge>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={hot}
        title={hot ? 'Hapus tanda hot' : 'Tandai hot'}
        className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition disabled:opacity-60', hot ? 'bg-warn-soft text-warn' : 'text-ink-soft hover:bg-surface-2 hover:text-ink')}
      >
        <motion.span animate={{ scale: hot ? [1, 1.35, 1] : 1, rotate: hot ? [0, -10, 0] : 0 }} transition={{ duration: 0.35 }} className="grid place-items-center">
          <Flame size={14} fill={hot ? 'currentColor' : 'none'} />
        </motion.span>
        {hot ? 'Hot' : 'Jadikan hot'}
      </button>
    </div>
  );
}
