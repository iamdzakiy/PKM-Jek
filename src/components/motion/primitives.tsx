'use client';

import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useTransform, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';

export const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE } },
};

/** Children wrapped in <StaggerItem> rise in one after another on mount. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/** Fade-up once when scrolled into view. MotionConfig(reducedMotion="user") turns it into a plain fade. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/** Number that counts up the first time it is visible. */
export function CountUp({ value, className, suffix = '' }: { value: number; className?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration: 0.9, ease: EASE });
    return () => controls.stop();
  }, [inView, value, mv]);

  return (
    <motion.span ref={ref} className={cn('tabular', className)}>
      {text}
    </motion.span>
  );
}

/** Horizontal bar that grows from zero. `value` is 0..1. */
export function GrowBar({ value, className, trackClassName, delay = 0 }: { value: number; className?: string; trackClassName?: string; delay?: number }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-line/70', trackClassName)}>
      <motion.div
        className={cn('h-full rounded-full bg-brand-solid', className)}
        initial={{ width: 0 }}
        whileInView={{ width: `${v * 100}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay, ease: EASE }}
      />
    </div>
  );
}
