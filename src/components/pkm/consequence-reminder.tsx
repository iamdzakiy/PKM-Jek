import { Link2 } from 'lucide-react';
import { CONSEQUENCE_FALLBACK, type Energy } from '@/lib/adhd/energy';

/** Pengingat berbasis konsekuensi, bukan perintah: menunjuk alasan, bukan menekan. */
export function ConsequenceReminder({ title, consequence, energy }: { title: string; consequence: string | null; energy: Energy }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-surface-2/70 px-3 py-2 text-sm leading-relaxed text-ink-soft">
      <Link2 size={15} className="mt-0.5 shrink-0 text-ink-faint" />
      <span>
        <span className="font-medium text-ink">{title}</span> menyentuh hal yang penting: {consequence ?? CONSEQUENCE_FALLBACK[energy]}.
      </span>
    </p>
  );
}
