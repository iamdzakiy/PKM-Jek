'use client';

import { useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import { createDeadlinePlan } from '@/app/actions/adhd';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { EnergyChips } from './energy-picker';
import type { Energy } from '@/lib/adhd/energy';

/** Rencana mundur: satu tanggal serah terima, titik-titik antara dibuat otomatis (30/60/85%). */
export function DeadlinePlanner() {
  const [open, setOpen] = useState(false);
  const [energy, setEnergy] = useState<Energy | null>('DEADLINE');
  return (
    <Card className="mb-6">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <CalendarRange size={16} />
          </span>
          <span>
            <span className="block font-heading text-[15px] font-semibold text-ink">Punya tenggat besar?</span>
            <span className="block text-sm text-ink-soft">Cukup isi tanggal akhir. Titik-titik antaranya dibuatkan mundur.</span>
          </span>
        </span>
        <ChevronDown size={16} className={open ? 'rotate-180 text-ink-faint transition' : 'text-ink-faint transition'} />
      </button>
      {open && (
        <ActionForm action={createDeadlinePlan} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Apa yang harus selesai" htmlFor="dp-title">
            <Input id="dp-title" name="title" required maxLength={200} placeholder="mis. Proposal hibah" />
          </Field>
          <Field label="Kapan diserahkan" htmlFor="dp-date">
            <Input id="dp-date" name="handoverDate" type="datetime-local" required />
          </Field>
          <Field label="Kalau tidak disentuh, apa akibatnya?" htmlFor="dp-cons">
            <Input id="dp-cons" name="consequence" maxLength={200} placeholder="mis. kehilangan kesempatan pendanaan" />
          </Field>
          <Field label="Jenis energi">
            <EnergyChips name="energyType" value={energy} onChange={setEnergy} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Buat rencana mundur</SubmitButton>
          </div>
        </ActionForm>
      )}
    </Card>
  );
}
