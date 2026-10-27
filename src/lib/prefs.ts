'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Preferensi perangkat (bukan akun): suara, gerak, batas fokus harian, dan
 * durasi mode fokus. Disimpan di localStorage dan disiarkan ke semua komponen
 * yang memakainya, jadi mengubah di Pengaturan langsung terasa di Hari Ini.
 */
export interface Prefs {
  sound: boolean;
  /** 'system' ikut pengaturan OS */
  motion: 'system' | 'reduce' | 'full';
  /** batas realistis kerja fokus per hari, jam */
  capHours: number;
  /** durasi satu blok mode fokus, menit */
  focusMin: number;
  /** jeda "Masih di sini?", menit; 0 = mati */
  checkInMin: number;
}

export const DEFAULT_PREFS: Prefs = { sound: true, motion: 'system', capHours: 5, focusMin: 25, checkInMin: 10 };

const KEY = 'sc-prefs';
const EVENT = 'sc-prefs';
let cache: Prefs | null = null;

function load(): Prefs {
  if (cache) return cache;
  let saved: Partial<Prefs> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    // Saklar suara lama dari Hari Ini.
    if (saved.sound === undefined && localStorage.getItem('sc-sound') === 'off') saved.sound = false;
  } catch {
    /* localStorage diblokir: pakai bawaan */
  }
  cache = { ...DEFAULT_PREFS, ...saved };
  return cache;
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...load(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* tetap berlaku sampai halaman ditutup */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function usePrefs(): [Prefs, (patch: Partial<Prefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, load, () => DEFAULT_PREFS);
  const update = useCallback((patch: Partial<Prefs>) => setPrefs(patch), []);
  return [prefs, update];
}
