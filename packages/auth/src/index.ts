/**
 * Barrel `@snapbox/auth`.
 *
 * Modul ini sengaja hanya memuat kontrak yang aman untuk kedua runtime. Impor
 * `@snapbox/auth` tidak boleh menarik `firebase-admin` ke bundle browser, jadi
 * kode server mengimpor `@snapbox/auth/admin` dan kode browser mengimpor
 * `@snapbox/auth/client` secara eksplisit.
 */
export * from './claims';

// `./admin` dan `./client` sengaja TIDAK direekspor karena keduanya terikat runtime.
