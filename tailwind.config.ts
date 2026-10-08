import type { Config } from 'tailwindcss';

// Every colour is an RGB triplet in globals.css so Tailwind opacity modifiers
// (bg-brand/20, border-line/60 …) keep working in both themes.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        'ink-faint': token('ink-faint'),
        line: token('line'),
        // GSIC brand: blue #3352CD, mint #5CE3B6, cream #F2F8C9, navy #0B1120
        brand: { DEFAULT: token('brand'), solid: token('brand-solid'), soft: token('brand-soft') },
        mint: { DEFAULT: token('mint'), soft: token('mint-soft') },
        cream: '#F2F8C9',
        navy: { DEFAULT: '#0B1120', 800: '#111C33', 700: '#16233F' },
        warn: { DEFAULT: token('warn'), soft: token('warn-soft') },
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
      },
      borderRadius: { card: '14px' },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -12px rgb(var(--shadow) / 0.18)',
        lift: '0 2px 4px rgb(var(--shadow) / 0.08), 0 18px 40px -16px rgb(var(--shadow) / 0.34)',
      },
    },
  },
  plugins: [],
};

export default config;
