import type { Metadata } from 'next';
import Link from 'next/link';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@snapbox/ui';

import { FaqAccordion } from '@/components/public/faq-accordion';
import { PublicFadeIn, PublicStagger, PublicStaggerItem } from '@/components/public/public-motion';
import { PublicJsonLd } from '@/components/public/seo-json-ld';
import { WhatsappCta } from '@/components/public/whatsapp-cta';
import { FEATURES, HERO, PRICING, SITE, TENANTS, TESTIMONIALS } from '@/content/public';
import { buildPublicMetadata } from '@/lib/public-metadata';

/**
 * Landing publik SnapBox (`/`).
 *
 * Rute ini hidup di dalam route group `(public)` sehingga `/` me-render
 * landing di dalam `PublicHeader`/`PublicFooter`. File placeholder lama
 * `apps/web/src/app/page.tsx` dihapus karena `(public)/page.tsx` dan
 * `page.tsx` sama-sama resolve ke `/` (tanda kurung tidak menambah segmen)
 * dan menyebabkan route conflict.
 *
 * Aturan konten: seluruh copy diambil dari `@/content/public`. Tidak ada
 * deskripsi modul, harga, logo tenant, testimoni, atau angka yang dikarang.
 * Field yang belum punya data nyata dirender sebagai state `[REAL DATA]`
 * eksplisit.
 */

export const metadata: Metadata = buildPublicMetadata('/');

const PILLAR_INDEX = ['01', '02', '03', '04', '05'] as const;

function DemoFrame({ label }: { readonly label: string }) {
  return (
    <figure className="public-card public-hard-shadow flex aspect-[4/3] flex-col justify-between bg-[#FFFEF5] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] tracking-widest text-[#141414] uppercase">
          {label}
        </span>
        <span className="public-pending px-2 py-1">[REAL DATA]</span>
      </div>
      <div
        aria-hidden="true"
        className="flex flex-1 items-center justify-center border-2 border-dashed border-[#141414] bg-[#F5F0DC]"
      >
        <span className="size-10 border-2 border-[#141414] bg-[#8B5CF6]" />
      </div>
      <figcaption className="font-mono text-[10px] tracking-widest text-[#141414] uppercase">
        Preview pending
      </figcaption>
    </figure>
  );
}

function Hero() {
  return (
    <section className="public-hero" aria-labelledby="hero-heading">
      <div className="public-container grid gap-8 py-10 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-12 md:py-14 lg:py-16">
        <PublicStagger className="flex flex-col gap-5">
          <PublicStaggerItem>
            <Badge variant="neutral" className="border-[#141414] bg-[#141414] text-[#FFFEF5]">
              <span className="font-mono text-[10px] tracking-widest uppercase">
                Infrastructure + operating system
              </span>
            </Badge>
          </PublicStaggerItem>

          <PublicStaggerItem>
            <h1
              id="hero-heading"
              className="text-4xl leading-[1.05] font-heading text-[#141414] md:text-5xl lg:text-6xl"
            >
              {HERO.product}
            </h1>
          </PublicStaggerItem>

          <PublicStaggerItem>
            <p className="public-gradient-text max-w-[46ch] text-lg leading-snug font-heading md:text-xl">
              {HERO.vision}
            </p>
          </PublicStaggerItem>

          <PublicStaggerItem>
            <p className="max-w-[60ch] text-sm leading-relaxed text-[#141414] md:text-base">
              {HERO.subCopy}
            </p>
          </PublicStaggerItem>

          <PublicStaggerItem className="flex flex-wrap items-center gap-3">
            <WhatsappCta label={HERO.primaryCtaLabel} size="lg" />
            <Button
              variant="neutral"
              size="lg"
              className="border-[#141414] bg-[#FFFEF5] text-[#141414] shadow-[4px_4px_0_0_#141414]"
              render={<Link href={HERO.secondaryCtaHref} />}
            >
              {HERO.secondaryCtaLabel}
            </Button>
          </PublicStaggerItem>
        </PublicStagger>
      </div>

      <div className="public-container pb-10 md:pb-14">
        <h2 className="sr-only">Pilar nilai SnapBox</h2>
        <PublicStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {HERO.valuePillars.map((pillar, index) => (
            <PublicStaggerItem
              key={pillar.name}
              className="public-card public-hard-shadow-sm flex flex-col gap-1 p-3"
            >
              <span className="font-mono text-[10px] tracking-widest text-[#8B5CF6] uppercase">
                {PILLAR_INDEX[index] ?? ''}
              </span>
              <span className="text-sm font-heading text-[#141414]">{pillar.name}</span>
              <span className="text-xs leading-snug text-[#141414]">{pillar.description}</span>
            </PublicStaggerItem>
          ))}
        </PublicStagger>
      </div>
    </section>
  );
}

