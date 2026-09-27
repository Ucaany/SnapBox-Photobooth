# ADR-008: Pairing QR Saja, Token 144-bit Dipertahankan

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-02.
Tanggal: 2026-09-27. Menggantikan bahasa pairing di `ADR-001` dan PRD §6.B.

## Konteks

> **Catatan referensi.** `ADR-001` disebut di bawah (dan di `AUDIT/11` D-02)
> sebagai sumber mandatory pairing QR + kode manual, tetapi **berkas
> `docs/ADR-001-*.md` tidak ada di repo ini**. Ketiadaan itu sudah ada
> sebelumnya dan bukan hasil pass ini. Amendment PRD §6.B di bawah
> tetap otoritatif; kalau `ADR-001` pernah dibuat, ia harus
> superseded oleh ADR ini.

`ADR-001` dan PRD §6.B sama-sama mewajibkan **QR + kode manual**, dengan
hashing server-side, rate limit, dan lockout. Implementasinya justru
menghasilkan token 24 karakter (144-bit), menyimpan **hanya** hash SHA-256,
dan mengembalikan `manualCode: null` — di-hardcode di
`api/booth/pair-session/route.ts:114`.

Akibatnya `machine-contract.ts:110` mendeklarasikan field yang tidak pernah
terisi, dan `machines-view.tsx:305` merender cabang yang **tidak pernah bisa
dieksekusi**. PRD §6.B juga menyebut `booths.pairing_code` 6 digit, yaitu
kolom mati yang tidak pernah ditulis.

## Properti yang sedang dilindungi

Ada ketegangan nyata yang harus dinyatakan, bukan diasumsikan:

- **Ketentrangan 144-bit + hash SHA-256 polos** aman terhadap brute force.
- **Kode 6 digit + hash SHA-256 polos** adalah target serangan lookup: 10^6
  ruang, dan hash tanpa salt berarti satu rainbow table menutup semuanya.

Jadi opsi "cocok dengan PRD" adalah **penurunan keamanan**, bukan penyelarasan.

## Keputusan

**Opsi A — QR saja, secara formal.**

1. Pasangan kode menjadi QR saja. Kode 6 digit di PRD §6.B **dihapus**,
   bukan diimplementasikan.
2. Entropi 144-bit dan hash SHA-256 polos **dipertahankan** apa adanya. Ini
   aset, dan tidak ada alasan untuk menurunkannya.
3. Field `manualCode` dihapus dari kontrak, dan cabang UI yang tidak pernah
   bisa dieksekusi di `machines-view.tsx` ikut dihapus.
4. PRD §6.B diamandemen: pairing adalah QR; tidak ada kode manual.
5. **Penukaran (redemption) adalah pekerjaan terpisah.** `POST /api/booth/pair`
   belum ada (BE-003) dan tidak ada penulisan ke `pairing_tokens.used`
   (BE-003). ADR ini tidak mengatur redemption; ia hanya memutuskan bentuk
   kredensialnya.

## Alasan memilih A, bukan B

Opsi B (QR + kode manual entropi tinggi) butuh: UI baru, input redemption
baru, dan penghitung lockout yang belum ada. Semuanya membangun mesin
penukaran yang belum ada, untuk priority yang belum ada (belum ada kios yang
memesan token — `devices` tidak pernah di-insert). Itu membangun Fasa 5
sambil menyodorkan Fasa 2.

## Konsekuensi

- Menghapus satu cabang mati dan satu field yang menipu.
- PRD §6.B dan `ADR-001` perlu amendemen; keduanya masih menyebut kode manual.
- Kalau nanti terbukti kios butuh jalur tanpa kamera, keputusannya diulang
  dengan Option B — dan entropi 144-bit tetap dipertahankan. Yang ditolak
  adalah kode pendek, bukan kode manual.
- `attemptCount` dan `expiresAt` di `pairing_tokens` tetap tanpa pembaca/
  penulis sampai redemption dibangun (BE-003).
