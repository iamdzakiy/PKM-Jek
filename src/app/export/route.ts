import { requireUser } from '@/lib/current-user';
import { exportEverythingZip, exportNote, exportNotesZip } from '@/lib/export';
import { jakartaDay } from '@/lib/adhd/progress';

export const dynamic = 'force-dynamic';

function download(body: string | Uint8Array, name: string, type: string) {
  return new Response(typeof body === 'string' ? body : new Blob([body as BlobPart]), {
    headers: {
      'Content-Type': type,
      'Content-Disposition': `attachment; filename="${name.replace(/[^\w.() -]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  });
}

/** /export?what=notes | all, atau /export?note=<id> untuk satu catatan. */
export async function GET(request: Request) {
  const user = await requireUser();
  const url = new URL(request.url);
  const day = jakartaDay();

  const noteId = url.searchParams.get('note');
  if (noteId) {
    const note = await exportNote(user.id, noteId);
    if (!note) return new Response('Catatan tidak ditemukan', { status: 404 });
    return download(note.body, note.name, 'text/markdown; charset=utf-8');
  }
  if (url.searchParams.get('what') === 'all') {
    return download(await exportEverythingZip(user.id), `star-command-backup-${day}.zip`, 'application/zip');
  }
  return download(await exportNotesZip(user.id), `catatan-${day}.zip`, 'application/zip');
}
