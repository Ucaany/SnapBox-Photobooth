# ADR-010: Amplop Galat API Mengikuti PRD §10.13

## Status

Diterima. Menjawab `AUDIT/11_DECISIONS_REQUIRED.md` D-06.
Tanggal: 2026-09-27. PRD §10.13 **tidak** diamandemen — PRD sudah benar.

## Konteks

Tiga bentuk galat hidup berdampingan di 9 route handler, dan bentuk yang
kanonik dipakai **nol handler**:

| Bentuk                                           | Lokasi                                                          | Field                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **PRD §10.13** / `packages/shared/src/errors.ts` | didefinisikan, tidak pernah dipakai                             | `{success:false, error:{code, message, requestId, developerMessage, retryable}}` |
| Antara                                           | `api/booth/pair-session`, `api/auth/staff-pin`                  | `{ok:false, code, message}`                                                      |
| Polos                                            | `transactions/export`, `api/health`, `api/internal/telemetry/*` | `{message}`                                                                      |

## Keputusan

**Opsi A — adopsi amplop PRD.**

```json
{
  "success": false,
  "error": {
    "code": "TENANT_BLOCKED",
    "message": "Akses tenant diblokir.",
    "requestId": "...",
    "retryable": false
  }
}
```

1. Semua 9 handler dikonversi. Perubahan mekanis, satu file masing-masing.
2. `developerMessage` **tidak pernah** masuk respons. Ia tetap server-side
   untuk log. Pemisahan itu harus dijaga, bukan ditebak.
3. `retryable` dan `requestId` wajib diisi. Keduanya adalah alasan seluruh
   decision ini ada: tanpa keduanya, client tidak bisa membedakan "coba
   lagi" dari "ini tidak akan pernah berhasil".
4. `/api/health` tetap **kecuali**: ia sengaja mengembalikan `status`,
   `service`, `timestamp`, dan `checks` agar monitor bisa membacanya. Ia
   bukan jalur galat aplikasi, dan tetap HTTP 200. Perlakukan sebagai
   kontrak sendiri, bukan pengecualian yang bocor.

## Konsekuensi

- Penanganan galat bisa ditulis **sekali**, bukan tiga kali.
- `retryable` menjadi bagian kontrak, bukan field yang someday diisi.
- Nine file mechanical. Risiko rendah.
- Tidak ada amendemen PRD; ini satu-satunya keputusan di register ini
  (`AUDIT/11`) di manaPRD memang sudah benar.
