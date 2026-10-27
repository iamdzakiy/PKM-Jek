import type { AdminSourceKind, HabitCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { firstThreeSteps } from '@/lib/adhd/chunker';

/**
 * Paket awal Jek: rutinitas harian (ikut jadwal gym pagi dari Bulking Plan),
 * peran/organisasi sebagai proyek bertag, dan sumber cek pagi.
 * Semua bisa diubah atau diarsipkan kapan saja.
 */

export interface HabitSpec {
  name: string;
  category: HabitCategory;
  timeOfDay: string | null;
  daysOfWeek?: number[];
  intervalDays?: number;
  minimumVersion: string;
  variants?: string[];
}

/** Bagian latihan: ikut "Jek Bulking Plan" (gym 05.30 Sen/Rab/Jum, lari Sabtu, yoga Kamis & Minggu). */
export const TRAINING_HABITS: HabitSpec[] = [
  { name: 'Gym', category: 'PHYSICAL', timeOfDay: '05:30', daysOfWeek: [1, 3, 5], minimumVersion: 'Versi rumah 20 menit', variants: ['Full Body A', 'Full Body B'] },
  { name: 'Shake bulking', category: 'ROUTINE', timeOfDay: '07:00', minimumVersion: 'Segelas susu + pisang' },
  { name: 'Lari santai', category: 'PHYSICAL', timeOfDay: '07:00', daysOfWeek: [6], minimumVersion: 'Jalan kaki 15 menit' },
  { name: 'Yoga', category: 'PHYSICAL', timeOfDay: null, daysOfWeek: [4, 7], minimumVersion: '3 pose, 3 menit' },
  { name: 'Timbang', category: 'ROUTINE', timeOfDay: '05:15', daysOfWeek: [1], minimumVersion: 'Naik timbangan aja' },
  { name: 'Siap tidur', category: 'ROUTINE', timeOfDay: '22:00', minimumVersion: 'HP di luar kasur' },
];

export const STARTER_HABITS: HabitSpec[] = [
  ...TRAINING_HABITS,
  { name: 'Cek pagi', category: 'ROUTINE', timeOfDay: '07:15', minimumVersion: 'WA + Edunex aja' },
  { name: 'Makan siang besar', category: 'ROUTINE', timeOfDay: '12:00', minimumVersion: 'Nasi + 1 lauk protein' },
  { name: 'Cuci piring', category: 'ROUTINE', timeOfDay: '19:30', minimumVersion: 'Yang ada di wastafel aja' },
  { name: 'Journaling', category: 'REFLECTIVE', timeOfDay: '21:30', minimumVersion: '3 kalimat' },
  { name: 'Meditasi', category: 'MENTAL', timeOfDay: '21:45', minimumVersion: '2 menit tarik napas' },
  { name: 'Cuci baju', category: 'ROUTINE', timeOfDay: null, intervalDays: 3, minimumVersion: 'Rendam / masukin mesin dulu' },
  { name: 'Beresin kamar', category: 'ROUTINE', timeOfDay: null, intervalDays: 2, minimumVersion: '5 menit beresin meja' },
  { name: 'Review mingguan', category: 'REFLECTIVE', timeOfDay: '20:00', daysOfWeek: [7], minimumVersion: 'Lihat jadwal minggu depan' },
];

/** Halaman yang membantu menyelesaikan habit tertentu (dibuka dari Hari Ini). */
export const HABIT_LINKS: Record<string, string> = {
  gym: '/training',
  'lari santai': '/training',
  yoga: '/training',
  timbang: '/training',
  'cek pagi': '/admin',
  'review mingguan': '/review',
};

/**
 * Pasang habit. `overwrite` = habit bernama sama ikut disesuaikan jadwalnya
 * (dipakai saat menyelaraskan dengan rencana latihan); tanpa itu yang sudah
 * ada dibiarkan.
 */
export async function upsertHabits(userId: string, specs: HabitSpec[], overwrite: boolean) {
  const existing = await prisma.habit.findMany({ where: { userId, archived: false }, select: { id: true, name: true } });
  const byName = new Map(existing.map((h) => [h.name.toLowerCase(), h.id]));
  let created = 0;
  let updated = 0;
  for (const s of specs) {
    const schedule = {
      timeOfDay: s.timeOfDay,
      daysOfWeek: s.daysOfWeek ?? [1, 2, 3, 4, 5, 6, 7],
      intervalDays: s.intervalDays ?? null,
      minimumVersion: s.minimumVersion,
    };
    const id = byName.get(s.name.toLowerCase());
    if (id) {
      if (overwrite) {
        await prisma.habit.update({ where: { id }, data: schedule });
        updated++;
      }
      continue;
    }
    await prisma.habit.create({
      data: { userId, name: s.name, category: s.category, variants: s.variants ?? [], firstSteps: firstThreeSteps(s.name, s.category), ...schedule },
    });
    created++;
  }
  return { created, updated };
}

// ── Peran: tiap organisasi/tanggung jawab jadi proyek dengan tag pendek ──

export const ROLE_PROJECTS: { name: string; tag: string; description: string }[] = [
  { name: 'Akademik', tag: 'akademik', description: 'Edunex, list tugas kuliah, TA.' },
  { name: 'Kabid Internal', tag: 'internal', description: 'Urusan internal organisasi.' },
  { name: 'Ketua IMD 2026', tag: 'imd', description: 'Kepanitiaan IMD 2026.' },
  { name: 'Ketua Digistar 2026', tag: 'digistar', description: 'Kepanitiaan Digistar 2026.' },
  { name: 'Asisten Statdas', tag: 'statdas', description: 'Asistensi Statistika Dasar.' },
  { name: 'Asisten Bioinformatika', tag: 'bioinfo', description: 'Asistensi Bioinformatika.' },
  { name: 'Wisuda Oktober', tag: 'wisuda', description: 'Persiapan wisuda Oktober.' },
  { name: 'Mamet Duta Kampus ITB', tag: 'duta', description: 'Duta Kampus ITB.' },
];

export async function installRoles(userId: string) {
  const existing = await prisma.project.findMany({ where: { userId }, select: { name: true, tag: true } });
  const names = new Set(existing.map((p) => p.name.toLowerCase()));
  const tags = new Set(existing.map((p) => p.tag).filter(Boolean));
  const fresh = ROLE_PROJECTS.filter((r) => !names.has(r.name.toLowerCase()) && !tags.has(r.tag));
  for (const r of fresh) await prisma.project.create({ data: { userId, ...r } });
  return fresh.length;
}

// ── Cek pagi: semua kotak masuk yang dibuka tiap pagi ──

export const MORNING_SOURCES: { name: string; kind: AdminSourceKind; url: string | null }[] = [
  { name: 'WhatsApp', kind: 'WHATSAPP', url: 'https://web.whatsapp.com' },
  { name: 'Outlook (ITB)', kind: 'EMAIL', url: 'https://outlook.office.com/mail/' },
  { name: 'Gmail', kind: 'EMAIL', url: 'https://mail.google.com' },
  { name: 'LINE', kind: 'OTHER', url: null },
  { name: 'Instagram DM', kind: 'OTHER', url: 'https://www.instagram.com/direct/inbox/' },
  { name: 'Edunex', kind: 'PORTAL', url: 'https://edunex.itb.ac.id' },
  { name: 'Info peluang (lomba, beasiswa)', kind: 'OTHER', url: null },
];

export async function installMorningSources(userId: string) {
  const existing = await prisma.adminSource.findMany({ where: { userId, active: true }, select: { name: true } });
  const have = new Set(existing.map((s) => s.name.toLowerCase()));
  const fresh = MORNING_SOURCES.filter((s) => !have.has(s.name.toLowerCase()));
  for (const s of fresh) await prisma.adminSource.create({ data: { userId, ...s } });
  return fresh.length;
}
