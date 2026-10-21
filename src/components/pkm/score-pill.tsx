'use client';

import { motion } from 'framer-motion';
import { cn, pct } from '@/lib/utils';
import { EASE } from '@/components/motion/primitives';

const HINT: Record<string, string> = {
  MB: 'Memory Buoyancy: seberapa aktif catatan ini baru-baru ini',
  PV: 'Preservation Value: nilai jangka panjang catatan ini',
};

export function ScorePill({ label, value, tone, wide }: { label: string; value: number; tone: 'brand' | 'mint'; wide?: boolean }) {
  const p = pct(value);
  return (
    <div className="flex items-center gap-2 text-xs" title={HINT[label] ?? label}>
      <span className="font-medium text-ink-soft">{label}</span>
      <div className={cn('h-1.5 overflow-hidden rounded-full bg-line/80', wide ? 'w-28' : 'w-14')}>
        <motion.div
          className={cn('h-full rounded-full', tone === 'brand' ? 'bg-brand-solid' : 'bg-mint')}
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          transition={{ duration: 0.7, ease: EASE }}
        />
      </div>
      <span className="tabular w-8 text-right text-ink-soft">{p}%</span>
    </div>
  );
}
