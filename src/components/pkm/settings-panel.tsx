'use client';

import { Segmented } from '@/components/ui/segmented';
import { Card, CardTitle } from '@/components/ui/card';
import { DEFAULT_PREFS, usePrefs, type Prefs } from '@/lib/prefs';
import { cn } from '@/lib/utils';

function Row({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-faint">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-7 w-12 rounded-full transition', on ? 'bg-ranger' : 'bg-surface-2 ring-1 ring-inset ring-line')}>
      <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

const opts = <T extends string>(xs: [T, string][]) => xs.map(([value, label]) => ({ value, label }));

export function SettingsPanel() {
  const [prefs, set] = usePrefs();
  const num = (k: keyof Prefs) => (v: string) => set({ [k]: Number(v) });

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Rasa</CardTitle>
        <div className="mt-2 divide-y divide-line/60">
          <Row title="Suara" hint="Bunyi kecil saat misi selesai dan saat check-in fokus.">
            <Toggle on={prefs.sound} label="Suara" onChange={(sound) => set({ sound })} />
          </Row>
          <Row title="Gerak" hint="Kurangi animasi kalau bikin pusing atau terdistraksi.">
            <Segmented label="Gerak" size="sm" value={prefs.motion} onChange={(motion) => set({ motion })} options={opts<Prefs['motion']>([['system', 'Ikut HP'], ['reduce', 'Kurangi'], ['full', 'Penuh']])} />
          </Row>
        </div>
      </Card>

      <Card>
        <CardTitle>Fokus</CardTitle>
        <div className="mt-2 divide-y divide-line/60">
          <Row title="Batas fokus harian" hint="Bar bahan bakar di Hari Ini merah kalau tugas melebihi ini.">
            <Segmented label="Batas fokus harian" size="sm" value={String(prefs.capHours)} onChange={num('capHours')} options={opts([['3', '3j'], ['4', '4j'], ['5', '5j'], ['6', '6j']])} />
          </Row>
          <Row title="Durasi mode fokus" hint="Panjang satu blok saat tekan Fokus di misi.">
            <Segmented label="Durasi mode fokus" size="sm" value={String(prefs.focusMin)} onChange={num('focusMin')} options={opts([['15', '15m'], ['25', '25m'], ['45', '45m'], ['60', '60m']])} />
          </Row>
          <Row title="“Masih di sini?”" hint="Seberapa sering dicek. Tidak dijawab 1 menit = timer dijeda.">
            <Segmented label="Jeda check-in" size="sm" value={String(prefs.checkInMin)} onChange={num('checkInMin')} options={opts([['5', '5m'], ['10', '10m'], ['15', '15m'], ['0', 'Mati']])} />
          </Row>
        </div>
      </Card>

      <button type="button" onClick={() => set(DEFAULT_PREFS)} className="w-full py-2 text-sm text-ink-faint hover:text-ink">
        Kembalikan ke bawaan
      </button>
    </div>
  );
}
