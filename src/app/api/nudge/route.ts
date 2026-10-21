import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Pengingat berbasis konsekuensi, dipanggil 08:00 dan 14:00 WIB. Belum ada
 * kanal push; endpoint ini menyiapkan daftar dan mencatatnya ke log. Dashboard
 * membaca data yang sama langsung dari database.
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const horizon = new Date(Date.now() + 72 * 3_600_000);
  const due = await prisma.task.findMany({
    where: { status: { not: 'DONE' }, archived: false, dueAt: { lte: horizon }, consequence: { not: null } },
    select: { id: true, title: true, consequence: true },
    take: 50,
  });
  console.log(`[adhd] nudge: ${due.length} tugas bersangkutan konsekuensi`);
  return NextResponse.json({ ok: true, count: due.length });
}

export const GET = handle;
export const POST = handle;
