export type ActionResult = { ok: boolean; message?: string; href?: string };

export type FolderKey = 'LAST_FOCUS' | 'HOT_TOPICS' | 'ACTIVE' | 'TIME_CAPSULE' | 'FORGOTTEN';
export type NoteKind = 'NOTE' | 'TASK' | 'IDEA' | 'INSIGHT';

/** Serializable note shape handed from server pages to client components. */
export interface NoteDTO {
  id: string;
  title: string;
  content: string;
  type: NoteKind;
  updatedAt: string; // ISO
  topics: { id: string; name: string; isHot: boolean }[];
  mb: number | null;
  pv: number | null;
  folder: FolderKey;
}

export const FOLDER_LABEL: Record<FolderKey, string> = {
  LAST_FOCUS: 'Last Focus',
  HOT_TOPICS: 'Hot Topics',
  ACTIVE: 'Aktif',
  TIME_CAPSULE: 'Time Capsule',
  FORGOTTEN: 'Forgotten',
};

export const FOLDER_HINT: Record<FolderKey, string> = {
  LAST_FOCUS: 'Baru disentuh dan masih mengambang',
  HOT_TOPICS: 'Terhubung ke topik yang kamu tandai hot',
  ACTIVE: 'Masih terlihat di ruang kerja',
  TIME_CAPSULE: 'Jarang dibuka, tetapi nilainya tinggi',
  FORGOTTEN: 'Tenggelam dan disembunyikan, tidak pernah dihapus',
};

export const TYPE_LABEL: Record<NoteKind, string> = {
  NOTE: 'Catatan',
  TASK: 'Tugas',
  IDEA: 'Ide',
  INSIGHT: 'Insight',
};
