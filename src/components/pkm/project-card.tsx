'use client';

import { useState } from 'react';
import { setProjectStatus } from '@/app/actions/pimo';
import { Card } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { useToast } from '@/components/ui/toast';

type Status = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export function ProjectCard({ id, name, description, status, notes, tasks }: { id: string; name: string; description: string | null; status: Status; notes: number; tasks: number }) {
  const toast = useToast();
  const [value, setValue] = useState<Status>(status);

  async function change(next: Status) {
    const prev = value;
    setValue(next);
    try {
      const r = await setProjectStatus(id, next);
      if (!r.ok) throw new Error(r.message);
    } catch {
      setValue(prev);
      toast({ kind: 'error', message: 'Gagal memperbarui status proyek.' });
    }
  }

  return (
    <Card className="flex h-full flex-col">
      <h3 className="font-heading text-base font-semibold text-ink">{name}</h3>
      {description ? <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-ink-soft">{description}</p> : <p className="mt-1.5 text-sm text-ink-faint">Tanpa deskripsi.</p>}
      <p className="mt-3 text-xs text-ink-faint tabular">
        {notes} catatan · {tasks} tugas
      </p>
      <div className="mt-auto pt-4">
        <Segmented
          label={`Status proyek ${name}`}
          size="sm"
          value={value}
          onChange={change}
          options={[
            { value: 'ACTIVE', label: 'Aktif' },
            { value: 'COMPLETED', label: 'Selesai' },
            { value: 'ARCHIVED', label: 'Arsip' },
          ]}
        />
      </div>
    </Card>
  );
}
