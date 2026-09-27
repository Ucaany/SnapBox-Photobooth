# ADR-009: Otorisasi Berbasis Peran Saja; Hapus 75 Permission

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-04.
Tanggal: 2026-09-27. Menggantikan tidak adanya keputusan RBAC di repo.

## Konteks

`packages/shared/src/auth.ts` mendefinisikan **75 `PERMISSIONS`**, tiga set
peran-permission, `hasPermission()`, dan `canAccessTenant()`. Pencarian
seluruh repo mengembalikan **cocok hanya di dalam `auth.ts` sendiri — nol
importer.**

Yang benar-benar ditegakkan adalah kesamaan string peran:
`requireCeo()` memeriksa `role !== 'CEO'`, `requireOwnerTenant()` memeriksa
`role !== 'OWNER'`.

`STAFF_PERMISSIONS` didokumentasikan eksplisit sebagai "staff hanya
monitoring, aksi destruktif sengaja tidak ada" — dan tidak pernah dirujuk.
**Keamanan Staff hari ini bersifat tidak sengaja:** `/staff-dashboard` tidak
ada, jadi login Staff mendarat di `/unauthorized`. Pembatasannya adalah rute
yang hilang, bukan aturan yang ditegakkan.

## Bahaya yang harus ditutup

Menambahkan `/staff-dashboard` sebelum keputusan ini memberi Staff akses
destruktif kelas Owner. Begitu rute itu ada, satu-satunya penghalang antara
sesi Staff dan `requireOwnerTenant()` adalah satu panggilan
`requireOwnerTenant()` per aksi — 41 panggilan, dipelihara manual, tanpa
satu pun tes yang memastikan gerbang itu menutup (PRD Task 7.9 `MISSING`).

## Keputusan

**Opsi B — hapus permission, andalkan peran.**

1. **75 `PERMISSIONS`, tiga set, `hasPermission()`, dan `canAccessTenant()`
   dihapus.** Kode mati dengan nol konsumen adalah liability, bukan aset.
2. **PRD §5.1 dan §5.4 diamandemen** untuk menyatakan otorisasi berbasis
   peran: CEO lintas tenant, OWNER penuh di dalam tenant-nya, STAFF
   monitoring. PRD tidak lagi mengklaim kontrol akses berbutir.
3. **`/staff-dashboard` dilarang dibangun** sampai ada keputusan RBAC baru.
   Ini batasan eksplisit, bukan hal yang dibiarkan begitu saja.
4. Jika akses berbutir dibutuhkan nanti, ia dibangun **berbasis database**
   (tabel permission + peran), bukan enum 75 konstanta. Enum hardcode butuh
   41 titik pemanggilan manual dan tidak punya jalur migrasi; tabel
   permission punya keduanya.
5. Penegakan peran yang ada **dipertahankan** apa adanya. Audit static
   (`05` BE-004, BE-030) menemukan 55 dari 55 actions dan 9 route handler
   menutup gerbang dengan benar. Ini aset, dan ADR ini tidak menyentuhnya.

## Konsekuensi

- Menghapus satu ruang kesalahan dan satu jebakan: `/staff-dashboard` tidak
  bisa dibangun dengan salah.
- PRD Task 2.18 (75 permission) dibatalkan, bukan dikerjakan.
- Opsi A (wiring) tetap tersedia dan didokumentasikan di atas untuk ditinjau
  ulang kalau roadmap memunculkan kebutuhan per-tenant yang nyata.
- Tradeoff yang jujur: batasan STAFF menjadi kasar. Kalau produk butuh
  "staff boleh melihat tapi tidak boleh menghapus", keputusan ini harus
  diulang — dan jalur yang benar adalah tabel permission, bukan enum.

## Yang tidak berubah

D-03 (ADR-006, role DB) dan D-14 (ADR-007, seeding claim) tidak terkait dan
tidak boleh digabung dengan perubahan ini.