function FeatureBoard() {
  return (
    <section className="public-section" aria-labelledby="features-heading">
      <div className="public-container flex flex-col gap-10">
        <PublicFadeIn className="flex flex-col gap-3 border-b-4 border-[#141414] pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-widest text-[#8B5CF6] uppercase">
              Enam modul
            </span>
            <h2 id="features-heading" className="text-3xl font-heading text-[#141414] md:text-4xl">
              Modul operasional SnapBox
            </h2>
          </div>
          <p className="max-w-[42ch] text-sm text-[#141414]">
            Deskripsi pemasaran setiap modul sedang disiapkan. Nama modul di bawah adalah modul
            resmi dari rencana produk SnapBox.
          </p>
        </PublicFadeIn>

        <PublicFadeIn className="grid grid-cols-1 gap-px border-2 border-[#141414] bg-[#141414] md:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <article key={feature.name} className="flex flex-col gap-3 bg-[#FFFEF5] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-heading text-[#141414]">{feature.name}</h3>
                <span className="font-mono text-[10px] tracking-widest text-[#141414] uppercase">
                  {PILLAR_INDEX[index] ?? ''}
                </span>
              </div>
              <span className="public-pending px-2 py-1">{feature.description}</span>
              <div
                aria-hidden="true"
                className="mt-auto flex h-16 items-end gap-1 border-2 border-dashed border-[#141414] bg-[#F5F0DC] p-2"
              >
                <span className="h-full w-2 bg-[#FFDD00]" />
                <span className="h-2/3 w-2 bg-[#8B5CF6]" />
                <span className="h-1/3 w-2 bg-[#FF1F8F]" />
              </div>
            </article>
          ))}
        </PublicFadeIn>

        <PublicFadeIn className="flex flex-col gap-8">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="reverse"
              size="lg"
              className="border-[#141414] bg-[#FFDD00] text-[#141414]"
              render={<Link href="/fitur" />}
            >
              Lihat semua fitur
            </Button>
          </div>

          <div className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-start">
            <DemoFrame label={FEATURES.at(0)?.mockupLabel ?? 'Demo frame'} />
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-heading text-[#141414]">
                Tampilan kiosk sedang disiapkan
              </h3>
              <p className="text-sm leading-relaxed text-[#141414]">
                Blok Demo frame di samping adalah penanda placeholder. Belum ada tangkapan layar
                produk resmi, jadi tidak ada gambar yang dipresentasikan sebagai hasil nyata.
              </p>
              <span className="public-pending w-fit px-2 py-1">[REAL DATA]</span>
            </div>
          </div>
        </PublicFadeIn>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section
      className="public-section border-y-4 border-[#141414] bg-[#F5F0DC]"
      aria-labelledby="pricing-heading"
    >
      <div className="public-container flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-widest text-[#FF1F8F] uppercase">
            Paket
          </span>
          <h2 id="pricing-heading" className="text-3xl font-heading text-[#141414] md:text-4xl">
            Tiga paket untuk skala berbeda
          </h2>
          <p className="max-w-[60ch] text-sm text-[#141414]">{PRICING.note}</p>
        </div>

        <PublicStagger className="grid gap-4 md:grid-cols-3">
          {PRICING.plans.map((plan) => (
            <PublicStaggerItem key={plan.name} className="flex">
              <Card className="public-card public-hard-shadow flex w-full flex-col rounded-none border-2 border-[#141414] shadow-none">
                <CardHeader className="border-b-2 border-[#141414]">
                  <CardTitle className="text-xl font-heading text-[#141414]">{plan.name}</CardTitle>
                  <CardDescription className="font-mono text-xs tracking-widest text-[#141414] uppercase">
                    {plan.price}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3 pt-4">
                  <span className="public-pending w-fit px-2 py-1">[REAL PRICE]</span>
                  <p className="text-sm text-[#141414]">{plan.priceNote}</p>
                </CardContent>
                <CardFooter className="mt-4 border-t-2 border-dashed border-[#141414] pt-4">
                  <Button
                    type="button"
                    variant="neutral"
                    size="sm"
                    disabled
                    aria-disabled="true"
                    className="w-full border-dashed border-[#141414] bg-[#FFFEF5] text-[#141414] opacity-80"
                  >
                    {plan.ctaLabel}
                  </Button>
                </CardFooter>
              </Card>
            </PublicStaggerItem>
          ))}
        </PublicStagger>

        <PublicFadeIn className="flex flex-col gap-4 border-2 border-[#141414] bg-[#FFFEF5] p-5 md:flex-row md:items-center md:justify-between">
          <p className="max-w-[52ch] text-sm text-[#141414]">
            Checkout mandiri belum tersedia. Harga final dan detail paket dikonfirmasi lewat
            konsultasi dengan tim SnapBox.
          </p>
          <WhatsappCta label={PRICING.consultationCtaLabel} />
        </PublicFadeIn>
      </div>
    </section>
  );
}

