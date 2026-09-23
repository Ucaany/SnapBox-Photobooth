'use client';

import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'framer-motion';

import { cn } from '../lib/cn';

/**
 * Primitif micro-animation (PRD baris 241: "Framer Motion untuk stagger text,
 * marquee, page transition, countdown kiosk").
 *
 * Hanya variabel & pembungkus generik yang tinggal di sini; widget konkret
 * (marquee, countdown) dibangun di task fiturnya masing-masing agar paket ini
 * tidak menanggung beban yang belum dipakai.
 *
 * Semua varian memakai pasangan state `hidden`/`visible` supaya induk dan anak
 * bisa dirangkai tanpa menerjemahkan penamaan antar komponen.
 */

/** Muncul lembut: hanya opacity, aman untuk elemen apa pun. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** Naik 16px sambil memudar. Dipakai untuk blok teks/kartu yang masuk. */
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Induk stagger: mengatur jeda antar anak.
 *
 * `staggerChildren` menentukan selisih waktu mulai tiap anak; `delayChildren`
 * menahan anak pertama sedikit agar animasi masuk terasa disengaja. Nilainya
 * bisa dikembalikan ke `0` saat mode hemat gerak aktif.
 *
 * @param staggerDelay Jeda antar anak dalam detik. Default `0.06` (PRD: halus,
 *   tidak mengganggu pada daftar panjang).
 * @param delayChildren Tunda sebelum anak pertama mulai, detik. Default `0`.
 */
export const staggerContainer = (staggerDelay = 0.06, delayChildren = 0): Variants => ({
  hidden: {},
  visible: {
    transition: {
      staggerChildren: staggerDelay,
      delayChildren,
    },
  },
});

/** Anak stagger. Nama state harus sama dengan kunci yang di-stagger induknya. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Mengubah varian menjadi versi statis saat pengguna memilih hemat gerak.
 *
 * Logika ini diekstrak sekali agar tidak diulang di tiap komponen: kalau
 * per-render checks ditulis ulang, cepat atau lambat salah satu komponen lupa
 * dan animasi gerak bocor ke pengguna yang memintanya berhenti.
 *
 * @param variants Varian asal.
 * @param shouldReduceMotion Hasil `useReducedMotion()`; `null` diperlakukan
 *   sebagai belum diketahui dan dibiarkan beranimasi (framow-motion sendiri
 *   sudah menonaktifkan animasi saat `prefers-reduced-motion: reduce`).
 * @returns Varian dengan transisi durasi nol dan tanpa perpindahan posisi.
 */
function useAccessibleVariants(
  variants: Variants,
  shouldReduceMotion: boolean | null,
): Variants {
  return React.useMemo(() => {
    if (!shouldReduceMotion) return variants;

    const staticVariants: Variants = {};

    for (const [key, value] of Object.entries(variants)) {
      staticVariants[key] = {
        opacity: 'opacity' in value ? value.opacity : 1,
        transition: { duration: 0 },
      };
    }

    return staticVariants;
  }, [variants, shouldReduceMotion]);
}

/** Props umum pembungkus: boleh menerima className dan properti motion apa pun. */
export type MotionWrapperProps = Omit<HTMLMotionProps<'div'>, 'variants'> & {
  /** Varian yang dipakai; default mengikuti komponen. */
  variants?: Variants;
};

/**
 * Membungkus satu elemen agar memudar masuk saat mount.
 *
 * Dipakai untuk konten yang muncul sendiri tanpa perlu koordinasi dengan
 * saudaranya. Gunakan `Stagger` bila butuh urutan.
 */
export function FadeIn({
  className,
  variants = fadeIn,
  children,
  ...rest
}: MotionWrapperProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const accessible = useAccessibleVariants(variants, shouldReduceMotion);

  return (
    <motion.div
      className={cn(className)}
      variants={accessible}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Induk yang menganimasikan anak `StaggerItem` satu per satu.
 *
 * Anak diwajibkan memakai state `hidden`/`visible` yang sama (lihat
 * `staggerItem`); framer-motion menyebarkan state lewat konteks varian.
 */
export function Stagger({
  className,
  variants,
  children,
  ...rest
}: MotionWrapperProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const base = variants ?? staggerContainer();
  const accessible = useAccessibleVariants(base, shouldReduceMotion);

  return (
    <motion.div
      className={cn(className)}
      variants={accessible}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * Anak dari `Stagger`. Dibiarkan sebagai elemen biasa agar bisa dipakai pada
 * daftar (`li`, kartu, baris tabel) tanpa pembungkus tambahan yang merusak
 * struktur HTML.
 */
export function StaggerItem({
  className,
  variants = staggerItem,
  children,
  ...rest
}: MotionWrapperProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const accessible = useAccessibleVariants(variants, shouldReduceMotion);

  return (
    <motion.div className={cn(className)} variants={accessible} {...rest}>
      {children}
    </motion.div>
  );
}

/**
 * Pembungkus transisi halaman (PRD baris 241).
 *
 * Sengaja tanpa `AnimatePresence` dan tanpa state keluar: keluar butuh
 * koordinasi router, dan itu milik app, bukan paket komponen. Di sini cukup
 * masuk lembut agar tidak ada lompatan saat navigasi.
 */
export function PageTransition({ className, children, ...rest }: MotionWrapperProps): React.JSX.Element {
  const shouldReduceMotion = useReducedMotion();
  const accessible = useAccessibleVariants(slideUp, shouldReduceMotion);

  return (
    <motion.div
      className={cn(className)}
      variants={accessible}
      initial="hidden"
      animate="visible"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/**
 * ponytail: `MotionProvider` sengaja tidak dibuat.
 *
 * `useReducedMotion()` sudah bekerja per-komponen dan menangani
 * `prefers-reduced-motion` di level mesin framer-motion, jadi `MotionConfig`
 * hanya akan jadi lapisan tanpa nilai. Tambahkan provider hanya bila nanti ada
 * setelan transisi global (mis. `reducedMotion="user"` + durasi merek) yang
 * benar-benar perlu disebar ke seluruh aplikasi.
 */
