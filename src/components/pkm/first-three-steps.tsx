'use client';

import { useState } from 'react';
import { Check, Footprints } from 'lucide-react';
import { chunkTask, toggleTaskStep } from '@/app/actions/adhd';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const DONE = '[x] ';
const isDone = (s: string) => s.startsWith(DONE);
const clean = (s: string) => (isDone(s) ? s.slice(DONE.length) : s);

/** Panel tiga langkah fisik pertama. Mengecilkan energi aktivasi: cukup satu langkah dulu. */
export function FirstThreeSteps({ taskId, steps }: { taskId: string; steps: string[] }) {
  const toast = useToast();
  const [local, setLocal] = useState(steps);
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const r = await chunkTask(taskId);
      toast({ kind: r.ok ? 'success' : 'error', message: r.message ?? 'Selesai.' });
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(i: number) {
    const before = local;
    setLocal((cur) => cur.map((s, j) => (j === i ? (isDone(s) ? clean(s) : `${DONE}${s}`) : s)));
    try {
      const r = await toggleTaskStep(taskId, i);
      if (!r.ok) throw new Error(r.message);
      if (r.message) toast({ message: r.message });
    } catch {
      setLocal(before);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  if (steps.length === 0) {
    return (
      <button type="button" onClick={ask} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-brand-solid/50 hover:text-brand disabled:opacity-50">
        <Footprints size={12} /> Kasih 3 langkah
      </button>
    );
  }

  return (
    <ul className="mt-2 space-y-1" aria-label="Tiga langkah pertama">
      {local.map((s, i) => (
        <li key={`${i}-${clean(s)}`}>
          <button type="button" role="checkbox" aria-checked={isDone(s)} onClick={() => toggle(i)} className="group flex w-full items-center gap-2 rounded-md px-1 py-0.5 text-left text-xs transition hover:bg-surface-2">
            <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors', isDone(s) ? 'border-mint bg-mint text-navy' : 'border-ink-faint/60 group-hover:border-brand-solid')}>
              {isDone(s) && <Check size={10} strokeWidth={3.4} />}
            </span>
            <span className={cn(isDone(s) ? 'text-ink-faint line-through decoration-ink-faint/50' : 'text-ink-soft')}>{clean(s)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
