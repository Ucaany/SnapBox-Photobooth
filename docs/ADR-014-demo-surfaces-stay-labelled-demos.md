# ADR-014: Permukaan Demo Tetap Demo, Dipindah dari Nav Produksi

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-05.
Tanggal: 2026-09-27.

## Konteks

Lima slot nav Owner menampilkan data yang tidak berasal dari database:

| Permukaan               | Kenyataan                                                                                        | Diberi label di UI?   |
| ----------------------- | ------------------------------------------------------------------------------------------------ | --------------------- |
| `/owner-dashboard` root | 4 skalar nyata; PRD minta revenue hari ini, peringatan kertas, grafik 7 hari, aksi cepat         | n/a — masih stub      |
| `/finance`              | `finance-analytics-demo.ts` — angka rupiah tetap, "Contoh Outlet A/B/C", seri 30 hari prosedural | **Ya**                |
| `/analytics`            | modul yang sama                                                                                  | **Ya**                |
| `/reports`              | `DAILY_ROWS` hardcode, epoch `Date.UTC(2026, 8, 26)`; CSV di browser; jadwal di `useState` lokal | **Ya**                |
| `/customers`            | stub 15 baris, tidak memanggil fungsi data apa pun                                               | Ya ("belum tersedia") |

Mock-nya **jujur** — banner pengungkapan ada, dan disiplin itu aset yang
layak dipertahankan. Masalahnya: mock menempati **4 dari 20 slot nav Owner**
dan menampilkan angka rupiah yang masuk akal untuk tenant yang tidak punya
transaksi. Screenshot `/finance` di luar banner tidak bisa dibedakan dari
yang asli.

## Ketergantungan yang belum ditulis

`finance` dan `analytics` yang nyata butuh **penulis `transactions` — dan
tidak ada**. `insert(transactions)` muncul **nol kali** di aplikasi. Jadi
"jadikan nyata" terblokir di belakang D-07.

## Keputusan

**Opsi B — pertahankan sebagai demo berlabel, pindahkan dari nav produksi.**

1. `/finance`, `/analytics`, `/reports`, `/customers` tetap ada, tetap
   berlabel. Banner pengungkapan **wajib dipertahankan**.
2. Keempatnya dipindah ke pengelompokan "Pratinjau" (atau digate query flag),
   bukan di nav utama yang setara dengan bagian yang datanya nyata.
   Navigasi harus membedakan "ini data tenant kamu" dari "ini contoh".
3. **Tidak** membangun `finance-analytics-server.ts` sekarang. Itu pekerjaan
   yang diblokir D-07, dan membangunnya sekarang berarti menulis server untuk
   tabel yang tidak pernah menerima baris.
4. Banerjee angka rupiah hardcode **tidak** dipakai sebagai basis apa pun
   nanti. Saat di-real-kan, angka dihitung dari `transactions`, bukan
   disetel ulang.

## Konsekuensi

- Menghapus risiko kredibilitas segera dengan biaya kecil.
- PRD Task 2.14/2.15 acceptance diAMD:MM dan amendemen. Fase 2 tidak boleh
  mengklaim permukaan ini "selesai" sampai ada transactio.csv.
- navigation tetap punya 16 slot data nyata, bukan 16 dari 20.
- Setelah D-07 dan penulis `transactions` ada, ADR ini diulang: real-kan
  `finance`/`analytics` primeiro, `reports` lalu.
