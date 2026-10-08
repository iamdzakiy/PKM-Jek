'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Star, X } from 'lucide-react';
import { addNoteTopic, removeNoteTopic, toggleNotePerson } from '@/app/actions/notes';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

interface Props {
  noteId: string;
  topics: { id: string; name: string }[];
  people: { id: string; name: string; relation: string | null; importance: number; linked: boolean }[];
}

/** Topics and people are the "edges" of the knowledge graph, so they drive Gravity (G) and Social Graph (SG). */
export function NoteLinks({ noteId, topics, people }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>) {
    setBusy(key);
    try {
      const r = await fn();
      if (!r.ok) toast({ kind: 'error', message: r.message ?? 'Gagal menyimpan.' });
    } catch {
      toast({ kind: 'error', message: 'Koneksi bermasalah. Coba lagi.' });
    } finally {
      setBusy(null);
    }
  }

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    setDraft('');
    await run('add', () => addNoteTopic(noteId, name));
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">Topik</p>
        <div className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {topics.map((t) => (
              <motion.span
                key={t.id}
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="inline-flex items-center gap-1 rounded-md bg-surface-2 py-1 pl-2 pr-1 text-xs font-medium text-ink"
              >
                #{t.name}
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => run(`rm-${t.id}`, () => removeNoteTopic(noteId, t.id))}
                  aria-label={`Lepas topik ${t.name}`}
                  className="grid h-4 w-4 place-items-center rounded text-ink-faint transition hover:bg-danger-soft hover:text-danger disabled:opacity-40"
                >
                  <X size={11} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          {topics.length === 0 && <p className="text-xs text-ink-faint">Belum ada topik.</p>}
        </div>
        <form onSubmit={addTopic} className="mt-2.5 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Tambah topik"
            aria-label="Nama topik baru"
            className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface-2/60 px-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-solid focus:ring-2 focus:ring-brand-solid/25"
          />
          <button type="submit" disabled={busy !== null || !draft.trim()} aria-label="Tambah topik" className="grid h-9 w-9 place-items-center rounded-lg bg-brand-solid text-white transition hover:brightness-110 disabled:opacity-40">
            <Plus size={16} />
          </button>
        </form>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-ink-soft">Orang terkait</p>
        {people.length === 0 ? (
          <p className="text-xs text-ink-faint">Tambahkan orang di halaman Orang agar bisa dihubungkan.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.linked}
                disabled={busy !== null}
                onClick={() => run(`p-${p.id}`, () => toggleNotePerson(noteId, p.id))}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60',
                  p.linked ? 'border-brand-solid bg-brand-soft text-brand' : 'border-line text-ink-soft hover:border-brand-solid/50 hover:text-ink'
                )}
                title={p.relation ?? undefined}
              >
                {p.name}
                <span className="inline-flex items-center gap-0.5 text-[10px] opacity-70">
                  <Star size={9} fill="currentColor" /> {p.importance}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
