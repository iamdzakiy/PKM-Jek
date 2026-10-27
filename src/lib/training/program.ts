/**
 * Program latihan dari "Jek Bulking Plan": Full Body A/B untuk bulan 1–3,
 * lalu Push/Pull/Legs. Data murni, aman di client dan server.
 */

export type WorkoutKey = 'A' | 'B' | 'PUSH' | 'PULL' | 'LEGS' | 'HOME' | 'RUN' | 'YOGA';

export interface Exercise {
  id: string;
  name: string;
  sets: number;
  /** rentang rep; untuk plank dll. dibaca sebagai detik */
  reps: [number, number];
  unit?: 'rep' | 'detik' | 'per kaki';
  restSec: number;
  cue: string;
  /** gerakan beban badan: kolom beban disembunyikan */
  bodyweight?: boolean;
}

export interface Workout {
  key: WorkoutKey;
  name: string;
  short: string;
  minutes: number;
  warmup: string;
  exercises: Exercise[];
}

const ex = (id: string, name: string, sets: number, reps: [number, number], restSec: number, cue: string, extra: Partial<Exercise> = {}): Exercise => ({ id, name, sets, reps, restSec, cue, ...extra });

export const WORKOUTS: Record<WorkoutKey, Workout> = {
  A: {
    key: 'A',
    name: 'Full Body A',
    short: 'Squat · bench · pulldown · shoulder · plank',
    minutes: 60,
    warmup: '8–10 menit: jalan treadmill 3 menit, lalu 1 set ringan goblet squat. Pagi butuh pemanasan lebih lama.',
    exercises: [
      ex('goblet-squat', 'Goblet squat (atau leg press)', 3, [8, 12], 120, 'Dumbbell di depan dada, kaki selebar bahu. Duduk ke bawah sampai paha sejajar lantai, lutut searah jari kaki, dorong lantai pakai seluruh telapak.'),
      ex('db-bench', 'Dumbbell bench press', 3, [8, 12], 120, 'Belikat ditarik ke belakang-bawah. Turunkan sampai sejajar dada, siku ±45° dari badan. Dorong sampai hampir lurus.'),
      ex('lat-pulldown', 'Lat pulldown', 3, [10, 12], 90, 'Pegangan sedikit lebih lebar dari bahu. Tarik ke dada atas, pikirkan "siku ke kantong celana". Naik pelan.'),
      ex('db-shoulder', 'Dumbbell shoulder press', 2, [10, 12], 90, 'Duduk bersandar, dumbbell sejajar telinga. Dorong ke atas tanpa punggung bawah melengkung.'),
      ex('plank', 'Plank', 3, [30, 30], 60, 'Siku di bawah bahu, badan lurus kepala sampai tumit. Perut dan pantat dikencangkan.', { unit: 'detik', bodyweight: true }),
    ],
  },
  B: {
    key: 'B',
    name: 'Full Body B',
    short: 'RDL · incline · row · lunges · arms',
    minutes: 60,
    warmup: '8–10 menit: jalan treadmill 3 menit, lalu 1 set ringan RDL.',
    exercises: [
      ex('db-rdl', 'Romanian deadlift dumbbell', 3, [8, 12], 120, 'Lutut ditekuk sedikit dan dikunci. Dorong pantat ke belakang, dumbbell turun dekat kaki sampai hamstring ketarik. Punggung lurus.'),
      ex('incline-press', 'Incline DB press / incline push-up', 3, [8, 12], 120, 'Bench 30°. Sama seperti bench press. Versi push-up: tangan di bench, badan lurus.'),
      ex('cable-row', 'Seated cable row', 3, [10, 12], 90, 'Dada membusung, tarik ke perut, jepit belikat 1 detik. Badan jangan ikut mengayun.'),
      ex('walking-lunge', 'Lunges (jalan)', 2, [10, 10], 90, 'Langkah panjang, lutut belakang hampir menyentuh lantai. Lutut depan jangan jatuh ke dalam.', { unit: 'per kaki' }),
      ex('curl-pushdown', 'Bicep curl + tricep pushdown', 2, [12, 12], 60, 'Siku menempel di samping badan untuk keduanya. Hanya lengan bawah yang bergerak.'),
    ],
  },
  PUSH: {
    key: 'PUSH',
    name: 'Push',
    short: 'Dada · bahu · trisep',
    minutes: 60,
    warmup: '8 menit: treadmill + 2 set ringan bench press.',
    exercises: [
      ex('bench', 'Bench press (barbell/dumbbell)', 3, [6, 8], 150, 'Belikat terkunci, kaki menapak. Turun terkontrol ke dada bawah.'),
      ex('ohp', 'Overhead press', 3, [8, 10], 120, 'Perut dan pantat kencang, bar lurus naik di atas kepala.'),
      ex('incline-db', 'Incline dumbbell press', 3, [10, 12], 90, 'Bench 30°, siku ±45°.'),
      ex('lateral-raise', 'Lateral raise', 3, [12, 15], 60, 'Angkat ke samping sampai setinggi bahu, siku sedikit ditekuk. Beban ringan.'),
      ex('pushdown', 'Tricep pushdown', 3, [10, 12], 60, 'Siku menempel, dorong sampai lurus.'),
    ],
  },
  PULL: {
    key: 'PULL',
    name: 'Pull',
    short: 'Punggung · bisep',
    minutes: 60,
    warmup: '8 menit: treadmill + 2 set ringan row.',
    exercises: [
      ex('row', 'Barbell row / chest-supported DB row', 3, [6, 8], 150, 'Punggung lurus, tarik ke perut bawah.'),
      ex('pullup', 'Pull-up (atau lat pulldown)', 3, [8, 10], 120, 'Mulai dari lengan lurus, dada ke arah bar.'),
      ex('cable-row-2', 'Seated cable row', 3, [10, 12], 90, 'Jepit belikat 1 detik di akhir.'),
      ex('face-pull', 'Face pull', 3, [12, 15], 60, 'Tali ke arah dahi, siku tinggi, buka tangan di akhir.'),
      ex('curl', 'EZ bar curl / hammer curl', 3, [10, 12], 60, 'Tanpa mengayun badan.'),
    ],
  },
  LEGS: {
    key: 'LEGS',
    name: 'Legs',
    short: 'Paha · pantat · betis',
    minutes: 60,
    warmup: '10 menit: treadmill + 2 set ringan squat.',
    exercises: [
      ex('squat', 'Squat (barbell atau goblet)', 3, [6, 8], 150, 'Duduk di antara tumit, lutut searah jari kaki, dada tegak.'),
      ex('rdl', 'Romanian deadlift', 3, [8, 10], 120, 'Pinggul ke belakang, bar dekat kaki.'),
      ex('leg-press', 'Leg press', 3, [10, 12], 90, 'Turun sampai lutut ±90°, punggung bawah tetap menempel.'),
      ex('leg-curl', 'Leg curl', 3, [12, 15], 60, 'Pelan saat turun.'),
      ex('calf-raise', 'Calf raise', 3, [12, 15], 60, 'Tahan 1 detik di atas.'),
    ],
  },
  HOME: {
    key: 'HOME',
    name: 'Versi rumah 20 menit',
    short: 'Push-up · squat · backpack row · lunges · plank',
    minutes: 20,
    warmup: '3 menit jalan di tempat dan putar sendi.',
    exercises: [
      ex('pushup', 'Push-up', 3, [8, 15], 45, 'Badan lurus seperti plank.', { bodyweight: true }),
      ex('bw-squat', 'Squat', 3, [15, 20], 45, 'Pelan saat turun.', { bodyweight: true }),
      ex('backpack-row', 'Backpack row (tas isi buku)', 3, [10, 15], 45, 'Badan condong, tarik tas ke perut.', { bodyweight: true }),
      ex('lunge', 'Lunges', 3, [10, 10], 45, 'Lutut depan tidak jatuh ke dalam.', { unit: 'per kaki', bodyweight: true }),
      ex('home-plank', 'Plank', 3, [30, 30], 45, 'Perut kencang.', { unit: 'detik', bodyweight: true }),
    ],
  },
  RUN: {
    key: 'RUN',
    name: 'Lari santai',
    short: '20 menit, masih bisa ngobrol',
    minutes: 20,
    warmup: '5 menit jalan cepat.',
    exercises: [],
  },
  YOGA: {
    key: 'YOGA',
    name: 'Yoga 15 menit',
    short: 'Recovery dan tidur',
    minutes: 15,
    warmup: 'Matras atau karpet. Boleh ikut video "15 min yoga for beginners".',
    exercises: [],
  },
};

