import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'brand' | 'mint' | 'warn' | 'danger' | 'cream';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-soft',
  brand: 'bg-brand-soft text-brand',
  mint: 'bg-mint-soft text-mint',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  cream: 'bg-cream text-navy',
};

export function Badge({ tone = 'neutral', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide', tones[tone], className)}
      {...props}
    />
  );
}
