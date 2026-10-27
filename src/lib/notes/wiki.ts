/**
 * Tautan antar catatan gaya Obsidian: [[Judul]], [[Judul|teks]], [[Judul#bagian]].
 * Tidak perlu tabel tautan: backlink dicari dari isi catatan lain.
 */

const LINK = /\[\[([^[\]|#\n]{1,200})(?:[|#][^\]\n]*)?\]\]/g;

/** Judul yang ditautkan, unik (tanpa beda huruf besar), sesuai urutan muncul. */
export function extractLinks(content: string): string[] {
  const seen = new Map<string, string>();
  for (const m of content.matchAll(LINK)) {
    const title = m[1].trim();
    if (title && !seen.has(title.toLowerCase())) seen.set(title.toLowerCase(), title);
  }
  return Array.from(seen.values());
}

/** Potongan kalimat di sekitar tautan ke `title`, untuk daftar backlink. */
export function linkContext(content: string, title: string, len = 120): string {
  const flat = content.replace(/\s+/g, ' ');
  const at = flat.toLowerCase().indexOf(`[[${title.toLowerCase()}`);
  if (at < 0) return '';
  const start = Math.max(0, at - 45);
  const cut = flat.slice(start, start + len);
  return `${start > 0 ? '…' : ''}${cut}${start + len < flat.length ? '…' : ''}`;
}
