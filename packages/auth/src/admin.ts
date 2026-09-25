/**
 * Firebase Admin SDK SnapBox. HANYA UNTUK SERVER.
 *
 * JANGAN PERNAH mengimpor modul ini dari komponen client atau modul apa pun
 * yang ikut ter-bundle ke browser. Modul ini memegang kredensial service
 * account (`FIREBASE_ADMIN_PRIVATE_KEY`) yang bisa menandatangani token apa pun.
 *
 * Aturan barrel yang menegakkan batas ini: `packages/auth/src/index.ts` SENGAJA
 * tidak me-reekspor berkas ini. Konsumen server harus mengimpor
 * `@snapbox/auth/admin` secara eksplisit, sehingga `firebase-admin` tidak
 * pernah tertarik ke bundle browser lewat `@snapbox/auth`.
 */
import { cert, initializeApp, type App, type AppOptions } from 'firebase-admin/app';
import { getAuth, type Auth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth';

import { parseEnv, serverEnvSchema } from '@snapbox/shared/env';

import type { FirebaseClaims } from './claims';

interface FirebaseAdminGlobal {
  __snapboxFirebaseAdminApp?: App;
}

const globalForFirebaseAdmin = globalThis as unknown as FirebaseAdminGlobal;

/**
 * Mengambil aplikasi Firebase Admin bersama, membuatnya sekali bila belum ada.
 *
 * Konfigurasi dibaca dari `process.env` lewat `serverEnvSchema`. Cache disimpan
 * di `globalThis` saat bukan production karena Next.js dev me-reload modul
 * berkali-kali; tanpa cache, setiap reload akan memanggil `initializeApp` lagi.
 * `initializeApp` dengan nama yang sama bersifat idempoten di firebase-admin,
 * jadi panggilan duplikat setelah cache miss bukan kesalahan fatal.
 *
 * @returns Instance `App` Firebase Admin bernama `snapbox-admin`.
 * @throws Error bila env `FIREBASE_ADMIN_*` belum lengkap.
 */
export function getFirebaseAdmin(): App {
  const cached = globalForFirebaseAdmin.__snapboxFirebaseAdminApp;
  if (cached) {
    return cached;
  }

  const env = parseEnv(serverEnvSchema, process.env);
  if (!env.success || !env.data) {
    throw new Error(
      `Konfigurasi Firebase Admin belum lengkap. Salin .env.example ke .env.local lalu isi FIREBASE_ADMIN_*. Rincian: ${env.message ?? '(tidak diketahui)'}`,
    );
  }

  const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } =
    env.data;

  // Nilai .env tidak bisa memuat baris baru sungguhan, jadi `\n` literal
  // diubah kembali menjadi newline sebelum diserahkan ke SDK.
  const privateKey = FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');

  const options: AppOptions = {
    credential: cert({
      projectId: FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  };

  // Nama eksplisit supaya tidak bertabrakan dengan app tanpa nama atau dengan
  // SDK client yang berjalan di proses yang sama.
  const app = initializeApp(options, 'snapbox-admin');

  if (process.env.NODE_ENV !== 'production') {
    globalForFirebaseAdmin.__snapboxFirebaseAdminApp = app;
  }

  return app;
}

/** Aksesor privat: satu-satunya tempat `getAuth` dipanggil agar lazy init terpusat. */
function adminAuth(): Auth {
  return getAuth(getFirebaseAdmin());
}

/**
 * Memverifikasi ID token Firebase yang dikirim klien.
 *
 * @param idToken Token mentah dari klien; belum dipercaya sampai diverifikasi.
 * @returns Isi token yang sudah didekode.
 * @throws Error bila token tidak valid, kedaluwarsa, atau dari project lain.
 */
export async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  return adminAuth().verifyIdToken(idToken);
}

/**
 * Menanam custom claim ke akun Firebase.
 *
 * Pemanggil bertanggung jawab menghasilkan `claims` lewat `buildCustomClaims`
 * supaya pemisahan `role` (peran Postgres Supabase) dan `app_role` (peran
 * aplikasi) tidak pernah dilewati.
 *
 * @param uid Id pengguna Firebase.
 * @param claims Custom claim bentuk wire, hasil `buildCustomClaims`.
 * @returns Promise selesai saat claim tersimpan.
 * @throws Error bila uid tidak ditemukan.
 */
export async function setUserClaims(uid: string, claims: FirebaseClaims): Promise<void> {
  await adminAuth().setCustomUserClaims(uid, claims);
}

/**
 * Membuat pengguna baru tanpa password.
 *
 * Akun masuk lewat provider federasi; password tidak pernah dibuat di sini.
 *
 * @param email Alamat email pengguna baru.
 * @returns Rekaman pengguna yang baru dibuat.
 * @throws Error bila email sudah terdaftar.
 */
export async function createUserWithoutPassword(email: string): Promise<UserRecord> {
  return adminAuth().createUser({ email });
}

/**
 * Mengaktifkan atau menonaktifkan akun Firebase.
 *
 * @param uid Id pengguna Firebase.
 * @param disabled `true` untuk menonaktifkan, `false` untuk mengaktifkan kembali.
 * @returns Promise selesai saat status tersimpan.
 * @throws Error bila uid tidak ditemukan.
 */
export async function setUserDisabled(uid: string, disabled: boolean): Promise<void> {
  await adminAuth().updateUser(uid, { disabled });
}

/**
 * Mencari akun Firebase berdasarkan email.
 *
 * Dipakai provisioning tenant untuk membedakan akun yang sudah ada dari akun
 * baru, sehingga email yang sudah terdaftar tidak menghasilkan error mentah
 * Firebase di UI.
 *
 * @param email Alamat email yang dicari.
 * @returns Rekaman pengguna, atau `null` bila tidak ada.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  try {
    return await adminAuth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return null;
    throw error;
  }
}

/**
 * Menghapus akun Firebase.
 *
 * Hanya dipakai sebagai kompensasi ketika insert database gagal setelah akun
 * Firebase dibuat; akun yang sudah dipakai user tidak boleh dihapus sembarangan.
 *
 * @param uid Id pengguna Firebase.
 * @returns Promise selesai saat akun terhapus.
 */
export async function deleteUser(uid: string): Promise<void> {
  await adminAuth().deleteUser(uid);
}

/**
 * Membuat tautan reset kata sandi Firebase.
 *
 * Tautan ini dipakai sebagai undangan owner: owner menetapkan kata sandinya
 * sendiri, sehingga SnapBox tidak pernah menyimpan atau mengirim kata sandi.
 *
 * @param email Email pengguna; harus sudah terdaftar.
 * @param continueUrl Tujuan opsional setelah kata sandi ditetapkan.
 * @returns URL reset yang siap dikirim lewat email.
 * @throws Error bila email tidak terdaftar atau konfigurasi tidak valid.
 */
export async function generatePasswordResetLink(
  email: string,
  continueUrl?: string,
): Promise<string> {
  return adminAuth().generatePasswordResetLink(
    email,
    continueUrl ? { url: continueUrl } : undefined,
  );
}
