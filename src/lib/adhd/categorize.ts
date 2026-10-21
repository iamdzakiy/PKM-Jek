import type { Energy } from './energy';

export interface Categorized {
  type: 'NOTE' | 'TASK' | 'IDEA' | 'INSIGHT';
  energy: Energy | null;
}

const ACTION_VERBS = /^(kirim|bayar|daftar|email|telepon|hubungi|isi|upload|unggah|booking|pesan|beli|cetak|balas|jadwalkan)\b/i;
const DATE_HINT = /\b(besok|lusa|minggu depan|deadline|tenggat|batas|hari ini|nanti malam|jam \d{1,2})\b/i;
const IDEA_HINT = /\b(ide|bagaimana kalau|gimana kalau|coba|mungkin bisa)\b|\?\s*$/i;

/**
 * Auto-kategori heuristik untuk Quick Capture. Hashtag eksplisit selalu menang,
 * jadi fungsi ini hanya dipanggil bila pengguna tidak menentukan tipe.
 */
export function categorizeCapture(text: string): Categorized {
  const t = text.trim();
  if (DATE_HINT.test(t)) return { type: 'TASK', energy: 'DEADLINE' };
  if (ACTION_VERBS.test(t)) return { type: 'TASK', energy: 'ADMIN' };
  if (IDEA_HINT.test(t)) return { type: 'IDEA', energy: 'CREATIVE' };
  return { type: 'NOTE', energy: null };
}
