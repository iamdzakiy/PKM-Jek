'use client';

import { useState } from 'react';
import { Label } from './input';

/** 0..1 slider that shows its value as a percentage. Submits the raw 0..1 number. */
export function RangeField({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: number; hint?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <div className="flex items-center justify-between">
        <Label htmlFor={name} className="mb-0">
          {label}
        </Label>
        <span className="tabular text-xs font-semibold text-ink">{Math.round(value * 100)}%</span>
      </div>
      <input
        id={name}
        name={name}
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-2.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-line accent-[rgb(var(--brand-solid))]"
      />
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
