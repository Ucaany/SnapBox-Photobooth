/**
 * Firebase Client SDK SnapBox. Modul ini aman untuk browser.
 *
 * Boleh diimpor dari komponen client. Sebaliknya, modul server-only tidak
 * boleh mengimpornya kalau tidak perlu, karena itu akan menyeret SDK client ke
 * bundle server tanpa guna.
 *
 * Aturan keras: berkas ini TIDAK PERNAH boleh mengimpor `firebase-admin`.
 */
import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

import { parseEnv, publicEnvSchema } from '@snapbox/shared/env';

/**
 * Membaca variabel publik lalu mengubahnya menjadi opsi SDK.
 *
 * Next.js hanya meng-inline `process.env.NEXT_PUBLIC_*` bila diakses sebagai
 * properti statis. Akses dinamis (indeks variabel atau mengoper seluruh
 * `process.env` ke parser saat runtime di browser) tidak di-inline, sehingga
 * nilainya bisa `undefined` di bundle. Karena itu ketujuh nilai dibaca lewat
 * properti statis ke objek literal, baru di-parse.
 *
 * `publicEnvSchema` juga mewajibkan `NEXT_PUBLIC_APP_URL`,
 * `NEXT_PUBLIC_SUPABASE_URL`, dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`, jadi ketiga
 * variabel itu ikut dibaca meski tidak dipakai SDK Firebase.
 *
 * @returns Opsi `FirebaseOptions` untuk provider identitas SnapBox.
 * @throws Error bila variabel publik belum lengkap.
 */
function firebaseOptions(): FirebaseOptions {
  const raw = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const env = parseEnv(publicEnvSchema, raw);
  if (!env.success || !env.data) {
    throw new Error(
      `Konfigurasi Firebase client belum lengkap. Salin .env.example ke .env.local lalu isi NEXT_PUBLIC_FIREBASE_*. Rincian: ${env.message ?? '(tidak diketahui)'}`,
    );
  }

  return {
    apiKey: env.data.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.data.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.data.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.data.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

/**
 * Mengambil aplikasi Firebase client bersama.
 *
 * Dipanggil HANYA dari browser. Singleton cukup lewat cache modul; trik
 * `globalThis` tidak dipakai di sini karena `globalThis` dipakai bersama antar
 * bundle. Konfigurasi selalu diberikan eksplisit: repo ini tidak punya
 * `firebase.json`.
 *
 * @returns Instance `FirebaseApp` untuk sisi klien.
 * @throws Error bila dipanggil di server (tanpa `window`).
 */
export function getFirebaseClient(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error(
      "Modul @snapbox/auth/client hanya untuk browser dan tidak boleh dipanggil di server. Kode server wajib memakai '@snapbox/auth/admin'.",
    );
  }

  if (getApps().length === 0) {
    return initializeApp(firebaseOptions());
  }

  return getApp();
}

/**
 * Mengambil instance Firebase Auth untuk browser.
 *
 * @returns Instance `Auth` yang terikat pada app client.
 */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseClient());
}
