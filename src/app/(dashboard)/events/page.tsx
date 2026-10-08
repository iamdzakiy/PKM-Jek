import { CalendarDays, MapPin } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createEvent } from '@/app/actions/pimo';
import { PageHeader } from '@/components/pkm/page-header';
import { EmptyState } from '@/components/pkm/empty-state';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Stagger, StaggerItem } from '@/components/motion/primitives';
import { cn, formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acara' };

export default async function EventsPage() {
  const user = await requireUser();
  const events = await prisma.event.findMany({ where: { userId: user.id }, orderBy: { startAt: 'asc' } });
  const now = Date.now();

  return (
    <>
      <PageHeader title="Acara" description="Acara memberi konteks waktu dan tempat bagi catatan yang terhubung." />

      <Card className="mb-6">
        <ActionForm action={createEvent} className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr,1fr,1fr,auto] sm:items-end">
          <Field label="Judul" htmlFor="title">
            <Input id="title" name="title" required maxLength={160} />
          </Field>
          <Field label="Waktu" htmlFor="startAt">
            <Input id="startAt" name="startAt" type="datetime-local" required />
          </Field>
          <Field label="Lokasi" htmlFor="location">
            <Input id="location" name="location" maxLength={160} />
          </Field>
          <SubmitButton>Tambah acara</SubmitButton>
        </ActionForm>
      </Card>

      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Belum ada acara" description="Tambahkan kuliah umum, rapat, atau tenggat agar catatanmu punya konteks." />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const past = e.startAt.getTime() < now;
            return (
              <StaggerItem key={e.id}>
                <Card className={cn('flex items-center gap-4 p-4', past && 'opacity-60')}>
                  <div className="w-14 shrink-0 overflow-hidden rounded-xl border border-line text-center" aria-hidden="true">
                    <p className="bg-brand-solid py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">{formatDate(e.startAt, { month: 'short' })}</p>
                    <p className="py-1.5 font-heading text-xl font-bold leading-none text-ink">{formatDate(e.startAt, { day: 'numeric' })}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{e.title}</p>
                    <p className="mt-0.5 text-xs text-ink-faint">{e.startAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB</p>
                    {e.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
                        <MapPin size={11} /> {e.location}
                      </p>
                    )}
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </>
  );
}
