'use server';

import { revalidatePath } from 'next/cache';
import type { AdminItemStatus, HabitCategory, OpportunityStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/current-user';
import { parseLocalDateTime } from '@/lib/utils';
import { pushTaskToGoogle } from '@/lib/google/sync';
import { asEnergy, type Energy } from '@/lib/adhd/energy';
import { firstThreeSteps } from '@/lib/adhd/chunker';
import { at1700Jakarta, planDeadline } from '@/lib/adhd/lead-days';
import { awardWin, dayAsDate, jakartaDay } from '@/lib/adhd/progress';
import { XP } from '@/lib/adhd/xp';
import type { ActionResult } from '@/lib/types';

const OK_STEP = 'Sudah. Satu langkah.';
const FAIL = 'Belum tersimpan. Coba sekali lagi?';
const DONE_PREFIX = '[x] ';

function revalidateAll() {
  for (const p of ['/', '/tasks', '/sprints', '/habits', '/progress', '/admin', '/opportunities']) revalidatePath(p);
}

// ── XP ──────────────────────────────────────────────────────────────────

export async function addMicroWin(label: string, kind = 'task'): Promise<ActionResult> {
  const user = await requireUser();
  const clean = label.trim().slice(0, 120);
  if (!clean) return { ok: false, message: FAIL };
  await awardWin(user.id, clean, kind, XP.step);
  revalidatePath('/progress');
  revalidatePath('/');
  return { ok: true, message: OK_STEP };
}

// ── Task helpers ────────────────────────────────────────────────────────

async function ownedTask(taskId: string, userId: string) {
  return prisma.task.findFirst({ where: { id: taskId, userId } });
}

export async function setTaskEnergy(taskId: string, energy: Energy): Promise<ActionResult> {
  const user = await requireUser();
  const task = await ownedTask(taskId, user.id);
  if (!task) return { ok: false, message: FAIL };
  const updated = await prisma.task.update({ where: { id: taskId }, data: { energyType: asEnergy(energy), lastTouchedAt: new Date() } });
  await pushTaskToGoogle(updated);
  revalidateAll();
  return { ok: true };
}

export async function chunkTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const task = await ownedTask(taskId, user.id);
  if (!task) return { ok: false, message: FAIL };
  await prisma.task.update({ where: { id: taskId }, data: { firstSteps: firstThreeSteps(task.title), lastTouchedAt: new Date() } });
  revalidateAll();
  return { ok: true, message: 'Tiga langkah pertama siap.' };
}

/** Menyalakan atau mematikan satu langkah. XP hanya diberikan saat dicentang. */
export async function toggleTaskStep(taskId: string, index: number): Promise<ActionResult> {
  const user = await requireUser();
  const task = await ownedTask(taskId, user.id);
  if (!task || index < 0 || index >= task.firstSteps.length) return { ok: false, message: FAIL };

  const steps = [...task.firstSteps];
  const wasDone = steps[index].startsWith(DONE_PREFIX);
  steps[index] = wasDone ? steps[index].slice(DONE_PREFIX.length) : `${DONE_PREFIX}${steps[index]}`;

  await prisma.task.update({ where: { id: taskId }, data: { firstSteps: steps, lastTouchedAt: new Date(), status: task.status === 'OPEN' ? 'IN_PROGRESS' : task.status } });
  if (!wasDone) await awardWin(user.id, steps[index].slice(DONE_PREFIX.length), 'task', XP.step);
  revalidateAll();
  return { ok: true, message: wasDone ? undefined : OK_STEP };
}

/** Tunda sehari tanpa drama. Tanpa tanggal: pasang besok 17:00 WIB. */
export async function deferTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const task = await ownedTask(taskId, user.id);
  if (!task) return { ok: false, message: FAIL };
  const base = task.dueAt ?? new Date();
  const next = task.dueAt ? new Date(task.dueAt.getTime() + 86_400_000) : at1700Jakarta(new Date(base.getTime() + 86_400_000));
  const updated = await prisma.task.update({ where: { id: taskId }, data: { dueAt: next, lastTouchedAt: new Date() } });
  await pushTaskToGoogle(updated);
  revalidateAll();
  return { ok: true, message: 'Digeser ke besok.' };
}

