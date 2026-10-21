'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Eye, PartyPopper, X } from 'lucide-react';
import { submitRecallAnswer } from '@/app/actions/recall';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { EASE } from '@/components/motion/primitives';

export interface RecallItem {
  id: string;
  question: string;
  correctAnswer: string;
  noteId: string;
  noteTitle: string;
}

/**
 * One question at a time (single-task focus). Free recall first, then reveal,
 * then self-grade. The queue lives in local state so a revalidation after each
 * answer can't yank the card out from under the animation.
 */
export function RecallDeck({ items }: { items: RecallItem[] }) {
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [correct, setCorrect] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const total = items.length;
  const current = items[index];
  const finished = index >= total;

  async function grade(isCorrect: boolean) {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await submitRecallAnswer(current.id, answer, isCorrect);
      if (!r.ok) {
        toast({ kind: 'error', message: r.message ?? 'Gagal menyimpan jawaban.' });
        return;
      }
      if (isCorrect) setCorrect((c) => c + 1);
      setIndex((i) => i + 1);
      setAnswer('');
      setRevealed(false);
    } catch {
      toast({ kind: 'error', message: 'Koneksi bermasalah. Coba lagi.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/80" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(index, total)} aria-label="Kemajuan kuis">
          <motion.div className="h-full rounded-full bg-brand-solid" animate={{ width: `${(Math.min(index, total) / total) * 100}%` }} transition={{ duration: 0.5, ease: EASE }} />
        </div>
        <span className="tabular text-xs font-medium text-ink-soft">
          {Math.min(index + (finished ? 0 : 1), total)} / {total}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {finished ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
            <Card className="py-12 text-center">
              <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.1 }} className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-mint-soft text-mint">
                <PartyPopper size={26} />
              </motion.div>
              <h2 className="font-heading text-xl font-bold text-ink">Antrian hari ini selesai</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
                {correct} dari {total} kamu ingat dengan benar. Yang salah kembali besok, yang benar menunggu lebih lama.
              </p>
              <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-brand-solid px-4 text-sm font-medium text-white hover:brightness-110">
                Kembali ke dashboard <ArrowRight size={15} />
              </Link>
            </Card>
          </motion.div>
        ) : (
          <motion.div key={current.id} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.3, ease: EASE }}>
            <Card className="p-6 sm:p-8">
              <Link href={`/notes/${current.noteId}`} className="text-xs font-semibold uppercase tracking-wider text-ink-faint transition hover:text-brand">
                {current.noteTitle}
              </Link>
              <h2 className="mt-3 font-heading text-xl font-bold leading-snug text-ink sm:text-2xl">{current.question}</h2>

              <div className="mt-6">
                <label htmlFor="recall-answer" className="mb-1.5 block text-xs font-medium text-ink-soft">
                  Jawabanmu (dari ingatan)
                </label>
                <Textarea id="recall-answer" ref={areaRef} rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={revealed} placeholder="Tulis dulu sebelum melihat jawaban" autoFocus />
              </div>

              <AnimatePresence initial={false}>
                {revealed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                    <div className="mt-4 rounded-xl border border-mint/30 bg-mint-soft px-4 py-3.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-mint">Jawaban benar</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink">{current.correctAnswer}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {!revealed ? (
                  <Button onClick={() => setRevealed(true)}>
                    <Eye size={15} /> Lihat jawaban
                  </Button>
                ) : (
                  <>
                    <Button loading={busy} onClick={() => grade(true)}>
                      <Check size={15} strokeWidth={2.6} /> Aku benar
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={() => grade(false)}>
                      <X size={15} strokeWidth={2.6} /> Aku salah
                    </Button>
                  </>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
