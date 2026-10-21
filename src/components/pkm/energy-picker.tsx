'use client';

import { useEffect, useState } from 'react';
import { BatteryLow, BatteryMedium, BatteryFull } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import { ENERGY_CHIP, ENERGY_LABEL, ENERGY_TYPES, LEVEL_LABEL, type Energy, type EnergyLevel } from '@/lib/adhd/energy';
import { cn } from '@/lib/utils';

const KEY = 'sb-energy-level';
const EVENT = 'sb-energy-change';

/** Tingkat energi hari ini, disimpan lokal dan disiarkan ke komponen lain tanpa context baru. */
export function useEnergyLevel(): [EnergyLevel, (v: EnergyLevel) => void] {
  const [level, setLevel] = useState<EnergyLevel>('MEDIUM');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'LOW' || saved === 'MEDIUM' || saved === 'HIGH') setLevel(saved);
    } catch {
      /* ignore */
    }
    const onChange = (e: Event) => setLevel((e as CustomEvent<EnergyLevel>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  function update(next: EnergyLevel) {
    setLevel(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
  }
  return [level, update];
}

export function EnergyPicker({ className }: { className?: string }) {
  const [level, setLevel] = useEnergyLevel();
  return (
    <Segmented
      label="Energi saat ini"
      size="sm"
      value={level}
      onChange={setLevel}
      className={className}
      options={[
        { value: 'LOW', label: LEVEL_LABEL.LOW, icon: <BatteryLow size={14} /> },
        { value: 'MEDIUM', label: LEVEL_LABEL.MEDIUM, icon: <BatteryMedium size={14} /> },
        { value: 'HIGH', label: LEVEL_LABEL.HIGH, icon: <BatteryFull size={14} /> },
      ]}
    />
  );
}

/** Pilih energi tugas (dipakai di form dan Quick Capture). Mengirim nilai lewat input hidden bila diberi name. */
export function EnergyChips({ value, onChange, name }: { value: Energy | null; onChange: (v: Energy | null) => void; name?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Jenis energi tugas">
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {ENERGY_TYPES.map((e) => (
        <button
          key={e}
          type="button"
          aria-pressed={value === e}
          onClick={() => onChange(value === e ? null : e)}
          className={cn('rounded-md border px-2 py-1 text-xs font-medium transition', value === e ? cn('border-transparent', ENERGY_CHIP[e], 'ring-2 ring-brand-solid/40') : 'border-line bg-surface-2/60 text-ink-soft hover:border-brand-solid/50 hover:text-ink')}
        >
          {ENERGY_LABEL[e]}
        </button>
      ))}
    </div>
  );
}