/** "Sudah lewat, geser ke hari ini?" : pasang hari ini 17:00 WIB, atau satu jam lagi bila sudah lewat. */
export async function shiftTaskToToday(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const task = await ownedTask(taskId, user.id);
  if (!task) return { ok: false, message: FAIL };
  const now = new Date();
  const target = Math.max(at1700Jakarta(now).getTime(), now.getTime() + 3_600_000);
  const updated = await prisma.task.update({ where: { id: taskId }, data: { dueAt: new Date(target), lastTouchedAt: now } });
  await pushTaskToGoogle(updated);
  revalidateAll();
  return { ok: true, message: 'Digeser ke hari ini.' };
}

export async function archiveTask(taskId: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await prisma.task.updateMany({ where: { id: taskId, userId: user.id }, data: { archived: true, lastTouchedAt: new Date() } });
  revalidateAll();
  return res.count ? { ok: true, message: 'Diarsipkan.' } : { ok: false, message: FAIL };
}

/** Tanggal serah terima + konsekuensi, lalu milestone mundur otomatis (reverse planning). */
export async function createDeadlinePlan(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim().slice(0, 200);
  const handover = parseLocalDateTime(String(formData.get('handoverDate') ?? ''));
  if (!title || !handover) return { ok: false, message: 'Isi tugas dan kapan harus selesai.' };

  const energy = asEnergy(formData.get('energyType'), 'DEADLINE');
  const consequence = String(formData.get('consequence') ?? '').trim().slice(0, 200) || null;
  const plan = planDeadline(handover);

  const parent = await prisma.task.create({
    data: { userId: user.id, title, energyType: energy, dueAt: handover, handoverDate: handover, leadDays: plan.leadDays, consequence, firstSteps: firstThreeSteps(title) },
  });
  await pushTaskToGoogle(parent);

  for (const m of plan.milestones) {
    const child = await prisma.task.create({
      data: { userId: user.id, parentId: parent.id, title: `${title}: ${m.label}`, energyType: 'DEADLINE', dueAt: m.dueAt, handoverDate: handover, consequence },
    });
    await pushTaskToGoogle(child);
  }
  revalidateAll();
  return { ok: true, message: `Rencana mundur siap, ${plan.milestones.length} titik.` };
}

// ── Sprint ──────────────────────────────────────────────────────────────

const SPRINT_MINUTES = [25, 50, 90, 120];

export async function startSprint(energy: Energy, minutes: number, taskId?: string | null): Promise<ActionResult & { sprintId?: string }> {
  const user = await requireUser();
  const mins = SPRINT_MINUTES.includes(minutes) ? minutes : 25;
  if (minutes > 120) return { ok: false, message: 'Sprint maksimal 120 menit.' };

  const task = taskId ? await ownedTask(taskId, user.id) : null;
  const sprint = await prisma.sprint.create({
    data: { userId: user.id, energyType: asEnergy(energy), endsAt: new Date(Date.now() + mins * 60_000), taskId: task?.id ?? null, taskTitle: task?.title ?? null },
  });
  if (task) await prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS', sprintId: sprint.id, lastTouchedAt: new Date() } });
  revalidateAll();
  return { ok: true, message: `Sprint ${mins} menit dimulai.`, sprintId: sprint.id };
}

export async function endSprint(sprintId: string): Promise<ActionResult> {
  const user = await requireUser();
  const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, userId: user.id } });
  if (!sprint) return { ok: false, message: FAIL };
  if (!sprint.endedAt) {
    await prisma.sprint.update({ where: { id: sprintId }, data: { endedAt: new Date() } });
    await awardWin(user.id, sprint.taskTitle ?? 'Satu sprint', 'sprint', XP.sprint);
  }
  revalidateAll();
  return { ok: true, message: 'Sudah. Istirahat 15 menit dulu.' };
}

// ── Habit ───────────────────────────────────────────────────────────────

const HABIT_CATEGORIES: HabitCategory[] = ['PHYSICAL', 'MENTAL', 'REFLECTIVE', 'ROUTINE'];

