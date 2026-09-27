# ADR-015: B2C Satu Gateway Saat Peluncuran — Midtrans

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-07.
Tanggal: 2026-09-27.

## Konteks

Tidak ada yang diputuskan. `GATEWAY_PROVIDERS` mencantumkan keempatnya
(`MIDTRANS`, `XENDIT`, `DOKU`, `PAKASIR`) sebagai tipe, dan
`payment-provider-test.ts:11-25` melakukan panggilan konektivitas **nyata**
ke host sandbox dan produksi keempatnya. Tapi **tidak ada** implementasi
`PaymentProvider`, **tidak ada** `POST /api/payment/create`, **tidak ada**
`/api/webhooks/b2c/[provider]`, dan **tidak ada** penulis ke `transactions`.
B2C di PRD adalah skema plus penyimpanan kredensial.

Satu jalur B2B sudah ada: **Pakasir**, dan webhook-nya kelas produksi.

## Keputusan yang tidak bisa ditunda

**Adapter dan webhook harus tiba bersama.** Mengirim `createPayment` tanpa Mengirim `createPayment` tanpa
`/api/webhooks/b2c/[provider]` membuka kembali lubang yang ADR-002 ditulis
untuk menutup: client bisa menandai transaksi lunas. Hari ini itu mustahil
**hanya karena** jalur pembayaran belum ada.

## Keputusan

**Satu gateway saat peluncuran: Midtrans.**

1. Midtrans adalah satu-satunya `PaymentProvider` B2C yang diimplementasikan.
2. `/api/webhooks/b2c/midtrans` dikirim **bersamaan** dengan adapternya,
   dalam perubahan yang sama.
3. Xendit, Doku, dan B2C-Pakasir tetap di `GATEWAY_PROVIDERS` sebagai tipe
   (kredensial per tenant sudah redirected), tapi **tanpa** adapter dan
   **tanpa** webhook.
4. B2B tetap Pakasir. Dua path, satu B2C dan satu B2B, tidak dicampur.
5. Penulis `transactions` adalah bagian dari scope yang sama — tanpa itu,
   B2C tidak punya apa yang dibayar.

## Alasan

Empat gateway berarti empat skema signature, empat taksonomi kegagalan, dan
empat jalur rekonsiliasi **sebelum ada pendapatan**. Midtrans adalah yang
paling sering disebut di copy PRD sendiri, jadi ini juga yang paling murah
untukiphy bunyi.

## Konsekuensi

- Membuka B-23, B-24, B-25, dan (**terakhir**) F-24 / real-`finance`
  (ADR-014).
- `payment-provider-test.ts` masih menguji keempatnya; itu uji
  konektivitas, bukan pernyataan dukungan. Dokumentasikan perbedaan itu agar
  tidak dibaca sebagai "semuanya didukung".
- Menambah gateway = menambah satu adapter + satu webhook. Bentuknya sudah
  disgusting, dan itulah gunanya.
