'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ListChecks, MapPin, Play, Trash2 } from 'lucide-react';
import { deleteTask, setTaskStatus } from '@/app/actions/tasks';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { EmptyState } from './empty-state';
import { cn, formatDateTime } from '@/lib/utils';

type Status = 'OPEN' | 'IN_PROGRESS' | 'DONE';
export interface TaskDTO {
  id: string;
  title: string;
  status: Status;
  dueAt: string | null;
  location: string | null;
  project: string | null;
}

export function TaskList({ initial }: { initial: TaskDTO[] }) {
  const toast = useToast();
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
      toast({ kind: 'error', message: 'Gagal memperbarui tugas.' });
    }
  }

  async function remove(id: string) {
    const before = tasks;
    setTasks((cur) => cur.filter((t) => t.id !== id));
    try {
      const r = await deleteTask(id);
      if (!r.ok) throw new Error(r.message);
    } catch {
      setTasks(before);
      toast({ kind: 'error', message: 'Gagal menghapus tugas.' });
    }
  }

  if (tasks.length === 0) {
    return <EmptyState icon={ListChecks} title="Belum ada tugas" description="Tugas tanpa waktu dan tempat yang jelas gagal memicu ingatan prospektif. Isi keduanya." />;
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2" aria-label="Tugas terbuka">
        <AnimatePresence initial={false}>
          {open.map((t) => (
            <TaskRow key={t.id} task={t} onStatus={setStatus} onDelete={remove} />
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
                  <TaskRow key={t.id} task={t} onStatus={setStatus} onDelete={remove} />
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onStatus, onDelete }: { task: TaskDTO; onStatus: (id: string, s: Status) => void; onDelete: (id: string) => void }) {
  const isDone = task.status === 'DONE';
  const active = task.status === 'IN_PROGRESS';
  const overdue = !isDone && task.dueAt !== null && new Date(task.dueAt).getTime() < Date.now();

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 30, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      className={cn('flex items-center gap-3 rounded-card border bg-surface px-4 py-3 shadow-card transition-colors', active ? 'border-brand-solid/60' : 'border-line')}
    >
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
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-faint">
          {task.project && <span>{task.project}</span>}
          <span suppressHydrationWarning>{task.dueAt ? formatDateTime(task.dueAt) : 'tanpa waktu'}</span>
          {task.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} /> {task.location}
            </span>
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {overdue && <Badge tone="danger">terlambat</Badge>}
        {active && <Badge tone="brand">dikerjakan</Badge>}
        {!isDone && (
          <button
            type="button"
            onClick={() => onStatus(task.id, active ? 'OPEN' : 'IN_PROGRESS')}
            aria-pressed={active}
            aria-label={active ? 'Hentikan pengerjaan' : 'Mulai kerjakan'}
            title={active ? 'Hentikan pengerjaan' : 'Mulai kerjakan'}
            className={cn('grid h-8 w-8 place-items-center rounded-lg transition', active ? 'bg-brand-soft text-brand' : 'text-ink-faint hover:bg-surface-2 hover:text-ink')}
          >
            <Play size={14} fill={active ? 'currentColor' : 'none'} />
          </button>
        )}
        <button type="button" onClick={() => onDelete(task.id)} aria-label={`Hapus ${task.title}`} title="Hapus" className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint transition hover:bg-danger-soft hover:text-danger">
          <Trash2 size={14} />
        </button>
      </div>
    </motion.li>
  );
}
