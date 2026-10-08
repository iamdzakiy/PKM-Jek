'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge, type Tone } from '@/components/ui/badge';
import { ScorePill } from './score-pill';
import { formatRelative } from '@/lib/utils';
import { TYPE_LABEL, type NoteDTO, type NoteKind } from '@/lib/types';

const TYPE_TONE: Record<NoteKind, Tone> = {
  NOTE: 'neutral',
  TASK: 'warn',
  IDEA: 'mint',
  INSIGHT: 'brand',
};

export function NoteCard({ note, compact }: { note: NoteDTO; compact?: boolean }) {
  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }} className="h-full">
      <Link
        href={`/notes/${note.id}`}
        className="flex h-full flex-col rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-solid/60 hover:shadow-lift"
      >
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <Badge tone={TYPE_TONE[note.type]}>{TYPE_LABEL[note.type]}</Badge>
          <span className="text-xs text-ink-faint" suppressHydrationWarning>
            {formatRelative(new Date(note.updatedAt))}
          </span>
        </div>
        <h3 className="mb-1 line-clamp-1 font-heading text-[15px] font-semibold text-ink">{note.title}</h3>
        {!compact && <p className="mb-3 line-clamp-2 flex-1 text-sm leading-relaxed text-ink-soft">{note.content || 'Belum ada isi.'}</p>}

        {!compact && note.topics.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {note.topics.slice(0, 4).map((t) => (
              <span key={t.id} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-soft">
                #{t.name}
              </span>
            ))}
          </div>
        )}

        {note.mb !== null && note.pv !== null && (
          <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line pt-3">
            <ScorePill label="MB" value={note.mb} tone="brand" />
            <ScorePill label="PV" value={note.pv} tone="mint" />
          </div>
        )}
      </Link>
    </motion.div>
  );
}
