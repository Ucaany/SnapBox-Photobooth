# @snapbox/auth

Membungkus Firebase sebagai penyedia identitas dan memiliki kontrak custom claims (ADR-003).

## Subpath impor

| Impor                  | Untuk                                                                      | Runtime            |
| :--------------------- | :------------------------------------------------------------------------- | :----------------- |
| `@snapbox/auth`        | Barrel kontrak custom claims (`buildCustomClaims`, `toCustomClaims`, dll). | Server dan browser |
| `@snapbox/auth/claims` | Hanya kontrak claims tanpa SDK apa pun.                                    | Server dan browser |
| `@snapbox/auth/admin`  | Firebase Admin SDK: verifikasi token, tanam claim, kelola akun.            | Server saja        |
| `@snapbox/auth/client` | Firebase Client SDK: login dan sesi di browser.                            | Browser saja       |

## Aturan pemisahan server/klien

- Barrel akar TIDAK mereekspor `./admin` maupun `./client`.
- `./client` melempar error bila `window` tidak ada.
- `./admin` tidak boleh diimpor dari komponen client.

Alasannya satu: `firebase-admin` membawa kredensial service account dan tidak boleh sampai ke bundle browser.

## Kredensial

Tiga variabel server: `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`.

Empat variabel client: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

Semuanya sudah ada di `.env.example`. Repo ini sengaja tidak menyimpan berkas JSON service account: kredensial admin selalu datang dari env.

Jalankan `pnpm check:firebase-project-id` untuk memastikan project id konsisten.

Langkah konsol (buat project, aktifkan provider, unduh kredensial) ada di ADR-003: `../../docs/ADR-003-firebase-auth.md`.
