import { CalendarClock, CheckCircle2, Unplug } from 'lucide-react';
import { requireUser } from '@/lib/current-user';
import { prisma } from '@/lib/prisma';
import { googleEnvProblem } from '@/lib/google/client';
import { connectGoogle, disconnectGoogle, syncNowGoogle } from '@/app/actions/google';
import { PageHeader } from '@/components/pkm/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionForm, NativeSubmit, SubmitButton } from '@/components/ui/form';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Google Calendar' };

export default async function GoogleSettingsPage({ searchParams }: { searchParams: { google?: string } }) {
  const user = await requireUser();
  const [account, envProblem] = await Promise.all([
    prisma.googleAccount.findUnique({ where: { userId: user.id } }),
    Promise.resolve(googleEnvProblem()),
  ]);

  const flash = {
    connected: 'Akun Google terhubung. Sinkronisasi dua arah aktif.',
    denied: 'Otorisasi dibatalkan atau akun tidak cocok.',
    env: envProblem ?? 'Konfigurasi Google belum lengkap. Cek .env.',
    error: 'Proses otorisasi gagal. Coba sambungkan ulang.',
  }[searchParams.google ?? ''] as string | undefined;

  return (
    <>
      <PageHeader title="Google Calendar" description="Sinkron dua arah: acara dan tugas yang jatuh tempo mengalir ke Google Calendar, dan perubahan di sana mengalir kembali." />

      {flash && (
        <div
          className={`mb-6 flex items-center gap-2 rounded-card border px-4 py-3 text-sm ${
            searchParams.google === 'connected' ? 'border-mint/40 bg-mint-soft text-mint' : 'border-danger/40 bg-danger-soft text-danger'
          }`}
        >
          <CheckCircle2 size={16} className="shrink-0" /> {flash}
        </div>
      )}

      {envProblem && (
        <Card className="mb-6 border-warn/40 bg-warn-soft">
          <p className="text-sm font-medium text-warn">{envProblem}</p>
        </Card>
      )}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
              <CalendarClock size={20} />
            </div>
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                {account ? account.email : 'Belum terhubung'}
                {account && <Badge tone="mint">aktif</Badge>}
              </p>
              <p className="mt-0.5 text-xs text-ink-faint">
                {account
                  ? `Kalender: ${account.calendarId} · Terhubung sejak ${formatDateTime(account.connectedAt)}`
                  : 'Sambungkan akun Google sekali; refresh token disimpan, jadi tidak perlu login ulang.'}
              </p>
            </div>
          </div>

          {account ? (
            <div className="flex items-center gap-2">
              <ActionForm action={syncNowGoogle} reset={false}>
                <SubmitButton variant="secondary">Tarik perubahan</SubmitButton>
              </ActionForm>
              <ActionForm action={disconnectGoogle} reset={false}>
                <SubmitButton variant="danger">
                  <Unplug size={14} /> Putuskan
                </SubmitButton>
              </ActionForm>
            </div>
          ) : (
            <form action={connectGoogle}>
              <NativeSubmit>Hubungkan akun Google</NativeSubmit>
            </form>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-[15px] font-semibold text-ink">Cara kerjanya</h2>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
          <li>• Acara dan tugas dengan waktu jatuh tempo langsung ter-*push* ke Google Calendar saat dibuat, diubah, atau dihapus.</li>
          <li>• Perubahan di Google (termasuk yang dibuat di ponsel) mengalir balik lewat notifikasi push — hampir seketika.</li>
          <li>• Tugas tanpa waktu tidak dikirim ke kalender; tidak ada jangkar waktu untuk menggantungnya.</li>
          <li>• Saluran notifikasi Google kedaluwarsa maksimal 7 hari dan diperbarui otomatis setiap hari oleh cron.</li>
        </ul>
      </Card>
    </>
  );
}