export const YOGA_FLOW: { pose: string; dur: string; why: string }[] = [
  { pose: 'Napas perut (duduk bersila)', dur: '2 menit', why: 'Menenangkan pikiran' },
  { pose: 'Cat-cow', dur: '1 menit', why: 'Punggung kaku habis kuliah' },
  { pose: 'Downward dog', dur: '1 menit', why: 'Hamstring, betis, bahu' },
  { pose: 'Low lunge kiri + kanan', dur: '1 menit/sisi', why: 'Pinggul depan' },
  { pose: 'Pigeon kiri + kanan', dur: '1 menit/sisi', why: 'Pantat dan pinggul' },
  { pose: 'Thread the needle', dur: '45 detik/sisi', why: 'Punggung atas' },
  { pose: "Child's pose", dur: '1 menit', why: 'Punggung bawah' },
  { pose: 'Supine twist', dur: '45 detik/sisi', why: 'Punggung bawah' },
  { pose: 'Savasana', dur: '3 menit', why: 'Tutup sesi' },
];

/** Jadwal mingguan (ISO weekday 1 = Senin). */
export const WEEK_PLAN: { day: number; label: string; plan: string; time: string }[] = [
  { day: 1, label: 'Senin', plan: 'Gym', time: '05.30' },
  { day: 2, label: 'Selasa', plan: 'Istirahat', time: '' },
  { day: 3, label: 'Rabu', plan: 'Gym', time: '05.30' },
  { day: 4, label: 'Kamis', plan: 'Yoga 15 menit (malam)', time: '21.30' },
  { day: 5, label: 'Jumat', plan: 'Gym', time: '05.30' },
  { day: 6, label: 'Sabtu', plan: 'Lari santai 20 menit', time: '07.00' },
  { day: 7, label: 'Minggu', plan: 'Yoga 15 menit (pagi) + meal prep', time: '07.00' },
];

