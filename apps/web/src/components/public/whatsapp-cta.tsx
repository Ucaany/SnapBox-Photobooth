'use client';

import { Button } from '@snapbox/ui';
import { cn } from '@snapbox/ui/lib/cn';

/**
 * CTA WhatsApp sales SnapBox.
 *
 * Nomor dibaca dari `process.env.NEXT_PUBLIC_SALES_WHATSAPP`. Referensi literal
 * ini wajib: Next.js hanya meng-inline variabel `NEXT_PUBLIC_*` ke bundle klien
 * kalau ditulis persis seperti ini, bukan lewat akses dinamis `process.env[key]`.
 * Kunci env yang dimaksud juga tercatat di `CONTACT.whatsappEnvKey` (konten
 * terpusat) supaya tidak ada dua sumber kebenaran.
 *
 * Validasi: buang `+`, spasi, dan tanda hubung; sisanya harus 8 sampai 15 digit.
 * Nomor valid -> tautan `wa.me` dengan pesan Indonesia yang jujur (tanpa harga,
 * tanpa klaim). Nomor kosong/tidak valid -> tombol disabled berlabel
 * "Nomor sales belum tersedia", bukan tautan mati.
 */

const WA_PREFILL = 'Halo SnapBox, saya ingin konsultasi tentang platform photobooth.';

const WA_PENDING_LABEL = 'Nomor sales belum tersedia';

function normalizeWhatsapp(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[+\s-]/g, '');
  if (!/^\d{8,15}$/.test(digits)) return null;
  return digits;
}

function buildWhatsappHref(digits: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(WA_PREFILL)}`;
}

export type WhatsappCtaProps = {
  readonly label?: string;
  readonly className?: string;
  readonly size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
  readonly variant?: 'default' | 'noShadow' | 'neutral' | 'reverse';
};

export function WhatsappCta({
  label = 'Konsultasi via WhatsApp',
  className,
  size = 'default',
  variant = 'default',
}: WhatsappCtaProps) {
  const digits = normalizeWhatsapp(process.env.NEXT_PUBLIC_SALES_WHATSAPP);

  if (!digits) {
    return (
      <Button
        type="button"
        size={size}
        variant={variant}
        disabled
        aria-disabled="true"
        className={cn(
          'border-2 border-dashed border-[#141414] bg-[#F5F0DC] font-heading text-[#141414] opacity-80',
          className,
        )}
      >
        {WA_PENDING_LABEL}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant={variant}
      className={cn(
        'public-press border-2 border-[#141414] bg-[#FFDD00] font-heading text-[#141414] shadow-[4px_4px_0_0_#141414] hover:shadow-[4px_4px_0_0_#141414]',
        className,
      )}
      render={
        <a
          href={buildWhatsappHref(digits)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${label}. ${WA_PREFILL}`}
        />
      }
    >
      {label}
    </Button>
  );
}
