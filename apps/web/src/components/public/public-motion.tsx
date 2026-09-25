'use client';

/**
 * Leaf animasi khusus hero landing publik.
 *
 * Memakai ulang primitif `@snapbox/ui` yang sudah menangani
 * `prefers-reduced-motion` di dalam (`useReducedMotion` di motion.tsx), jadi di
 * sini tidak ada logika gerak baru, tidak ada dependency baru, dan tidak ada
 * scroll listener. Pembungkus tipis ini ada supaya halaman marketing mengimpor
 * satu modul klien saja dan supaya varian default seragam.
 */

export {
  FadeIn as PublicFadeIn,
  Stagger as PublicStagger,
  StaggerItem as PublicStaggerItem,
} from '@snapbox/ui';