export const GYM_DAYS = [1, 3, 5];
/** Minggu ke-13 dan seterusnya boleh pindah ke PPL bila syarat terpenuhi. */
export const PPL_AFTER_WEEKS = 12;

/** Nomor minggu ISO dari YYYY-MM-DD. */
export function isoWeek(ymd: string): number {
  const d = new Date(`${ymd}T00:00:00Z`);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Sesi gym untuk hari tertentu. Full Body berselang: minggu ganjil A-B-A,
 * minggu genap B-A-B, jadi tiap workout kebagian 3x dalam 2 minggu.
 * Fase PPL: Senin Push, Rabu Pull, Jumat Legs.
 */
export function gymWorkoutFor(ymd: string, weekday: number, phase: 'fullbody' | 'ppl'): WorkoutKey | null {
  const slot = GYM_DAYS.indexOf(weekday);
  if (slot < 0) return null;
  if (phase === 'ppl') return (['PUSH', 'PULL', 'LEGS'] as const)[slot];
  const odd = isoWeek(ymd) % 2 === 1;
  const seq: WorkoutKey[] = odd ? ['A', 'B', 'A'] : ['B', 'A', 'B'];
  return seq[slot];
}

/** Kegiatan latihan hari ini menurut jadwal (bukan gym). */
export function cardioFor(weekday: number): WorkoutKey | null {
  if (weekday === 6) return 'RUN';
  if (weekday === 4 || weekday === 7) return 'YOGA';
  return null;
}

export interface LoggedSet {
  exercise: string;
  weight: number | null;
  reps: number[];
}

/**
 * Progressive overload: kalau semua set sesi terakhir tembus batas atas rep,
 * naikkan beban 1–2,5 kg dan kembali ke batas bawah. Kalau belum, tambah 1 rep.
 */
export function nextTarget(ex: Exercise, last: LoggedSet | undefined): { weight: number | null; reps: number; hint: string } {
  const [lo, hi] = ex.reps;
  if (!last || last.reps.length === 0) return { weight: last?.weight ?? null, reps: lo, hint: ex.bodyweight || ex.unit === 'detik' ? 'Sesi pertama: catat yang kamu bisa.' : 'Sesi pertama: pilih beban yang bikin form tetap rapi.' };
  const done = last.reps.slice(0, ex.sets);
  const allTop = done.length >= ex.sets && done.every((r) => r >= hi);
  if (ex.bodyweight || ex.unit === 'detik') {
    return allTop ? { weight: null, reps: hi, hint: 'Udah mentok atas. Pelankan tempo atau tambah 1 set.' } : { weight: null, reps: Math.min(hi, Math.max(...done, lo) + 1), hint: 'Coba +1 rep dari terakhir.' };
  }
  if (allTop && last.weight !== null) {
    const step = last.weight < 10 ? 1 : 2.5;
    return { weight: last.weight + step, reps: lo, hint: `Naik level! Beban +${step} kg, balik ke ${lo} rep.` };
  }
  return { weight: last.weight, reps: Math.min(hi, Math.max(...done, lo - 1) + 1), hint: 'Beban sama, kejar +1 rep.' };
}

/** Rentang naik berat sehat untuk bulking pemula: 0,25–0,5% BB per minggu (Iraki dkk., 2019). */
export function weeklyGainRange(weightKg: number): [number, number] {
  return [Math.round(weightKg * 0.0025 * 100) / 100, Math.round(weightKg * 0.005 * 100) / 100];
}
