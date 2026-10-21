import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-card">
      <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
        <Compass size={20} />
      </div>
      <h1 className="font-heading text-lg font-semibold text-ink">Tidak ditemukan</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Catatan ini mungkin sudah dihapus atau bukan milikmu.</p>
      <Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-brand-solid px-4 text-sm font-medium text-white hover:brightness-110">
        Ke dashboard
      </Link>
    </div>
  );
}
