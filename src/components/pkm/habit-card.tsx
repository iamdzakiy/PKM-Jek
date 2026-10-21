'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Shuffle } from 'lucide-react';
import { archiveHabit, completeHabit, rotateHabitVariant, tickHabitStep } from '@/app/actions/adhd';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export interface HabitDTO {
  id: string;
  name: string;
  anchorTrigger: string | null;
  firstSteps: string[];
  variants: string[];
  stepsDone: number;
  completed: boolean;
  weekDots: boolean[]; // 7 hari terakhir
}

export function HabitCard({ habit }: { habit: HabitDTO }) {
  const toast = useToast();
  const router = useRouter();
  const [steps, setSteps] = useState(habit.stepsDone);
  const [done, setDone] = useState(habit.completed);
  const [variant, setVariant] = useState<string | null>(null);

  async function tick(i: number) {
    const on = i >= steps;
    const prevSteps = steps;
    const prevDone = done;
    setSteps(on ? i + 1 : i);
    if (on) setDone(true);
    try {
      const r = await tickHabitStep(habit.id, i, on);
      if (!r.ok) throw new Error();
      if (r.message) toast({ message: r.message });
      router.refresh();
    } catch {
      setSteps(prevSteps);
      setDone(prevDone);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }
  async function finish() {
    const prev = done;
    setDone(true);
    try {
      const r = await completeHabit(habit.id, variant);
      if (!r.ok) throw new Error();
      toast({ message: r.message ?? 'Sudah.' });
      router.refresh();
    } catch {
      setDone(prev);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }
  async function shuffle() {
    try {
      const r = await rotateHabitVariant(habit.id);
      if (r.variant) setVariant(r.variant);
      if (r.message) toast({ message: r.message });
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  return (
    <li className={cn('rounded-card border bg-surface p-4 shadow-card', done ? 'border-mint/50' : 'border-line')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-ink">{habit.name}</p>
          {habit.anchorTrigger && <p className="mt-0.5 text-xs text-ink-faint">Setelah {habit.anchorTrigger.replace(/^setelah\s+/i, '')}</p>}
        </div>
        <div className="flex gap-1" aria-label="7 hari terakhir">
          {habit.weekDots.map((d, i) => (
            <span key={i} className={cn('h-2.5 w-2.5 rounded-full', d ? 'bg-mint' : 'bg-surface-2')} />
          ))}
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {habit.firstSteps.map((s, i) => (
          <li key={i}>
            <button type="button" role="checkbox" aria-checked={i < steps} onClick={() => tick(i)} className="flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-sm hover:bg-surface-2">
              <span className={cn('grid h-4 w-4 place-items-center rounded border', i < steps ? 'border-mint bg-mint text-navy' : 'border-ink-faint/60')}>
                {i < steps && <Check size={10} strokeWidth={3.4} />}
              </span>
              <span className={i < steps ? 'text-ink-faint line-through' : 'text-ink-soft'}>{s}</span>
            </button>
          </li>
        ))}
      </ul>

      {variant && <p className="mt-2 text-xs text-brand">Format hari ini: {variant}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={finish} disabled={done} className="rounded-lg bg-brand-solid px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110 disabled:bg-mint-soft disabled:text-mint">
          {done ? 'Sudah hari ini' : 'Tandai selesai'}
        </button>
        {habit.variants.length > 0 && (
          <button type="button" onClick={shuffle} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2">
            <Shuffle size={12} /> Format lain
          </button>
        )}
        <button type="button" onClick={async () => { await archiveHabit(habit.id); router.refresh(); }} className="ml-auto text-xs text-ink-faint hover:text-ink">
          Arsipkan
        </button>
      </div>
    </li>
  );
}