const TENANT_SLOTS = ['01', '02', '03', '04', '05', '06'] as const;

function TenantBoard() {
  return (
    <section className="public-section" aria-labelledby="tenants-heading">
      <div className="public-container flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tenants-heading" className="text-2xl font-heading text-[#141414]">
            Tenant SnapBox
          </h2>
          <span className="public-pending px-2 py-1">{TENANTS.label}</span>
        </div>

        <div className="public-marquee border-y-2 border-[#141414] py-4">
          <ul
            className="public-marquee-track list-none p-0"
            aria-label="Slot logo tenant, menunggu logo resmi"
          >
            {TENANT_SLOTS.map((slot) => (
              <li
                key={slot}
                className="flex h-16 w-40 shrink-0 items-center justify-center border-2 border-dashed border-[#141414] bg-[#F5F0DC] font-mono text-[10px] tracking-widest text-[#141414] uppercase"
              >
                Logo slot {slot}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-[10px] tracking-widest text-[#141414] uppercase">
          Slot logo placeholder. Nama dan logo tenant belum diverifikasi.
        </p>
      </div>
    </section>
  );
}

function TestimonialsPending() {
  return (
    <section
      className="public-section border-y-4 border-[#141414] bg-[#141414]"
      aria-labelledby="testimonials-heading"
    >
      <div className="public-container flex flex-col gap-4">
        <span className="font-mono text-[10px] tracking-widest text-[#FFDD00] uppercase">
          Status
        </span>
        <h2 id="testimonials-heading" className="text-2xl font-heading text-[#FFFEF5] md:text-3xl">
          Testimoni pelanggan
        </h2>
        <p className="max-w-[60ch] text-sm leading-relaxed text-[#FFFEF5]">{TESTIMONIALS.body}</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="public-pending px-2 py-1">{TESTIMONIALS.label}</span>
          <span className="font-mono text-[10px] tracking-widest text-[#FFFEF5] uppercase">
            Tanpa kutipan dan tanpa nama fiktif
          </span>
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="public-section" aria-labelledby="faq-heading">
      <div className="public-container grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <PublicFadeIn className="flex flex-col gap-3">
          <span className="font-mono text-[10px] tracking-widest text-[#8B5CF6] uppercase">
            FAQ
          </span>
          <h2 id="faq-heading" className="text-3xl font-heading text-[#141414]">
            Pertanyaan yang sering diajukan
          </h2>
          <p className="text-sm text-[#141414]">
            Jawaban di bawah hanya memuat fakta yang sudah terkonfirmasi di dokumen produk.
          </p>
        </PublicFadeIn>
        <FaqAccordion />
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="public-section" aria-labelledby="final-cta-heading">
      <div className="public-container">
        <PublicFadeIn className="public-hard-shadow flex flex-col gap-6 border-2 border-[#141414] bg-[#FFDD00] p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex flex-col gap-2">
            <h2 id="final-cta-heading" className="text-2xl font-heading text-[#141414] md:text-3xl">
              Konsultasikan kebutuhan photobooth Anda
            </h2>
            <p className="max-w-[52ch] text-sm text-[#141414]">{SITE.description}</p>
          </div>
          <WhatsappCta label={HERO.primaryCtaLabel} size="lg" />
        </PublicFadeIn>
      </div>
    </section>
  );
}

export default function PublicHomePage() {
  return (
    <>
      <PublicJsonLd />
      <Hero />
      <FeatureBoard />
      <PricingSection />
      <TenantBoard />
      <TestimonialsPending />
      <FaqSection />
      <FinalCta />
    </>
  );
}
