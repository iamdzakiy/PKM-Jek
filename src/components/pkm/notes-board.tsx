'use client';

import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NotebookText, Search, SearchX } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { EmptyState } from './empty-state';
import { NoteCard } from './note-card';
import { TYPE_LABEL, type FolderKey, type NoteDTO, type NoteKind } from '@/lib/types';

type View = 'visible' | 'capsule' | 'forgotten' | 'all';
type TypeFilter = 'ALL' | NoteKind;

const VISIBLE: FolderKey[] = ['LAST_FOCUS', 'HOT_TOPICS', 'ACTIVE'];

function inView(folder: FolderKey, view: View) {
  if (view === 'all') return true;
  if (view === 'visible') return VISIBLE.includes(folder);
  if (view === 'capsule') return folder === 'TIME_CAPSULE';
  return folder === 'FORGOTTEN';
}

export function NotesBoard({ notes, initialView = 'visible' }: { notes: NoteDTO[]; initialView?: View }) {
  const [view, setView] = useState<View>(initialView);
  const [type, setType] = useState<TypeFilter>('ALL');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      visible: notes.filter((n) => inView(n.folder, 'visible')).length,
      capsule: notes.filter((n) => n.folder === 'TIME_CAPSULE').length,
      forgotten: notes.filter((n) => n.folder === 'FORGOTTEN').length,
      all: notes.length,
    }),
    [notes]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (!inView(n.folder, view)) return false;
      if (type !== 'ALL' && n.type !== type) return false;
      if (!q) return true;
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.topics.some((t) => t.name.toLowerCase().includes(q));
    });
  }, [notes, view, type, query]);

  if (notes.length === 0) {
    return <EmptyState icon={NotebookText} title="Belum ada catatan" description="Tekan Ctrl K di mana saja untuk menangkap catatan pertamamu. Ia langsung masuk ke Last Focus." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari judul, isi, atau topik"
            aria-label="Cari catatan"
            className="h-10 w-full rounded-lg border border-line bg-surface-2/60 pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-ink-faint/50 focus:border-brand-solid focus:bg-surface focus:ring-2 focus:ring-brand-solid/25"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Tampilan folder"
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'visible', label: `Terlihat ${counts.visible}` },
              { value: 'capsule', label: `Time Capsule ${counts.capsule}` },
              { value: 'forgotten', label: `Forgotten ${counts.forgotten}` },
              { value: 'all', label: `Semua ${counts.all}` },
            ]}
          />
        </div>
      </div>

      <Segmented
        label="Tipe catatan"
        size="sm"
        value={type}
        onChange={setType}
        options={[{ value: 'ALL', label: 'Semua tipe' }, ...(Object.keys(TYPE_LABEL) as NoteKind[]).map((k) => ({ value: k, label: TYPE_LABEL[k] }))]}
      />

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title="Tidak ada yang cocok" description="Ubah kata kunci atau pindah ke folder lain. Catatan yang tenggelam tidak pernah dihapus." />
      ) : (
        <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout" initial={false}>
            {filtered.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.22 }}
              >
                <NoteCard note={note} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
