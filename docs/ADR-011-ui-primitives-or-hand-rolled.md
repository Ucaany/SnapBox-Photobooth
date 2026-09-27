# ADR-011: `packages/ui` Adalah Standar; Tampilan Owner Menyimpang ke sana

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-11.
Tanggal: 2026-09-27. Dipasangkan dengan D-01 (ADR-005) dan D-15 (ADR-013).

## Konteks

`packages/ui` mengirim 64 primitive, semuanya benar-benar neobrutalist.
**15 dari 21 tampilan Owner melewati mereka**, 6 mencampur dua sistem di
satu layar, dan **41 dari 64 primitive ada hanya untuk melayani `/gallery`**.

Tidak ada yang memaksa pilihan, dan justru itu sebabnya drift terjadi.
Apakah pustaka menjadi standar dan tampilan menyimpang ke sana, atau kontrol
hand-rolled menjadi standar dan pustaka menyusut ke yang benar-benar
dipakai — keduanya bisa dipertahankan. Kondisi sekarang tidak bisa.

## Keputusan

**`packages/ui` adalah standar.** Tampilan Owner dan CEO memakai primitive;
kontrol hand-rolled yang menggandakan primitive yang sudah ada hilang.

1. Kontrol hand-rolled yang menduplikasi primitive dihapus, diganti primitive.
   Yang **tidak** berubah perilakunya adalah logika, bukan tampilannya.
2. Primitive yang **hanya** melayani `/gallery` tidak otomatis dihapus.
   D-15 (ADR-013) lebih dulu: begitu `/gallery` digate, inventaris ulang
   primitive dilakukan berdasarkan pemakaian nyata di UI produk.
3. Pustaka tidak boleh direduksi ke "yang dipakai halaman marketing" —
   dashboard adalah produknya.

## Konsekuensi

- Biaya: penyimpangan visual di 15 tampilan, Mostly mechanical.
- Manfaat: satu sumber kebenaran token, dan audit D-01 (ADR-005) berhenti
- Rule of thumb: 41 primitive itu bertumpu pada satu halaman yang kini
  sudah di-gate, jadi pertanyaan "apakah primitive ini perlu?" akhirnya punya
  jawaban yang dapat dihitung.
- D-15 (ADR-013) harus lebih dulu. Urutan: D-15 → inventaris ulang primitive →
  penyimpangan tampilan.
