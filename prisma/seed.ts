import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seeds one example workspace so the dashboard isn't empty on first run.
 * Replace SEED_USER_ID/EMAIL with your real Supabase auth user id after you
 * sign in once (check the `User` table in Prisma Studio, or the Supabase
 * dashboard's Authentication tab) — then re-run `npm run seed`.
 */
async function main() {
  const userId = process.env.SEED_USER_ID;
  const email = process.env.SEED_USER_EMAIL ?? process.env.ALLOWED_EMAIL;

  if (!userId) {
    console.log(
      'Set SEED_USER_ID (your Supabase auth user id, from the User table after first login) to seed example data. Skipping.'
    );
    return;
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId, email: email ?? 'you@example.com' },
  });

  const project = await prisma.project.create({
    data: { userId, name: 'Final Project — Arsitektur', description: 'Contoh proyek awal (data contoh).' },
  });

  const topic = await prisma.topic.upsert({
    where: { userId_name: { userId, name: 'Managed Forgetting' } },
    update: {},
    create: { userId, name: 'Managed Forgetting', isHot: true },
  });

  const note = await prisma.note.create({
    data: {
      userId,
      title: 'Contoh: Mekanisme Memory Buoyancy',
      content:
        'Catatan contoh — hapus atau edit sesuka hati. MB meluruh secara eksponensial berdasarkan Δt sejak interaksi terakhir.',
      type: 'INSIGHT',
      projectId: project.id,
      spatiotemporalLocation: 'Lab Komputer / Jakarta',
      topics: { create: { topicId: topic.id } },
      interactions: { create: { type: 'CREATE', weight: 1.0 } },
    },
  });

  await prisma.memoryScore.create({
    data: { noteId: note.id, memoryBuoyancy: 0.9, preservationValue: 0.5, folder: 'LAST_FOCUS' },
  });

  await prisma.task.create({
    data: {
      userId,
      title: 'Contoh: baca artikel tentang PIMO',
      location: 'Rumah',
      dueAt: new Date(Date.now() + 86_400_000),
      energyType: 'CREATIVE',
      firstSteps: ['Buka tautan artikelnya', 'Baca paragraf pertama', 'Tulis satu kalimat ringkasan'],
      consequence: 'bahan diskusi minggu depan tidak siap',
    },
  });

  // ── ADHD OS (data contoh) ──
  await prisma.habit.createMany({
    data: [
      { userId, name: 'Jalan pagi', category: 'PHYSICAL', anchorTrigger: 'minum kopi pagi', variants: ['jalan', 'sepeda', 'peregangan'], firstSteps: ['Pakai sepatu', 'Keluar pintu', 'Jalan 5 menit'] },
      { userId, name: 'Baca 10 menit', category: 'MENTAL', anchorTrigger: 'makan siang', variants: ['buku', 'artikel'], firstSteps: ['Ambil bacaan', 'Duduk nyaman', 'Baca satu halaman'] },
      { userId, name: 'Jurnal singkat', category: 'REFLECTIVE', anchorTrigger: 'menyikat gigi malam', variants: [], firstSteps: ['Buka catatan', 'Tulis satu kalimat', 'Tutup'] },
    ],
  });
  await prisma.adminSource.createMany({
    data: [
      { userId, name: 'Email kampus', kind: 'EMAIL' },
      { userId, name: 'Grup WhatsApp kelas', kind: 'WHATSAPP' },
    ],
  });
  await prisma.opportunity.create({
    data: { userId, title: 'Contoh: pendaftaran beasiswa', source: 'Data contoh', handoverDate: new Date(Date.now() + 21 * 86_400_000), leadDays: 21 },
  });

  console.log('Seed selesai.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