function splitList(raw: string, max = 6): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, max);
}

export async function createHabit(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  if (!name) return { ok: false, message: 'Beri nama kebiasaannya.' };
  const rawCat = String(formData.get('category') ?? 'ROUTINE') as HabitCategory;
  const category = HABIT_CATEGORIES.includes(rawCat) ? rawCat : 'ROUTINE';
  const anchorTrigger = String(formData.get('anchorTrigger') ?? '').trim().slice(0, 100) || null;
  const variants = splitList(String(formData.get('variants') ?? ''));
  const typed = splitList(String(formData.get('firstSteps') ?? ''), 3);

  await prisma.habit.create({
    data: { userId: user.id, name, category, anchorTrigger, variants, firstSteps: typed.length === 3 ? typed : firstThreeSteps(name, category) },
  });
  revalidatePath('/habits');
  revalidatePath('/');
  return { ok: true, message: 'Kebiasaan ditambahkan.' };
}

export async function archiveHabit(habitId: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.habit.updateMany({ where: { id: habitId, userId: user.id }, data: { archived: true } });
  revalidatePath('/habits');
  revalidatePath('/');
  return { ok: true, message: 'Diarsipkan.' };
}

/** Idempotent: upsert log hari ini; stepsDone mengikuti jumlah langkah yang dicentang. */
export async function tickHabitStep(habitId: string, stepIndex: number, done: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
  if (!habit) return { ok: false, message: FAIL };

  const date = dayAsDate(jakartaDay());
  const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId, date } } });
  const before = existing?.stepsDone ?? 0;
  const next = Math.min(habit.firstSteps.length, Math.max(0, done ? Math.max(before, stepIndex + 1) : stepIndex));

  await prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date } },
    update: { stepsDone: next, completed: next >= 1 || existing?.completed === true },
    create: { habitId, date, stepsDone: next, completed: next >= 1 },
  });
  if (done && before === 0 && next >= 1) await awardWin(user.id, `${habit.name}: langkah pertama`, 'habit', XP.step);
  revalidatePath('/habits');
  revalidatePath('/');
  return { ok: true, message: done && before === 0 ? OK_STEP : undefined };
}

export async function completeHabit(habitId: string, variantUsed?: string | null, minutes?: number | null): Promise<ActionResult> {
  const user = await requireUser();
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
  if (!habit) return { ok: false, message: FAIL };
  const date = dayAsDate(jakartaDay());
  const existing = await prisma.habitLog.findUnique({ where: { habitId_date: { habitId, date } } });
  await prisma.habitLog.upsert({
    where: { habitId_date: { habitId, date } },
    update: { completed: true, stepsDone: Math.max(1, existing?.stepsDone ?? 0), variantUsed: variantUsed ?? existing?.variantUsed ?? null, minutes: minutes ?? existing?.minutes ?? null },
    create: { habitId, date, completed: true, stepsDone: 1, variantUsed: variantUsed ?? null, minutes: minutes ?? null },
  });
  if (!existing?.completed || existing.stepsDone === 0) await awardWin(user.id, habit.name, 'habit', XP.habit);
  revalidatePath('/habits');
  revalidatePath('/');
  return { ok: true, message: 'Sudah. Satu langkah.' };
}

/** Rotasi format (Novelty): kembalikan varian berikutnya dari daftar. */
export async function rotateHabitVariant(habitId: string): Promise<ActionResult & { variant?: string }> {
  const user = await requireUser();
  const habit = await prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
  if (!habit || habit.variants.length === 0) return { ok: false, message: 'Belum ada varian. Tambahkan di kebiasaannya.' };
  const last = await prisma.habitLog.findFirst({ where: { habitId, variantUsed: { not: null } }, orderBy: { date: 'desc' } });
  const idx = last?.variantUsed ? habit.variants.indexOf(last.variantUsed) : -1;
  const variant = habit.variants[(idx + 1) % habit.variants.length];
  return { ok: true, message: `Coba format: ${variant}`, variant };
}

