'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { createNote } from '@/app/actions/notes';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSubmit } from '@/components/ui/form';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { EASE } from '@/components/motion/primitives';

export function NewNotePanel({ projects, defaultOpen = false }: { projects: { id: string; name: string }[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <Button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="new-note-form" variant={open ? 'secondary' : 'primary'}>
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }} className="grid place-items-center">
          <Plus size={16} strokeWidth={2.4} />
        </motion.span>
        {open ? 'Tutup' : 'Tulis catatan lengkap'}
      </Button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="new-note-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="overflow-hidden"
          >
            <Card className="mt-4">
              <form action={createNote} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Judul" htmlFor="title" className="sm:col-span-2">
                  <Input id="title" name="title" required maxLength={200} autoFocus placeholder="mis. Mekanisme Memory Buoyancy" />
                </Field>
                <Field label="Isi" htmlFor="content" className="sm:col-span-2">
                  <Textarea id="content" name="content" rows={5} placeholder="Tuliskan idenya dengan kata-katamu sendiri" />
                </Field>
                <Field label="Tipe" htmlFor="type">
                  <Select id="type" name="type" defaultValue="NOTE">
                    <option value="NOTE">Catatan</option>
                    <option value="TASK">Tugas</option>
                    <option value="IDEA">Ide</option>
                    <option value="INSIGHT">Insight</option>
                  </Select>
                </Field>
                <Field label="Proyek (opsional)" htmlFor="projectId">
                  <Select id="projectId" name="projectId" defaultValue="">
                    <option value="">Tanpa proyek</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Topik" htmlFor="topics" hint="Pisahkan dengan koma">
                  <Input id="topics" name="topics" placeholder="Managed Forgetting, PIMO" />
                </Field>
                <Field label="Lokasi" htmlFor="location">
                  <Input id="location" name="location" placeholder="mis. Lab Komputer, Bandung" />
                </Field>
                <div className="sm:col-span-2">
                  <NativeSubmit>Simpan catatan</NativeSubmit>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
