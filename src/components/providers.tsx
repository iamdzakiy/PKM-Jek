'use client';

import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { ToastProvider } from '@/components/ui/toast';
import { usePrefs } from '@/lib/prefs';

const MOTION = { system: 'user', reduce: 'always', full: 'never' } as const;

export function Providers({ children }: { children: React.ReactNode }) {
  const [prefs] = usePrefs();
  // Kelas di <html> supaya transisi CSS ikut mati, bukan cuma Framer Motion.
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.motion;
  }, [prefs.motion]);
  return (
    <MotionConfig reducedMotion={MOTION[prefs.motion]}>
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
