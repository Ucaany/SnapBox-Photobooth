import { FAQ, HERO, SITE } from '@/content/public';

/**
 * JSON-LD publik. Hanya field yang punya nilai nyata.
 *
 * Yang sengaja TIDAK dikirim: aggregateRating, offers/harga, address,
 * telephone, logo, review, sama sekali tidak ada URL kanonik yang belum
 * disetujui, dan tidak ada tautan sosial. Semua nilai uang atau angka
 * performa yang belum terverifikasi dihilangkan supaya tidak jadi klaim palsu.
 *
 * Serialisasi: `JSON.stringify(...).replace(/</g, '\\u003c')` menutup celah
 * breakout `</script>` kalau suatu saat konten memuat karakter `<`.
 */

function serialize(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function JsonLdScript({ data }: { readonly data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Aman karena `<` sudah di-escape di `serialize`.
      dangerouslySetInnerHTML={{ __html: serialize(data) }}
    />
  );
}

export function OrganizationJsonLd() {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: SITE.name,
        description: SITE.description,
      }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: HERO.product,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Windows, Linux',
        description: SITE.description,
      }}
    />
  );
}

export function FaqJsonLd() {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: entry.answer,
          },
        })),
      }}
    />
  );
}

/** Renders seluruh JSON-LD yang aman untuk halaman publik. */
export function PublicJsonLd() {
  return (
    <>
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <FaqJsonLd />
    </>
  );
}
