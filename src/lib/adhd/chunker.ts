/**
 * First 3 Steps: heuristik lokal, tanpa API AI eksternal.
 * Aturan: tepat 3 langkah fisik, masing-masing pendek, langkah pertama < 2 menit.
 */
export type ChunkCategory = 'PHYSICAL' | 'MENTAL' | 'REFLECTIVE' | 'ROUTINE';
type Steps = [string, string, string];

const VERB_TEMPLATES: Record<string, Steps> = {
  baca: ['Buka dokumennya', 'Baca 1 paragraf pertama', 'Tulis 1 kalimat ringkasan'],
  tulis: ['Buka editor kosong', 'Tulis 1 kalimat pertama', 'Tandai bagian yang belum jelas'],
  gym: ['Pakai kaos kaki dan sepatu', 'Isi botol minum', 'Berdiri dan buka pintu'],
  lari: ['Pakai sepatu lari', 'Isi botol minum', 'Keluar pintu, jalan 2 menit'],
  running: ['Pakai sepatu lari', 'Isi botol minum', 'Keluar pintu, jalan 2 menit'],
  meditasi: ['Duduk, kaki di lantai', 'Tutup mata, tarik napas 3 kali', 'Setel timer 5 menit'],
  journal: ['Buka buku atau aplikasi', 'Tulis tanggal hari ini', 'Tulis 1 kalimat bebas'],
  email: ['Buka inbox', 'Pindai subjek 20 detik', 'Buka 1 email pertama'],
  kirim: ['Buka pesan atau email baru', 'Tempel atau ketik isi utamanya', 'Periksa penerima, lalu kirim'],
  form: ['Buka link formulirnya', 'Isi nama dan email', 'Lihat 3 pertanyaan berikutnya'],
  daftar: ['Buka halaman pendaftaran', 'Isi nama dan email', 'Simpan tautan untuk lanjut nanti'],
  bayar: ['Buka aplikasi pembayarannya', 'Cari tagihan yang dimaksud', 'Periksa nominal, lalu bayar'],
  belajar: ['Siapkan buku atau layar', 'Buka bab yang dituju', 'Baca 1 halaman pertama'],
  cuci: ['Kumpulkan yang perlu dicuci', 'Siapkan sabun dan air', 'Mulai dari 1 item'],
  bersih: ['Ambil kain atau sapu', 'Pilih 1 area kecil', 'Kerjakan area itu 2 menit'],
  telepon: ['Cari nomor kontaknya', 'Tulis 1 poin yang ingin disampaikan', 'Tekan tombol panggil'],
  buat: ['Buka alat kerjanya', 'Tulis nama berkasnya', 'Kerjakan bagian paling mudah dulu'],
  siapkan: ['Kumpulkan bahan yang dibutuhkan', 'Taruh di satu tempat', 'Kerjakan 1 bagian kecil'],
};

const CATEGORY_TEMPLATES: Record<ChunkCategory, Steps> = {
  PHYSICAL: ['Pakai pakaian dan sepatu yang pas', 'Isi botol minum', 'Berdiri dan buka pintu'],
  MENTAL: ['Duduk dengan nyaman', 'Tarik napas pelan 3 kali', 'Setel timer 5 menit'],
  REFLECTIVE: ['Buka buku atau aplikasi', 'Tulis tanggal hari ini', 'Tulis 1 kalimat bebas'],
  ROUTINE: ['Siapkan yang dibutuhkan', 'Buka atau ambil alat utamanya', 'Lakukan 1 menit pertama'],
};

const DEFAULT_STEPS: Steps = ['Siapkan yang dibutuhkan', 'Buka atau ambil alat utamanya', 'Lakukan 1 menit pertama'];

export function firstThreeSteps(title: string, category?: ChunkCategory | null): string[] {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const w of words) {
    const hit = VERB_TEMPLATES[w];
    if (hit) return [...hit];
  }
  if (category) return [...CATEGORY_TEMPLATES[category]];
  return [...DEFAULT_STEPS];
}
