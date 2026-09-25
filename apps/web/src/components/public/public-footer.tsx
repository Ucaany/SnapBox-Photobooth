import Link from 'next/link';

import { PUBLIC_NAV, SITE } from '@/content/public';

import { WhatsappCta } from './whatsapp-cta';

/**
 * Footer publik.
 *
 * - Sitemap diambil dari `PUBLIC_NAV.footer` yang memetakan seluruh
 *   `PUBLIC_ROUTES`, jadi setiap tautan pasti menuju rute yang benar-benar ada.
 * - Tautan sosial dihilangkan sampai ada URL resmi.
 * - Tidak ada rute legal (kebijakan privasi/syarat) di aplikasi, jadi tidak ada
 *   tautan legal; slot ditandai `[REAL DATA]` saja.
 * - Nama entitas footer memakai nama produk nyata dari PRD, bukan badan hukum
 *   rekaan.
 */
export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="public-footer">
      <div className="public-container py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <p className="text-lg font-bold font-heading tracking-tight uppercase">{SITE.name}</p>
            <p className="max-w-md text-sm leading-relaxed">{SITE.description}</p>
          </div>

          <nav aria-label="Sitemap">
            <h2 className="text-sm font-bold font-heading tracking-widest uppercase">Sitemap</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {PUBLIC_NAV.footer.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-bold font-heading tracking-widest uppercase">Kontak</h2>
            <p className="text-sm">Konsultasi melalui kanal sales yang tersedia.</p>
            <WhatsappCta size="sm" className="w-fit" />
            <Link
              href="/kontak"
              className="inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4"
            >
              Halaman kontak
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t-2 border-dashed border-[#141414] pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs">
            &copy; {year} {SITE.name}. Seluruh hak dilindungi.
          </p>
          <p className="public-pending rounded-base px-2 py-1">
            Kebijakan Privasi dan Syarat Layanan: [REAL DATA]
          </p>
        </div>
      </div>
    </footer>
  );
}
