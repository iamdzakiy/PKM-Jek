'use client';

import { createContext, useContext, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from './button';
import { useToast } from './toast';
import type { ActionResult } from '@/lib/types';

const PendingContext = createContext(false);

/**
 * Wraps a server action that returns { ok, message }. Shows pending state on
 * its SubmitButton, toasts the outcome, and resets the form on success, so
 * validation problems no longer throw the user onto an error page.
 */
export function ActionForm({
  action,
  successMessage,
  reset = true,
  className,
  children,
  onDone,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  successMessage?: string;
  reset?: boolean;
  className?: string;
  children: ReactNode;
  onDone?: (result: ActionResult) => void;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const toast = useToast();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const data = new FormData(e.currentTarget);
    setPending(true);
    try {
      const result = await action(data);
      if (result.ok) {
        const message = successMessage ?? result.message;
        if (message) toast({ message, href: result.href });
        if (reset) ref.current?.reset();
      } else {
        toast({ kind: 'error', message: result.message ?? 'Terjadi kesalahan. Coba lagi.' });
      }
      onDone?.(result);
    } catch {
      toast({ kind: 'error', message: 'Koneksi bermasalah. Coba lagi.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <PendingContext.Provider value={pending}>
      <form ref={ref} onSubmit={onSubmit} className={className}>
        {children}
      </form>
    </PendingContext.Provider>
  );
}

export function SubmitButton({
  children,
  variant = 'primary',
  size = 'md',
  className,
}: {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pending = useContext(PendingContext);
  return (
    <Button type="submit" variant={variant} size={size} loading={pending} className={className}>
      {children}
    </Button>
  );
}

/** For plain `<form action={serverAction}>` forms (the ones that redirect): pending state via useFormStatus. */
export function NativeSubmit({ children, className, variant = 'primary' }: { children: ReactNode; className?: string; variant?: 'primary' | 'secondary' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} loading={pending} className={className}>
      {children}
    </Button>
  );
}
