# ADR-016: Rute yang Direncanakan Dipindah ke Planned; Acceptance Fase Dikoreksi

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-08 dan D-09.
Tanggal: 2026-09-27. Dua keputusan, satu ADR, karena keduanya adalah
"PRD menjanjikan rute yang belum ada".

## Konteks D-08 — `/download/[token]` dan `/legal/*`

PRD §3.A dan §7.2 mencantumkan `/download/[token]`, `/legal/privacy`, dan
`/legal/terms` sebagai rute. **Tidak ada satupun yang ada.**
`robots.ts:10-12` mendokumentasikan bahwa sitemap legal sengaja dilewati
"karena belum ada" — jadi PRD diketahui tidak terpenuhi, dan robots.ts yang
mengompensasi. `robots.ts:20` memblokir path `/download/` yang juga tidak
ada.

PRD Task 8.7 juga meminta DPA dan cookie consent; keduanya tidak punya rute
maupun mekanisme.

## Keputusan D-08

PRD §3.A **diamandemen**: `/download/[token]`, `/legal/privacy`, dan
`/legal/terms` dipindah dari daftar rute saat ini ke bagian **"Direncanakan"**
dengan fase yang disebut.

- `/legal/privacy` dan `/legal/terms` **dibangun di Fase 8**, karena
  Task 8.7 (DPA, cookie consent) membutuhkannya. Kontennya
  produk/legal, bukan placeholder.
- `/download/[token]` **tetap planned** dan tidak dibangun sekarang:
  `download_tokens` tidak punya penulis maupun pembaca (PC-04), jadi tidak
  ada yang bisa mengarahkan token ke sana.
- `robots.ts` dibersihkan: blok `/download/` yang tidak perlu dihapus,
  dan catatan "karena belum ada" diganti rujukan ke ADR ini.

## Konteks D-09 — Device Console

PRD §3.C mewajibkan enam rute di bawah
`/owner-dashboard/devices/[boothId]/diagnostics/*`. Semuanya dijadwalkan di
**Fase 3**, yang datang **sesudah** Fase 2 — tapi acceptance Fase 2
mengatakan _"Owner bisa navigasi seluruh dashboard."_ Dua pernyataan itu
tidak bisa sama-sama benar. Semua enam rute absen; tidak ada folder
`devices/[boothId]` sama sekali.

## Keputusan D-09

Enam rute tetap **Fase 3**. Acceptance Fase 2 diamandemen menjadi:

> "Owner bisa navigasi seluruh bagian dashboard yang ada di Fase 2."

penjelasan: Betul, dan dengan"Fase 2" di sini berarti bagian yang benar-benar
ada. Device Console bukan bagian Fase 2, dan tidak akan pernah jadi.

## Konsekuensi

- PRD berhenti menjadi checklist yang tidak bisa dihormati. Aturan berlaku
  mulai sekarang: **tidak ada rute yang tercatat sebagai "sekarang" tanpa
  file rute.** Kalau mau masuk daftar, harus ada.
- `robots.ts` berhenti mengompensasi PRD.
- Fase 2 bisa di-sign-off dengan teks yang benar.
- Menutup PC-04, PC-05, PC-09.
