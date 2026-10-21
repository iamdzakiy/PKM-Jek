/**
 * Konstanta energi. Sengaja tidak mengimpor runtime dari @prisma/client
 * supaya aman dipakai di komponen client.
 */
export const ENERGY_TYPES = ['URGENT', 'DEADLINE', 'ADMIN', 'CREATIVE'] as const;
export type Energy = (typeof ENERGY_TYPES)[number];

export type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export const ENERGY_LEVELS: EnergyLevel[] = ['LOW', 'MEDIUM', 'HIGH'];

export const ENERGY_LABEL: Record<Energy, string> = {
  URGENT: 'Mendesak',
  DEADLINE: 'Tenggat',
  ADMIN: 'Admin',
  CREATIVE: 'Kreatif',
};

export const ENERGY_HINT: Record<Energy, string> = {
  URGENT: 'Perlu hari ini',
  DEADLINE: 'Mendekati tenggat',
  ADMIN: 'Rutin, rendah tenaga',
  CREATIVE: 'Menarik, mengalir',
};

export const LEVEL_LABEL: Record<EnergyLevel, string> = { LOW: 'Rendah', MEDIUM: 'Sedang', HIGH: 'Tinggi' };

/** Kelas chip lembut per energi. Tidak ada merah. */
export const ENERGY_CHIP: Record<Energy, string> = {
  URGENT: 'bg-energy-urgent/45 text-ink',
  DEADLINE: 'bg-energy-deadline/45 text-ink',
  ADMIN: 'bg-energy-admin/60 text-ink',
  CREATIVE: 'bg-energy-creative/45 text-ink',
};

/** Energi rendah: hanya yang ringan. Sedang: terstruktur. Tinggi: tenaga penuh. */
export const ENERGY_BY_LEVEL: Record<EnergyLevel, Energy[]> = {
  LOW: ['ADMIN'],
  MEDIUM: ['DEADLINE', 'ADMIN'],
  HIGH: ['CREATIVE', 'URGENT', 'DEADLINE'],
};

export function isEnergy(v: unknown): v is Energy {
  return typeof v === 'string' && (ENERGY_TYPES as readonly string[]).includes(v);
}

export function asEnergy(v: unknown, fallback: Energy = 'ADMIN'): Energy {
  return isEnergy(v) ? v : fallback;
}

/** Kalimat konsekuensi cadangan bila pengguna tidak mengisi sendiri. */
export const CONSEQUENCE_FALLBACK: Record<Energy, string> = {
  URGENT: 'bergeser ke besok dan menumpuk dengan hal lain',
  DEADLINE: 'tenggatnya makin sempit dan langkahnya makin banyak sekaligus',
  ADMIN: 'urusannya menumpuk di antrean admin',
  CREATIVE: 'idenya mendingin dan lebih sulit dilanjutkan',
};