// ── Admin sweep ─────────────────────────────────────────────────────────

const ADMIN_KINDS = ['EMAIL', 'WHATSAPP', 'PORTAL', 'OTHER'] as const;

export async function createAdminSource(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const name = String(formData.get('name') ?? '').trim().slice(0, 80);
  if (!name) return { ok: false, message: 'Beri nama sumbernya.' };
  const rawKind = String(formData.get('kind') ?? 'OTHER') as (typeof ADMIN_KINDS)[number];
  const kind = ADMIN_KINDS.includes(rawKind) ? rawKind : 'OTHER';
  const rawUrl = String(formData.get('url') ?? '').trim();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl.slice(0, 300) : null;
  await prisma.adminSource.create({ data: { userId: user.id, name, kind, url } });
  revalidatePath('/admin');
  return { ok: true, message: 'Sumber ditambahkan.' };
}

export async function startAdminSweep(plannedMin = 20): Promise<ActionResult & { sessionId?: string }> {
  const user = await requireUser();
  const mins = Math.min(30, Math.max(10, plannedMin));
  const session = await prisma.adminSweepSession.create({ data: { userId: user.id, plannedMin: mins } });
  revalidatePath('/admin');
  return { ok: true, message: `Sweep ${mins} menit dimulai.`, href: `/admin/${session.id}`, sessionId: session.id };
}

export async function logAdminItem(sessionId: string, sourceId: string, title: string): Promise<ActionResult> {
  const user = await requireUser();
  const clean = title.trim().slice(0, 160);
  if (!clean) return { ok: false, message: 'Tulis satu baris dulu.' };
  const [session, source] = await Promise.all([
    prisma.adminSweepSession.findFirst({ where: { id: sessionId, userId: user.id } }),
    prisma.adminSource.findFirst({ where: { id: sourceId, userId: user.id } }),
  ]);
  if (!session || !source) return { ok: false, message: FAIL };
  await prisma.$transaction([
    prisma.adminItem.create({ data: { userId: user.id, sourceId, sessionId, title: clean } }),
    prisma.adminSweepSession.update({ where: { id: sessionId }, data: { itemsFound: { increment: 1 } } }),
  ]);
  revalidatePath(`/admin/${sessionId}`);
  return { ok: true, message: 'Tercatat.' };
}

/** Menutup sweep, lalu item yang masih OPEN masuk ke bucket ADMIN sebagai tugas. */
export async function endAdminSweep(sessionId: string, notes?: string): Promise<ActionResult> {
  const user = await requireUser();
  const session = await prisma.adminSweepSession.findFirst({ where: { id: sessionId, userId: user.id }, include: { items: true } });
  if (!session) return { ok: false, message: FAIL };

  if (!session.endedAt) {
    await prisma.adminSweepSession.update({ where: { id: sessionId }, data: { endedAt: new Date(), notes: notes?.slice(0, 300) ?? null } });
    const open = session.items.filter((i) => i.status === 'OPEN');
    for (const item of open) {
      const task = await prisma.task.create({ data: { userId: user.id, title: item.title, energyType: 'ADMIN', dueAt: item.dueAt } });
      await pushTaskToGoogle(task);
    }
    if (open.length) await prisma.adminItem.updateMany({ where: { id: { in: open.map((i) => i.id) } }, data: { status: 'IN_PROGRESS' } });
    await awardWin(user.id, 'Sweep admin selesai', 'sweep', XP.sweep);
  }
  revalidateAll();
  return { ok: true, message: `Ditemukan ${session.items.length}. Sisanya masuk Sprint Admin.` };
}

export async function setAdminItemStatus(itemId: string, status: AdminItemStatus): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.adminItem.updateMany({ where: { id: itemId, userId: user.id }, data: { status } });
  revalidatePath('/admin');
  return { ok: true };
}

// ── Opportunity radar ───────────────────────────────────────────────────

const OPP_STATUSES: OpportunityStatus[] = ['WATCHING', 'APPLYING', 'SUBMITTED', 'ARCHIVED'];

