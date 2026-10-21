'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, CalendarClock, Check, ChevronDown, ListChecks, MapPin, Play, Timer } from 'lucide-react';
import { archiveTask, deferTask, shiftTaskToToday, startSprint } from '@/app/actions/adhd';
import { setTaskStatus } from '@/app/actions/tasks';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from './empty-state';
import { FirstThreeSteps } from './first-three-steps';
import { cn, formatDateTime } from '@/lib/utils';
import { ENERGY_CHIP, ENERGY_LABEL, type Energy } from '@/lib/adhd/energy';
import { urgencyOf } from '@/lib/adhd/urgency';

type Status = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export interface TaskDTO {
  id: string;
  title: string;
  status: Status;
  dueAt: string | null;
  location: string | null;
  project: string | null;
  energyType: Energy;
  firstSteps: string[];
  consequence: string | null;
}

export function TaskList({ initial }: { initial: TaskDTO[] }) {
  const toast = useToast();
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => setTasks(initial), [initial]);

  const open = tasks.filter((t) => t.status !== 'DONE');
  const done = tasks.filter((t) => t.status === 'DONE');

  async function setStatus(id: string, status: Status) {
    const before = tasks;
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status } : t)));
    try {
      const r = await setTaskStatus(id, status);
      if (!r.ok) throw new Error(r.message);
    } catch {
      setTasks(before);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>, optimisticRemoveId?: string) {
    const before = tasks;
    if (optimisticRemoveId) setTasks((cur) => cur.filter((t) => t.id !== optimisticRemoveId));
    try {
      const r = await fn();
      if (!r.ok) throw new Error(r.message);
      if (r.message) toast({ message: r.message });
      router.refresh();
    } catch {
      setTasks(before);
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  async function sprint(t: TaskDTO) {
    try {
      const r = await startSprint(t.energyType, 25, t.id);
      if (!r.ok) throw new Error(r.message);
      router.push('/sprints');
    } catch {
      toast({ kind: 'error', message: 'Belum tersimpan. Coba sekali lagi?' });
    }
  }

  if (tasks.length === 0) {
    return <EmptyState icon={ListChecks} title="Belum ada tugas" description="Tulis satu hal kecil. Tiga langkah pertamanya bisa dibuatkan." />;
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2" aria-label="Tugas terbuka">
        <AnimatePresence initial={false}>
          {open.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              onStatus={setStatus}
              onDefer={(id) => run(() => deferTask(id))}
              onShift={(id) => run(() => shiftTaskToToday(id))}
              onArchive={(id) => run(() => archiveTask(id), id)}
              onSprint={sprint}
            />
          ))}
        </AnimatePresence>
        {open.length === 0 && <li className="rounded-card border border-dashed border-line px-4 py-8 text-center text-sm text-ink-soft">Semua tugas selesai. Kepala bisa kosong.</li>}
      </ul>

      {done.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-ink">
            <motion.span animate={{ rotate: showDone ? 180 : 0 }} className="grid place-items-center">
              <ChevronDown size={15} />
            </motion.span>
            Selesai ({done.length})
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2 overflow-hidden">
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} onStatus={setStatus} onDefer={() => undefined} onShift={() => undefined} onArchive={(id) => run(() => archiveTask(id), id)} onSprint={() => undefined} />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onStatus,
  onDefer,
  onShift,
  onArchive,
  onSprint,
}: {
  task: TaskDTO;
  onStatus: (id: string, s: Status) => void;
  onDefer: (id: string) => void;
  onShift: (id: string) => void;
  onArchive: (id: string) => void;
  onSprint: (t: TaskDTO) => void;
}) {
  const isDone = task.status === 'DONE';
  const active = task.status === 'IN_PROGRESS';
  const urgency = urgencyOf(task.dueAt, { done: isDone, started: active });

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={cn('rounded-card border bg-surface px-4 py-3 shadow-card transition-colors', active ? 'border-brand-solid/60' : 'border-line')}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={isDone}
          aria-label={isDone ? `Buka kembali ${task.title}` : `Selesaikan ${task.title}`}
          onClick={() => onStatus(task.id, isDone ? 'OPEN' : 'DONE')}
          className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors', isDone ? 'border-mint bg-mint text-navy' : 'border-ink-faint/60 hover:border-brand-solid')}
        >
          <AnimatePresence initial={false}>
            {isDone && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 600, damping: 24 }}>
                <Check size={13} strokeWidth={3.4} />
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-sm font-medium transition-colors', isDone ? 'text-ink-faint line-through decoration-ink-faint/50' : 'text-ink')}>{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
            <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-medium', ENERGY_CHIP[task.energyType])}>{ENERGY_LABEL[task.energyType]}</span>
            {task.project && <span>{task.project}</span>}
            {task.dueAt && <span suppressHydrationWarning>{formatDateTime(task.dueAt)}</span>}
            {task.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {task.location}
              </span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {urgency.offerShift ? (
            <button type="button" onClick={() => onShift(task.id)} className="inline-flex items-center rounded-md bg-cream px-2 py-0.5 text-[11px] font-semibold tracking-wide text-navy transition hover:brightness-95">
              {urgency.label}
            </button>
          ) : (
            !isDone && task.dueAt && <Badge tone={urgency.tone}>{urgency.label}</Badge>
          )}
          {active && <Badge tone="brand">dikerjakan</Badge>}
          {!isDone && (
            <>
              <IconBtn label="Mulai sprint 25 menit" onClick={() => onSprint(task)}>
                <Timer size={14} />
              </IconBtn>
              <IconBtn label={active ? 'Hentikan pengerjaan' : 'Mulai kerjakan'} pressed={active} onClick={() => onStatus(task.id, active ? 'OPEN' : 'IN_PROGRESS')}>
                <Play size={14} fill={active ? 'currentColor' : 'none'} />
              </IconBtn>
              <IconBtn label="Tunda sehari" onClick={() => onDefer(task.id)}>
                <CalendarClock size={14} />
              </IconBtn>
            </>
          )}
          <IconBtn label="Arsipkan" onClick={() => onArchive(task.id)}>
            <Archive size={14} />
          </IconBtn>
        </div>
      </div>

      {!isDone && <FirstThreeSteps taskId={task.id} steps={task.firstSteps} />}
    </motion.li>
  );
}

function IconBtn({ label, onClick, children, pressed }: { label: string; onClick: () => void; children: React.ReactNode; pressed?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cn('grid h-8 w-8 place-items-center rounded-lg transition', pressed ? 'bg-brand-soft text-brand' : 'text-ink-faint hover:bg-surface-2 hover:text-ink')}
    >
      {children}
    </button>
  );
}
