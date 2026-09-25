/**
 * Adapter email Resend (PRD Task 1.4, env `RESEND_*`).
 *
 * Memakai `fetch` bawaan Node 22 alih-alih menambah dependency `resend`: satu
 * endpoint REST, satu body JSON, dan tidak ada SDK yang perlu di-audit. Secret
 * dibaca malas supaya modul ini tidak melempar saat diimpor di test.
 *
 * Modul HANYA untuk server. Jangan impor dari komponen client.
 */
import { parseEnv, thirdPartyEnvSchema } from '@snapbox/shared/env';

export interface InviteEmailInput {
  readonly to: string;
  readonly ownerName: string;
  readonly companyName: string;
  readonly planName: string;
  readonly inviteUrl: string;
}

export type SendEmailResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

/**
 * Mengirim email undangan owner berisi tautan penetapan kata sandi.
 *
 * Tidak pernah melempar: kegagalan jaringan/Resend dikembalikan sebagai hasil
 * `ok: false` supaya pemanggil bisa membedakan "tenant dibuat, email gagal"
 * dari "tenant gagal dibuat". Pesan error tidak memuat API key atau body
 * respons mentah.
 */
export async function sendTenantInviteEmail(input: InviteEmailInput): Promise<SendEmailResult> {
  const env = parseEnv(thirdPartyEnvSchema, process.env);
  if (!env.success || !env.data) {
    return {
      ok: false,
      message: `Konfigurasi Resend belum lengkap: ${env.message ?? '(tidak diketahui)'}`,
    };
  }

  const { RESEND_API_KEY, RESEND_FROM_EMAIL } = env.data;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [input.to],
        subject: `Undangan SnapBox untuk ${input.companyName}`,
        text: buildText(input),
        html: buildHtml(input),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) {
      return { ok: false, message: `Resend menolak permintaan (HTTP ${response.status}).` };
    }

    return { ok: true };
  } catch {
    // Timeout, DNS, atau koneksi putus: alasan spesifik tidak membantu CEO,
    // dan pesan asli bisa memuat URL internal.
    return { ok: false, message: 'Pengiriman email undangan gagal karena gangguan koneksi.' };
  }
}

function buildText({ ownerName, companyName, planName, inviteUrl }: InviteEmailInput): string {
  return [
    `Halo ${flatten(ownerName)},`,
    '',
    `Akun SnapBox untuk ${flatten(companyName)} sudah dibuat dengan paket ${flatten(planName)}.`,
    'Tetapkan kata sandi Anda lewat tautan berikut:',
    inviteUrl,
    '',
    'Tautan ini hanya berlaku untuk Anda. Jika Anda tidak merasa meminta akun ini, abaikan email ini.',
    '',
    'SnapBox',
  ].join('\n');
}

/**
 * Meratakan nilai dari input CEO menjadi satu baris.
 *
 * HTML sudah di-escape untuk bagian `html`, tetapi bagian `text` tidak punya
 * konsep escape. Tanpa ini, nama perusahaan yang memuat newline bisa menyisipkan
 * baris menyerupai header pada klien email yang merender teks secara naif.
 */
function flatten(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]+/g, ' ').trim();
}

/**
 * HTML minimal tanpa font/gambar eksternal: email transaksional tidak boleh
 * bergantung pada aset pihak ketiga, dan template merek penuh di luar scope.
 */
function buildHtml({ ownerName, companyName, planName, inviteUrl }: InviteEmailInput): string {
  const safeInviteUrl = escapeHtml(inviteUrl);
  return [
    '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.55;color:#141414">',
    `<p>Halo ${escapeHtml(ownerName)},</p>`,
    `<p>Akun SnapBox untuk <strong>${escapeHtml(companyName)}</strong> sudah dibuat dengan paket <strong>${escapeHtml(planName)}</strong>.</p>`,
    `<p><a href="${safeInviteUrl}" style="display:inline-block;border:2px solid #141414;padding:10px 16px;background:#facc15;color:#141414;font-weight:700;text-decoration:none">Tetapkan kata sandi</a></p>`,
    `<p style="font-size:13px;color:#52525b">Jika tombol tidak bekerja, salin tautan ini ke peramban:<br /><span style="word-break:break-all">${safeInviteUrl}</span></p>`,
    '<p style="font-size:13px;color:#52525b">Abaikan email ini jika Anda tidak merasa meminta akun SnapBox.</p>',
    '<p>SnapBox</p>',
    '</div>',
  ].join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
