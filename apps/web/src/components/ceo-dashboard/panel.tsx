import * as React from 'react';

import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@snapbox/ui';

import { DATA_CONTOH } from './content';

/**
 * Primitif tampilan skeleton CEO (PRD Task 1.3).
 *
 * Semua angka/data contoh melewati `DataBadge` supaya label `Data contoh`
 * tidak bisa terlupa pada satu panel (R-17/R-38). Tidak ada komponen di sini
 * yang melakukan fetch atau mutasi.
 */

/** Label wajib untuk setiap area yang memuat angka/data contoh. */
export function DataBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="neutral"
      className={className}
      title="Nilai pada panel ini adalah data contoh, bukan telemetry produksi."
    >
      {DATA_CONTOH}
    </Badge>
  );
}

const TONES = {
  netral: 'bg-secondary-background text-foreground',
  baik: 'bg-[#16a34a] text-white',
  waspada: 'bg-[#F59E0B] text-[#141414]',
  bahaya: 'bg-[#DC2626] text-white',
  info: 'bg-main text-main-foreground',
} as const;

export type Tone = keyof typeof TONES;

/**
 * Badge status. Selalu memuat teks status, tidak pernah hanya warna, sesuai
 * PRD Bab 4 "tidak bergantung warna saja".
 */
export function StatusBadge({
  tone = 'netral',
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="neutral" className={TONES[tone]}>
      {children}
    </Badge>
  );
}

/** Pemetaan status contoh ke tone, dipakai beberapa view. */
export function toneForStatus(status: string): Tone {
  switch (status) {
    case 'Aktif':
    case 'Lunas':
    case 'Online':
    case 'Normal':
      return 'baik';
    case 'Trial':
    case 'Menunggu':
    case 'Idle':
    case 'Terjadwal':
    case 'Perhatian':
    case 'Sedang':
      return 'waspada';
    case 'Suspend':
    case 'Banned':
    case 'Gagal':
    case 'Offline':
    case 'Gangguan':
    case 'Tinggi':
      return 'bahaya';
    case 'Grace period':
    case 'Kedaluwarsa':
    case 'Maintenance':
    case 'Berakhir':
    case 'Nonaktif':
    case 'Rendah':
      return 'netral';
    default:
      return 'netral';
  }
}

export interface PageIntroProps {
  readonly title: string;
  readonly description: string;
  readonly children?: React.ReactNode;
}

/** Judul + deskripsi halaman; satu-satunya fokus teks di atas panel. */
export function PageIntro({ title, description, children }: PageIntroProps) {
  return (
    <div className="ceo-intro">
      <div className="ceo-intro-text">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children ? <div className="ceo-intro-actions">{children}</div> : null}
    </div>
  );
}

export interface PanelProps {
  readonly title: string;
  readonly description?: string;
  /** Sertakan label `Data contoh`; matikan hanya untuk panel non-data. */
  readonly example?: boolean;
  readonly action?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}

/** Panel kerja utama. Border + hard shadow dipakai selektif lewat `Card`. */
export function Panel({
  title,
  description,
  example = true,
  action,
  className,
  children,
}: PanelProps) {
  return (
    <Card className={className}>
      <CardHeader className="border-b-2 border-border pb-4 [.border-b]:pb-4">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {title}
          {example ? <DataBadge /> : null}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

/** Tren delta pada metric tile; teks selalu menyertai warna. */
export function TrendTag({
  trend,
  children,
}: {
  trend: 'naik' | 'turun' | 'datar';
  children: React.ReactNode;
}) {
  const tone: Tone = trend === 'naik' ? 'baik' : trend === 'turun' ? 'info' : 'netral';
  return <StatusBadge tone={tone}>{children}</StatusBadge>;
}