export async function createOpportunity(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = String(formData.get('title') ?? '').trim().slice(0, 160);
  const handover = parseLocalDateTime(String(formData.get('handoverDate') ?? ''));
  if (!title || !handover) return { ok: false, message: 'Isi nama dan tanggal tenggatnya.' };
  const source = String(formData.get('source') ?? '').trim().slice(0, 80) || null;
  const rawUrl = String(formData.get('url') ?? '').trim();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl.slice(0, 300) : null;
  await prisma.opportunity.create({ data: { userId: user.id, title, source, url, handoverDate: handover, leadDays: planDeadline(handover).leadDays } });
  revalidatePath('/opportunities');
  revalidatePath('/');
  return { ok: true, message: 'Peluang masuk radar.' };
}

export async function updateOpportunityStatus(id: string, status: OpportunityStatus): Promise<ActionResult> {
  const user = await requireUser();
  if (!OPP_STATUSES.includes(status)) return { ok: false, message: FAIL };
  await prisma.opportunity.updateMany({ where: { id, userId: user.id }, data: { status } });
  revalidatePath('/opportunities');
  revalidatePath('/');
  return { ok: true };
}

/** Peluang menjadi tugas DEADLINE lengkap dengan tiga langkah pertama dan milestone mundur. */
export async function chunkOpportunity(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const opp = await prisma.opportunity.findFirst({ where: { id, userId: user.id } });
  if (!opp) return { ok: false, message: FAIL };
  const task = await prisma.task.create({
    data: {
      userId: user.id,
      title: opp.title,
      energyType: 'DEADLINE',
      dueAt: opp.handoverDate,
      handoverDate: opp.handoverDate,
      leadDays: opp.leadDays,
      firstSteps: firstThreeSteps(opp.title),
      consequence: `peluang ${opp.title} lewat tanpa sempat diajukan`,
    },
  });
  await pushTaskToGoogle(task);
  if (opp.status === 'WATCHING') await prisma.opportunity.update({ where: { id }, data: { status: 'APPLYING' } });
  revalidateAll();
  return { ok: true, message: 'Tiga langkah pertama siap di Sprint Tenggat.' };
}

// ── Interoceptive reset ─────────────────────────────────────────────────

export async function logResetSession(minutes: number, kind: string): Promise<ActionResult> {
  const user = await requireUser();
  await awardWin(user.id, `Reset ${Math.round(minutes)} menit (${kind.slice(0, 30)})`, 'reset', XP.reset);
  revalidatePath('/progress');
  revalidatePath('/');
  return { ok: true, message: 'Selesai. Lanjut pelan-pelan.' };
}

// ── Body doubling ───────────────────────────────────────────────────────

export async function startBodyDouble(roomId?: string, taskTitle?: string): Promise<ActionResult & { roomId?: string; id?: string }> {
  const user = await requireUser();
  const room = (roomId ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 24) || Math.random().toString(36).slice(2, 10);
  const s = await prisma.bodyDoubleSession.create({ data: { userId: user.id, roomId: room, taskTitle: taskTitle?.slice(0, 120) ?? null } });
  return { ok: true, message: 'Ruang fokus dibuka.', roomId: room, id: s.id };
}

/** Menyegarkan kehadiran dan mengembalikan berapa orang LAIN yang aktif 30 detik terakhir. */
export async function pingBodyDouble(id: string): Promise<{ ok: boolean; others: number }> {
  const user = await requireUser();
  const mine = await prisma.bodyDoubleSession.findFirst({ where: { id, userId: user.id, endedAt: null } });
  if (!mine) return { ok: false, others: 0 };
  await prisma.bodyDoubleSession.update({ where: { id }, data: { lastPingAt: new Date() } });
  const others = await prisma.bodyDoubleSession.count({
    where: { roomId: mine.roomId, endedAt: null, id: { not: id }, lastPingAt: { gte: new Date(Date.now() - 30_000) } },
  });
  return { ok: true, others };
}

export async function endBodyDouble(id: string): Promise<ActionResult> {
  const user = await requireUser();
  await prisma.bodyDoubleSession.updateMany({ where: { id, userId: user.id }, data: { endedAt: new Date() } });
  return { ok: true };
}
