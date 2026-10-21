'use client';

import { useState } from 'react';
import { EnergyChips } from './energy-picker';
import { Field, Input } from '@/components/ui/input';
import type { Energy } from '@/lib/adhd/energy';

/** Bagian form tugas: jenis energi + konsekuensi. Ikut terkirim lewat input bernama. */
export function TaskEnergyField() {
  const [energy, setEnergy] = useState<Energy | null>('ADMIN');
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="Jenis energi" hint="Pilih yang paling pas. Bisa diganti nanti.">
        <EnergyChips name="energyType" value={energy} onChange={setEnergy} />
      </Field>
      <Field label="Kalau tidak disentuh, apa akibatnya? (opsional)" htmlFor="consequence">
        <Input id="consequence" name="consequence" maxLength={200} placeholder="mis. portal pendaftaran tutup" />
      </Field>
    </div>
  );
}
