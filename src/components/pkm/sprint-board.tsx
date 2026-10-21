'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import { endSprint, setTaskEnergy, startSprint } from '@/app/actions/adhd';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';
import { BreakOverlay } from './break-overlay';
import { BodyDouble } from './body-double';
import { EnergyPicker, useEnergyLevel } from './energy-picker';
import { ENERGY_BY_LEVEL, ENERGY_CHIP, ENERGY_HINT, ENERGY_LABEL, ENERGY_TYPES, type Energy } from '@/lib/adhd/energy';
import { cn } from '@/lib/utils';

export interface SprintTask {
  id: string;
  title: string;
  energyType: Energy;
  dueLabel: string | null;
}
export interface ActiveSprint {
  id: string;
  energyType: Energy;
  taskTitle: string | null;
  endsAt: string;
}

const LENGTHS = [
  { value: '25', label: '25m' },
  { value: '50', label: '50m' },
  { value: '90', label: '90m' },
  { value: '120', label: '120m' },
];

export function SprintBoard({ tasks: initial, active }: { tasks: SprintTask[]; active: ActiveSprint | null }) {
  const router = useRouter();
  const toast = useToast();
  const [tasks, setTasks] = useState(initial);
  const [level] = useEnergyLevel();
  const [minutes, setMinutes] = useState('25');
  const [sprint, setSprint] = useState(active);
  const [left, setLeft] = useState(0);
  const [onBreak, setOnBreak] = useState(false);
  const dragId = useRef<string | null>(null);

  useEffect(() => setTasks(initial), [initial]);
  useEffect(() => setSprint(active), [active]);

  const finish = useCallback(async () => {
    if (!sprint) return;
    const id = sprint.id;
    setSprint(null);
    setOnBreak(true);
    try {
      const r = await endSprint(id);
      toast({ message: r.message ?? 'Sprint selesai.' });
      router.refresh();
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }, [sprint, router, toast]);

  useEffect(() => {
    if (!sprint) return;
    const tick = () => {
      const s = Math.round((new Date(sprint.endsAt).getTime() - Date.now()) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) finish();
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [sprint, finish]);

  async function begin(energy: Energy, taskId?: string) {
    try {
      const r = await startSprint(energy, Number(minutes), taskId);
      if (!r.ok) throw new Error(r.message);
      toast({ message: r.message ?? 'Sprint dimulai.' });
      router.refresh();
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  async function drop(energy: Energy) {
    const id = dragId.current;
    dragId.current = null;
    if (!id) return;
    const before = tasks;
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, energyType: energy } : t)));
    try {
      const r = await setTaskEnergy(id, energy);
      if (!r.ok) throw new Error();
    } catch {
      setTasks(before);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  const suggested = ENERGY_BY_LEVEL[level];

  return (
    <div className="space-y-6">
      <AnimatePresence>{onBreak && <BreakOverlay onClose={() => setOnBreak(false)} />}</AnimatePresence>

      <div className="flex flex-wrap items-center gap-3">
        <EnergyPicker />
        <Segmented label="Lama sprint" size="sm" value={minutes} onChange={setMinutes} options={LENGTHS} />
        <BodyDouble taskTitle={sprint?.taskTitle ?? undefined} />
      </div>

      {sprint && (
        <div className="rounded-card border border-brand-solid/50 bg-brand-soft/60 p-5">
          <p className="text-sm text-ink-soft">Sprint {ENERGY_LABEL[sprint.energyType]} berjalan</p>
          <p className="mt-1 font-heading text-lg font-semibold text-ink">{sprint.taskTitle ?? 'Fokus bebas'}</p>
          <p className="tabular mt-3 font-heading text-4xl font-bold text-ink">
            {String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}
          </p>
          <div className="mt-4">
            <Button variant="secondary" size="sm" onClick={finish}>Selesai, istirahat</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ENERGY_TYPES.map((e) => {
          const col = tasks.filter((t) => t.energyType === e);
          return (
            <section
              key={e}
              onDragOver={(ev) => ev.preventDefault()}
              onDrop={() => drop(e)}
              aria-label={`Kolom ${ENERGY_LABEL[e]}`}
              className={cn('rounded-card border bg-surface p-3 transition', suggested.includes(e) ? 'border-brand-solid/40' : 'border-line')}
            >
              <header className="mb-3 flex items-start justify-between gap-2 px-1">
                <div>
                  <h3 className={cn('inline-block rounded-md px-1.5 py-0.5 text-xs font-semibold', ENERGY_CHIP[e])}>{ENERGY_LABEL[e]}</h3>
                  <p className="mt-1 text-xs text-ink-faint">{ENERGY_HINT[e]}</p>
                </div>
                <Button size="sm" variant="ghost" disabled={!!sprint} onClick={() => begin(e)} aria-label={`Mulai sprint ${ENERGY_LABEL[e]}`}>
                  Mulai
                </Button>
              </header>
              <ul className="min-h-[3rem] space-y-2">
                {col.map((t) => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={() => (dragId.current = t.id)}
                    className="cursor-grab rounded-lg border border-line bg-bg/60 px-3 py-2 text-sm active:cursor-grabbing"
                  >
                    <p className="text-ink">{t.title}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-ink-faint">{t.dueLabel ?? 'Kapan saja'}</span>
                      <button type="button" disabled={!!sprint} onClick={() => begin(t.energyType, t.id)} className="text-xs font-medium text-brand hover:underline disabled:opacity-40">
                        Sprint ini
                      </button>
                    </div>
                  </li>
                ))}
                {col.length === 0 && <li className="px-1 text-xs text-ink-faint">Kosong. Seret tugas ke sini.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
