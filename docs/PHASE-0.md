# Fase 0: Fondasi Arsitektur & Infrastruktur

Catatan progres per task. Tanda centang berarti deliverable sudah ada di repo dan
terverifikasi lokal.

## Task 0.1: Repo & Tooling

- [x] Monorepo pnpm workspaces + Turborepo.
- [x] `apps/web` Next.js 15 App Router + React 19.
- [x] `apps/desktop` Tauri v2 (frontend Vite + `src-tauri`).
- [x] `packages/db` skema Drizzle (31 tabel, PRD Bab 10.12).
- [x] `packages/ui` paket komponen bersama.
- [x] `packages/shared` kontrak Zod, event catalog, RBAC.
- [x] TypeScript strict dengan flag tambahan di atas `strict`.
- [x] ESLint 9 flat config, Prettier, Husky pre-commit, commitlint.

### Batas sengaja

| Ditunda                                                | Alasan                                                                                                                                                         | Dikerjakan di     |
| :----------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- |
| Komponen neobrutalism (Button, Card, Dialog, dst.)     | Berbagi file token warna dengan Tailwind; token butuh halaman nyata untuk diuji.                                                                               | Task 0.2          |
| `prettier-plugin-tailwindcss`                          | Butuh `@import "tailwindcss"` dan daftar class nyata agar urutannya bermakna.                                                                                  | Task 0.2          |
| Ikon aplikasi Tauri (isi sesungguhnya)                 | Yang ada sekarang stub kotak `#111111` supaya `tauri::generate_context!` bisa kompilasi. Bukan logo, bukan wordmark: identitas visual belum diputuskan (R-23). | Task 0.2 / Fase 4 |
| Adapter hardware, single-instance lock, secure storage | Butuh crate vendor dan pengujian di perangkat fisik.                                                                                                           | Fase 4            |
| Migrasi SQL yang di-generate                           | Perlu koneksi Supabase; skema sudah siap di `packages/db/src/schema.ts`.                                                                                       | Task 0.8          |
| `turbo.json` task `test`                               | Belum ada test runner yang dipilih di stack PRD.                                                                                                               | Fase 7            |

### Verifikasi

| Perintah                               | Hasil                               |
| :------------------------------------- | :---------------------------------- |
| `pnpm install`                         | OK, lockfile tersimpan              |
| `pnpm typecheck`                       | 5/5 paket PASS                      |
| `pnpm lint`                            | 5/5 paket PASS (`--max-warnings=0`) |
| `pnpm --filter @snapbox/web build`     | PASS, 4 rute (2 statis, 1 dinamis)  |
| `pnpm --filter @snapbox/desktop build` | PASS, Vite 33 modul                 |
| `cargo check --all-targets`            | PASS                                |
| `cargo fmt --check`                    | PASS                                |
| `cargo clippy -- -D warnings`          | PASS                                |

Guardrail ESLint diuji dengan file probe sementara: pelanggaran `node:child_process`,
`any`, dan variabel tak terpakai semuanya tertangkap. File probe sudah dihapus.
