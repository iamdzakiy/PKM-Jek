import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { createAdminSource } from '@/app/actions/adhd';
import { PageHeader } from '@/components/pkm/page-header';
import { AdminStartButton } from '@/components/pkm/admin-start-button';
import { ActionForm, SubmitButton } from '@/components/ui/form';
import { Card, CardTitle } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/input';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin' };

export default async function AdminPage() {
  const user = await requireUser();
  const [sources, sessions] = await Promise.all([
    prisma.adminSource.findMany({ where: { userId: user.id, active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.adminSweepSession.findMany({ where: { userId: user.id }, orderBy: { startedAt: 'desc' }, take: 5 }),
  ]);

  return (
    <>
      <PageHeader title="Sweep Admin" description="Satu sesi singkat untuk memeriksa semua kotak masuk sekaligus. Sisanya tidak perlu dipikirkan." actions={<AdminStartButton disabled={sources.length === 0} />} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle className="mb-4">Sumber</CardTitle>
          <ul className="mb-4 space-y-2">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-sm">
                <span className="text-ink">{s.name}</span>
                <span className="text-xs text-ink-faint">{s.kind}</span>
              </li>
            ))}
            {sources.length === 0 && <li className="text-sm text-ink-soft">Tambahkan email, WhatsApp, atau portal yang rutin diperiksa.</li>}
          </ul>
          <ActionForm action={createAdminSource} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Nama" htmlFor="as-name"><Input id="as-name" name="name" required maxLength={80} /></Field>
            <Field label="Jenis" htmlFor="as-kind">
              <Select id="as-kind" name="kind" defaultValue="EMAIL">
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="PORTAL">Portal</option>
                <option value="OTHER">Lainnya</option>
              </Select>
            </Field>
            <Field label="Tautan (opsional)" htmlFor="as-url"><Input id="as-url" name="url" type="url" /></Field>
            <div className="sm:col-span-3"><SubmitButton>Tambah sumber</SubmitButton></div>
          </ActionForm>
        </Card>
        <Card>
          <CardTitle className="mb-4">Sesi terakhir</CardTitle>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/${s.id}`} className="flex items-center justify-between rounded-lg bg-surface-2/60 px-3 py-2 text-sm transition hover:bg-brand-soft">
                  <span className="text-ink">{s.startedAt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })}</span>
                  <span className="text-xs text-ink-faint">{s.itemsFound} temuan{s.endedAt ? '' : ' · berjalan'}</span>
                </Link>
              </li>
            ))}
            {sessions.length === 0 && <li className="text-sm text-ink-soft">Belum ada sesi.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
