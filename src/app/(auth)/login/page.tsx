'use client';

import { Suspense } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, MailCheck } from 'lucide-react';
import { sendMagicLink, type AuthActionState } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { BrandMark } from '@/components/pkm/brand-mark';
import { BuoyancyVisual } from '@/components/pkm/buoyancy-visual';
import { EASE } from '@/components/motion/primitives';

const initialState: AuthActionState = { status: 'idle' };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending}>
      {pending ? 'Mengirim' : 'Kirim link masuk'}
    </Button>
  );
}

function LoginForm() {
  const [state, formAction] = useFormState(sendMagicLink, initialState);
  const params = useSearchParams();
  const denied = params.get('denied');
  const linkError = params.get('error') === 'link';

  const notice = denied ? 'Akun itu tidak diizinkan mengakses aplikasi ini.' : linkError ? 'Link masuk tidak valid atau sudah kedaluwarsa. Minta yang baru.' : null;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-3 lg:hidden">
        <BrandMark size={34} />
        <span className="font-heading text-lg font-bold text-ink">Second Brain</span>
      </div>

      <h1 className="font-heading text-[28px] font-bold tracking-tight text-ink">Masuk</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">Ruang ini privat. Kami kirim link sekali pakai ke emailmu, tanpa password.</p>

      {notice && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role="alert" className="mt-5 flex items-start gap-2.5 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {notice}
        </motion.div>
      )}

      <div className="mt-6">
        <AnimatePresence mode="wait" initial={false}>
          {state.status === 'sent' ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="rounded-card border border-line bg-surface p-6 text-center shadow-card"
              role="status"
            >
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.1 }} className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-mint-soft text-mint">
                <MailCheck size={22} />
              </motion.div>
              <p className="font-heading text-base font-semibold text-ink">Cek inboxmu</p>
              <p className="mt-1.5 text-sm text-ink-soft">{state.message}</p>
            </motion.div>
          ) : (
            <motion.form key="form" action={formAction} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" autoComplete="email" placeholder="nama@email.com" required autoFocus />
              </div>
              {state.status === 'error' && (
                <p role="alert" className="flex items-start gap-2 text-sm text-danger">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  {state.message}
                </p>
              )}
              <SubmitButton />
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-ink-faint">Akses dibatasi ke satu alamat email yang terdaftar di server.</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr,1fr]">
      <section className="dot-grid relative hidden flex-col justify-between overflow-hidden bg-navy p-12 lg:flex">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-solid/20 blur-[120px]" aria-hidden="true" />
        <div className="relative flex items-center gap-3">
          <BrandMark size={36} />
          <span className="font-heading text-lg font-bold text-white">Second Brain</span>
        </div>

        <div className="relative">
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="max-w-md font-heading text-[40px] font-extrabold leading-[1.08] tracking-tight text-white">
            Tangkap semuanya.
            <br />
            <span className="text-cream">Lihat yang penting.</span>
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.6 }} className="mt-4 max-w-sm text-[15px] leading-relaxed text-slate-400">
            Catatan yang aktif mengambang ke atas. Yang jarang disentuh tenggelam dengan tenang, tidak pernah dihapus.
          </motion.p>
          <div className="mt-10">
            <BuoyancyVisual />
          </div>
        </div>

        <p className="relative text-xs text-slate-500">Memory Buoyancy · Preservation Value · Managed Forgetting</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
