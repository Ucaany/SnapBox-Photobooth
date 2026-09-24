'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  Badge,
  Bubble,
  BubbleContent,
  BubbleGroup,
  BubbleReactions,
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  Calendar,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  Checkbox,
  ComboboxDemo,
  DataTableDemo,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  ImageCard,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemTitle,
  Kbd,
  KbdGroup,
  Label,
  Marker,
  MarkerContent,
  MarkerIcon,
  Marquee,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageHeader,
  NativeSelect,
  NativeSelectOption,
  Progress,
  ProgressLabel,
  ProgressValue,
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireItem,
  QuestionnaireNext,
  QuestionnairePrevious,
  QuestionnaireProgress,
  QuestionnaireSubmit,
  QuestionnaireTitle,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Slider,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  toast,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@snapbox/ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { z } from 'zod';

/* ------------------------------------------------------------------------- *
 * Ikon inline.
 *
 * Diambil dari jalur SVG gaya Lucide, digambar langsung di berkas ini. Alasan
 * sama dengan theme-toggle.tsx: `lucide-react` adalah dependency `@snapbox/ui`,
 * bukan `apps/web`, jadi mengimpornya dari sini bergantung pada hoisting pnpm
 * yang tidak dijamin. Satu definisi kecil lebih murah daripada menambah
 * dependency aplikasi.
 * ------------------------------------------------------------------------- */

interface IconProps {
  className?: string | undefined;
}

function SvgIcon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'size-4'}
    >
      {children}
    </svg>
  );
}

const ArrowDownIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </SvgIcon>
);

const ArrowRightIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </SvgIcon>
);

const BellIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M10.268 21a2 2 0 0 0 3.464 0" />
    <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
  </SvgIcon>
);

const CheckIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M20 6 9 17l-5-5" />
  </SvgIcon>
);

const CopyIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </SvgIcon>
);

const DownloadIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </SvgIcon>
);

const ImageIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </SvgIcon>
);

const InfoIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </SvgIcon>
);

const MinusIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 12h14" />
  </SvgIcon>
);

const MonitorIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </SvgIcon>
);

const PlusIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 12h14M12 5v14" />
  </SvgIcon>
);

const SmartphoneIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </SvgIcon>
);

const SunIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </SvgIcon>
);

const TrashIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <path d="M10 11v6M14 11v6" />
  </SvgIcon>
);

const UploadIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </SvgIcon>
);

const WifiIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M12 20h.01" />
    <path d="M2 8.82a15 15 0 0 1 20 0" />
    <path d="M5 12.859a10 10 0 0 1 14 0" />
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />
  </SvgIcon>
);
import type { ChartConfig } from '@snapbox/ui';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------------- *
 * Kontrak bagian (dipakai component-gallery.tsx).
 * ------------------------------------------------------------------------- */

export type GalleryGroup = 'actions' | 'forms' | 'data' | 'feedback';

/**
 * Menandai blok: selalu mulai dengan label kecil (bukan heading), supaya baris
 * judul section tetap satu pesan. Satu label per section, sesuai aturan
 * EYEBROW RESTRAINT.
 */
function Block({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t-2 border-border pt-6 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-heading">{label}</h3>
        {note ? <p className="text-sm font-base text-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SectionHeader({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="text-xl font-heading md:text-2xl">
          {title}
        </h2>
        <p className="max-w-[65ch] text-sm font-base text-foreground">{description}</p>
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------------- *
 * Data contoh. Semua angka jelas placeholder untuk konteks photobooth.
 * ------------------------------------------------------------------------- */

type BoothStatus = 'PAID' | 'ERROR' | 'WARNING' | 'ONLINE' | 'SUSPENDED' | 'UNPAIRED';

/**
 * Pengganti sementara token status: referensi token `@snapbox/ui` tidak
 * menyediakan token khusus status (sukses, peringatan, gagal). Kelas
 * `bg-chart-*` dipinjam sampai token status resmi ditambahkan ke styles.css.
 * Pemetaan: PAID dan ONLINE hijau (chart-4), ERROR dan SUSPENDED merah (chart-2),
 * WARNING kuning (chart-3), UNPAIRED netral (secondary-background).
 */
const STATUS_CLASSES: Record<BoothStatus, string> = {
  PAID: 'bg-chart-4 text-main-foreground',
  ERROR: 'bg-chart-2 text-main-foreground',
  WARNING: 'bg-chart-3 text-main-foreground',
  ONLINE: 'bg-chart-4 text-main-foreground',
  SUSPENDED: 'bg-chart-2 text-main-foreground',
  UNPAIRED: 'bg-secondary-background text-foreground',
};

function StatusBadge({ status }: { status: BoothStatus }) {
  return <Badge className={STATUS_CLASSES[status]}>{status}</Badge>;
}

const BOOTH_ROWS: ReadonlyArray<{
  booth: string;
  outlet: string;
  status: BoothStatus;
  paper: string;
}> = [
  { booth: 'Booth A1', outlet: 'Grand Indonesia', status: 'PAID', paper: 'Sisa 412 lembar' },
  { booth: 'Booth A2', outlet: 'Grand Indonesia', status: 'ONLINE', paper: 'Sisa 380 lembar' },
  { booth: 'Booth B1', outlet: 'Kota Kasablanka', status: 'WARNING', paper: 'Sisa 48 lembar' },
  { booth: 'Booth B2', outlet: 'Kota Kasablanka', status: 'ERROR', paper: 'Tersangkut' },
  { booth: 'Booth C1', outlet: 'Senayan Park', status: 'SUSPENDED', paper: 'Tidak terpakai' },
  { booth: 'Booth C2', outlet: 'Senayan Park', status: 'UNPAIRED', paper: 'Belum dipasang' },
];

const SESSION_TREND = [
  { hari: 'Senin', sesi: 82 },
  { hari: 'Selasa', sesi: 96 },
  { hari: 'Rabu', sesi: 74 },
  { hari: 'Kamis', sesi: 120 },
  { hari: 'Jumat', sesi: 158 },
  { hari: 'Sabtu', sesi: 214 },
  { hari: 'Minggu', sesi: 196 },
];

const OUTLET_REVENUE = [
  { outlet: 'Grand Indonesia', pendapatan: 12400000 },
  { outlet: 'Kota Kasablanka', pendapatan: 9800000 },
  { outlet: 'Senayan Park', pendapatan: 7400000 },
];

const CHART_SESSIONS_CONFIG = {
  sesi: { label: 'Sesi foto', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const CHART_REVENUE_CONFIG = {
  pendapatan: { label: 'Pendapatan (Rupiah)', color: 'var(--chart-5)' },
} satisfies ChartConfig;

const PACKAGES: ReadonlyArray<{ id: string; name: string; price: string; quota: string }> = [
  { id: 'paket-strip', name: 'Paket Strip 2x6', price: 'Rp 25.000', quota: '3 sesi' },
  { id: 'paket-polaroid', name: 'Paket Polaroid', price: 'Rp 35.000', quota: '4 sesi' },
  {
    id: 'paket-unlimited',
    name: 'Paket Sepuasnya 30 menit',
    price: 'Rp 75.000',
    quota: 'Tanpa batas',
  },
];

const QUESTIONNAIRE_ITEMS = [
  {
    name: 'latar',
    required: true,
    choices: [{ value: 'polos' }, { value: 'warna' }, { value: 'pola' }],
  },
  {
    name: 'tema',
    choices: [{ value: 'ceria' }, { value: 'monokrom' }, { value: 'vintage' }],
  },
] as const;

/* ------------------------------------------------------------------------- *
 * Rangkaian subsection. Dipisah per kelompok agar tiap berkas tetap terbaca.
 * ------------------------------------------------------------------------- */

function ActionsSection() {
  const [favorit, setFavorit] = useState(false);
  const [mode, setMode] = useState('cetak');

  return (
    <>
      <Block
        label="Button: varian dan ukuran"
        note="Empat varian dan delapan ukuran, plus satu tombol nonaktif sebagai state disabled."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Simpan pengaturan</Button>
          <Button variant="neutral">Buka draf</Button>
          <Button variant="reverse">Mulai hitung ulang</Button>
          <Button variant="noShadow">Sinkron sekarang</Button>
          <Button disabled>Menunggu verifikasi</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button size="default">default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" aria-label="Tambah sesi">
            <PlusIcon />
          </Button>
          <Button size="icon-xs" aria-label="Kurangi kecerahan">
            <MinusIcon />
          </Button>
          <Button size="icon-sm" aria-label="Unduh rekap">
            <DownloadIcon />
          </Button>
          <Button size="icon-lg" aria-label="Kirim pemberitahuan">
            <BellIcon />
          </Button>
        </div>
      </Block>

      <Block label="ButtonGroup" note="Grup tombol dengan pemisah untuk tiga aksi berurutan.">
        <ButtonGroup>
          <Button variant="neutral">Hari ini</Button>
          <ButtonGroupSeparator />
          <Button variant="neutral">Minggu ini</Button>
          <ButtonGroupSeparator />
          <Button variant="neutral">Bulan ini</Button>
        </ButtonGroup>
      </Block>

      <Block
        label="Toggle dan ToggleGroup"
        note="Status keduanya terlihat, jadi terang bahwa toggle benar-benar mengubah state."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Toggle
            pressed={favorit}
            onPressedChange={setFavorit}
            aria-label="Tandai outlet sebagai favorit"
          >
            Tandai favorit
          </Toggle>
          <span className="rounded-base border-2 border-border bg-secondary-background px-3 py-1.5 text-sm font-base">
            Status favorit: {favorit ? 'ditandai' : 'belum ditandai'}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          <ToggleGroup
            className="max-w-full flex-wrap"
            value={[mode]}
            onValueChange={(value) => {
              const next = value[0];
              if (next) {
                setMode(next);
              }
            }}
          >
            <ToggleGroupItem value="cetak">Mode cetak</ToggleGroupItem>
            <ToggleGroupItem value="pratinjau">Mode pratinjau</ToggleGroupItem>
            <ToggleGroupItem value="hemat">Mode hemat kertas</ToggleGroupItem>
          </ToggleGroup>
          <span className="text-sm font-base">Mode terpilih: {mode}</span>
        </div>
      </Block>

      <Block
        label="Badge status"
        note="Warna status memakai kelas bg-chart-* sebagai pengganti sementara karena referensi token belum menyediakan token status khusus."
      >
        <div className="flex flex-wrap items-center gap-3">
          {(['PAID', 'ONLINE', 'WARNING', 'ERROR', 'SUSPENDED', 'UNPAIRED'] as BoothStatus[]).map(
            (status) => (
              <StatusBadge key={status} status={status} />
            ),
          )}
        </div>
      </Block>

      <Block label="Spinner" note="Tiga ukuran indikator proses.">
        <div className="flex items-center gap-4">
          <Spinner className="size-4" />
          <Spinner className="size-6" />
          <Spinner className="size-8" />
        </div>
      </Block>
    </>
  );
}

function FormsSection() {
  const [termasukCetak, setTermasukCetak] = useState(true);
  const [kirimEmail, setKirimEmail] = useState(false);
  const [kualitas, setKualitas] = useState('tinggi');
  const [sesiGratis, setSesiGratis] = useState(2);
  const [outlet, setOutlet] = useState('grand-indonesia');
  const [kertas, setKertas] = useState('2x6');
  const [otp, setOtp] = useState('');
  const [tanggal, setTanggal] = useState<Date | undefined>(undefined);
  const [pesan, setPesan] = useState('');

  const previewValues = [
    ['Checkbox termasuk cetak', termasukCetak ? 'ya' : 'tidak'],
    ['Switch kirim email', kirimEmail ? 'ya' : 'tidak'],
    ['Radio kualitas', kualitas],
    ['Slider sesi gratis', `${sesiGratis} sesi`],
    ['Select outlet', outlet],
    ['NativeSelect kertas', kertas],
    ['InputOTP', otp === '' ? 'belum diisi' : otp],
    ['Calendar', tanggal ? tanggal.toLocaleDateString('id-ID') : 'belum dipilih'],
  ] as const;

  return (
    <>
      <Block
        label="Input, Textarea, dan Label"
        note="Termasuk satu input dengan state error lewat aria-invalid dan pesan galat di bawahnya."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-nama-outlet">Nama outlet</Label>
            <Input id="gallery-nama-outlet" placeholder="Contoh: Grand Indonesia" />
            <p className="text-sm font-base text-foreground">
              Nama ini tampil di struk dan halaman rekap harian.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-kode-voucher">Kode voucher</Label>
            <Input
              id="gallery-kode-voucher"
              defaultValue="SNAP-09X"
              aria-invalid
              aria-describedby="gallery-kode-voucher-error"
            />
            <p
              id="gallery-kode-voucher-error"
              role="alert"
              className="text-sm font-base text-red-700"
            >
              Kode voucher sudah dipakai pada 12 Agustus.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-catatan-teks">Catatan operator</Label>
            <Textarea
              id="gallery-catatan-teks"
              placeholder="Tulis catatan serah terima shift"
              value={pesan}
              onChange={(event) => setPesan(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-input-disabled">Nomor seri perangkat</Label>
            <Input id="gallery-input-disabled" defaultValue="SBX-000-114" disabled />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="gallery-textarea-disabled">Ringkasan gangguan</Label>
            <Textarea
              id="gallery-textarea-disabled"
              defaultValue="Tidak ada gangguan aktif."
              disabled
            />
          </div>
        </div>
      </Block>

      <Block
        label="Checkbox, Switch, RadioGroup, Slider"
        note="Semua controlled. Nilainya ditampilkan di bawah supaya perubahan state bisa diverifikasi."
      >
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <Checkbox
              id="gallery-checkbox-cetak"
              checked={termasukCetak}
              onCheckedChange={(checked) => setTermasukCetak(checked === true)}
            />
            <Label htmlFor="gallery-checkbox-cetak">Sertakan cetak langsung</Label>
          </div>

          <div className="flex items-center gap-3">
            <Switch
              aria-label="Kirim email rekap"
              checked={kirimEmail}
              onCheckedChange={setKirimEmail}
            />
            <Label>Kirim rekap lewat email</Label>
          </div>

          <RadioGroup
            value={kualitas}
            onValueChange={(value) => {
              if (typeof value === 'string') {
                setKualitas(value);
              }
            }}
            aria-label="Kualitas cetak"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem id="gallery-rad-tinggi" value="tinggi" />
              <Label htmlFor="gallery-rad-tinggi">Kualitas tinggi</Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem id="gallery-rad-cepat" value="cepat" />
              <Label htmlFor="gallery-rad-cepat">Prioritas kecepatan</Label>
            </div>
          </RadioGroup>

          <div className="flex max-w-md flex-col gap-3">
            <Label htmlFor="gallery-slider-sesi">Sesi gratis per pembelian</Label>
            <Slider
              id="gallery-slider-sesi"
              value={[sesiGratis]}
              onValueChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;
                if (typeof next === 'number') {
                  setSesiGratis(next);
                }
              }}
              max={10}
              step={1}
              aria-label="Jumlah sesi gratis"
              aria-valuetext={`${sesiGratis} sesi`}
            />
          </div>

          <ul className="flex flex-col gap-1 text-sm font-base">
            {previewValues.map(([label, value]) => (
              <li key={label}>
                {label}: <span className="font-heading">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </Block>

      <Block label="Select dan NativeSelect" note="Keduanya controlled dengan beberapa opsi.">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-select-outlet">Outlet utama</Label>
            <Select value={outlet} onValueChange={(value) => setOutlet(value as string)}>
              <SelectTrigger id="gallery-select-outlet" aria-label="Pilih outlet utama">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grand-indonesia">Grand Indonesia</SelectItem>
                <SelectItem value="kota-kasablanka">Kota Kasablanka</SelectItem>
                <SelectItem value="senayan-park">Senayan Park</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="gallery-native-kertas">Ukuran kertas</Label>
            <NativeSelect
              id="gallery-native-kertas"
              value={kertas}
              onChange={(event) => setKertas(event.target.value)}
            >
              <NativeSelectOption value="2x6">Strip 2x6</NativeSelectOption>
              <NativeSelectOption value="4x6">Postcard 4x6</NativeSelectOption>
              <NativeSelectOption value="polaroid">Polaroid</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
      </Block>

      <Block label="InputOTP" note="Enam slot, controlled, nilainya tampil di daftar state.">
        <div className="flex flex-col gap-2">
          <Label htmlFor="gallery-otp">Kode pasangan booth</Label>
          <InputOTP
            id="gallery-otp"
            maxLength={6}
            value={otp}
            onChange={setOtp}
            aria-label="Kode pasangan booth"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
      </Block>

      <Block label="Calendar" note="Mode single dengan state tanggal terpilih.">
        <div className="flex flex-col gap-3">
          <Calendar
            mode="single"
            selected={tanggal}
            onSelect={setTanggal}
            className="max-w-full overflow-x-auto"
          />
          <p className="text-sm font-base">
            Tanggal jadwal maintenance:{' '}
            <span className="font-heading">
              {tanggal ? tanggal.toLocaleDateString('id-ID') : 'belum dipilih'}
            </span>
          </p>
        </div>
      </Block>

      <Block
        label="ComboboxDemo"
        note="Sudah lengkap dengan pencarian dan pilihan di dalam paket UI."
      >
        <ComboboxDemo />
      </Block>

      <Block
        label="Field, FieldGroup, FieldSet"
        note="Form kecil yang disusun dari primitif Field, bukan tumpukan div acak."
      >
        <FieldSet className="max-w-xl">
          <FieldLegend>Kontak penanggung jawab outlet</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="gallery-field-nama">Nama penanggung jawab</FieldLabel>
              <FieldContent>
                <Input id="gallery-field-nama" placeholder="Nama lengkap" />
                <FieldDescription>Tampil pada laporan serah terima shift.</FieldDescription>
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="gallery-field-telepon">Nomor telepon</FieldLabel>
              <Input id="gallery-field-telepon" type="tel" placeholder="08xx xxxx xxxx" />
            </Field>
            <Field data-invalid="true">
              <FieldLabel htmlFor="gallery-field-email">Email operasional</FieldLabel>
              <Input
                id="gallery-field-email"
                type="email"
                aria-invalid
                defaultValue="bukan-email"
              />
              <FieldError errors={[{ message: 'Format email belum benar.' }]} />
            </Field>
            <FieldSeparator>Batas data internal</FieldSeparator>
            <Field orientation="horizontal">
              <FieldTitle>Kirim salinan ke pemilik</FieldTitle>
              <Checkbox defaultChecked aria-label="Kirim salinan ke pemilik" />
            </Field>
          </FieldGroup>
        </FieldSet>
      </Block>

      <Block
        label="InputGroup"
        note="Input dengan addon teks, tombol aksi, dan textarea dengan tombol kirim."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <InputGroup>
            <InputGroupAddon>
              <InputGroupText>Rp</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput placeholder="25000" inputMode="numeric" aria-label="Harga per sesi" />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Salin harga"
                onClick={() => {
                  toast.add({
                    title: 'Harga disalin',
                    description: 'Nilai 25000 ada di papan klip.',
                  });
                }}
              >
                <CopyIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          <InputGroup>
            <InputGroupTextarea
              placeholder="Tulis pengumuman untuk staf"
              aria-label="Pengumuman untuk staf"
            />
            <InputGroupAddon align="block-end">
              <InputGroupButton
                size="sm"
                variant="default"
                onClick={() => {
                  toast.add({
                    title: 'Pengumuman terkirim',
                    description: 'Staf outlet sudah menerima.',
                  });
                }}
              >
                Kirim
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </Block>

      <Block
        label="Form, FormField, FormItem"
        note="Form hidup dengan react-hook-form dan validasi zod. Tombol simpan menampilkan hasil validasi."
      >
        <GalleryForm />
      </Block>

      <Block
        label="Questionnaire"
        note="Kuisioner preferensi sesi foto dengan data contoh. Setiap item punya choices sendiri."
      >
        <Questionnaire
          items={QUESTIONNAIRE_ITEMS}
          onSubmit={(event) => {
            event.preventDefault();
            toast.add({
              title: 'Preferensi tersimpan',
              description: 'Jawaban kuisioner sudah dicatat.',
            });
          }}
          className="max-w-xl"
        >
          <QuestionnaireProgress />
          <QuestionnaireItem name="latar">
            <QuestionnaireTitle>Latar foto mana yang paling sering dipilih?</QuestionnaireTitle>
            <QuestionnaireDescription>
              Pilihan ini menentukan latar mana yang dipasang di layar kiosk.
            </QuestionnaireDescription>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="polos">
                Polos
                <QuestionnaireChoiceDescription>
                  Satu warna rata, cocok untuk pas foto.
                </QuestionnaireChoiceDescription>
              </QuestionnaireChoice>
              <QuestionnaireChoice value="warna">
                Warna bergradasi
                <QuestionnaireChoiceDescription>
                  Perpindahan warna halus di belakang subjek.
                </QuestionnaireChoiceDescription>
              </QuestionnaireChoice>
              <QuestionnaireChoice value="pola">
                Pola berulang
                <QuestionnaireChoiceDescription>
                  Motif garis atau titik untuk foto grup.
                </QuestionnaireChoiceDescription>
              </QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireActions>
              <QuestionnairePrevious>Kembali</QuestionnairePrevious>
              <QuestionnaireNext>Lanjut</QuestionnaireNext>
            </QuestionnaireActions>
          </QuestionnaireItem>

          <QuestionnaireItem name="tema">
            <QuestionnaireTitle>Tema warna favorit</QuestionnaireTitle>
            <QuestionnaireChoices>
              <QuestionnaireChoice value="ceria">Ceria</QuestionnaireChoice>
              <QuestionnaireChoice value="monokrom">Monokrom</QuestionnaireChoice>
              <QuestionnaireChoice value="vintage">Vintage</QuestionnaireChoice>
            </QuestionnaireChoices>
            <QuestionnaireActions>
              <QuestionnairePrevious>Kembali</QuestionnairePrevious>
              <QuestionnaireSubmit>Simpan preferensi</QuestionnaireSubmit>
            </QuestionnaireActions>
          </QuestionnaireItem>
        </Questionnaire>
      </Block>
    </>
  );
}

const galleryFormSchema = z.object({
  paket: z.string().min(3, { message: 'Nama paket minimal 3 karakter.' }),
  catatan: z.string().min(10, { message: 'Catatan minimal 10 karakter agar berguna.' }),
});

type GalleryFormValues = z.infer<typeof galleryFormSchema>;

function GalleryForm() {
  const [saved, setSaved] = useState<GalleryFormValues | null>(null);

  const form = useForm<GalleryFormValues>({
    resolver: zodResolver(galleryFormSchema),
    defaultValues: { paket: '', catatan: '' },
    mode: 'onSubmit',
  });

  const onSubmit = (values: GalleryFormValues) => {
    setSaved(values);
    toast.add({ title: 'Form valid', description: `Paket ${values.paket} siap disimpan.` });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex max-w-xl flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="paket"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama paket</FormLabel>
              <FormControl>
                <Input placeholder="Paket Strip 2x6" {...field} />
              </FormControl>
              <FormDescription>Muncul di layar kiosk saat tamu memilih paket.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="catatan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Catatan pemasaran</FormLabel>
              <FormControl>
                <Textarea placeholder="Tulis catatan singkat untuk staf outlet" {...field} />
              </FormControl>
              <FormDescription>Minimal 10 karakter.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Simpan paket</Button>
          <Button
            type="button"
            variant="neutral"
            onClick={() => {
              form.reset();
              setSaved(null);
            }}
          >
            Kosongkan isian
          </Button>
        </div>
        {saved ? (
          <p className="text-sm font-base text-foreground">
            Isian terakhir yang lolos validasi: {saved.paket}. Catatan sepanjang{' '}
            {saved.catatan.length} karakter.
          </p>
        ) : null}
      </form>
    </Form>
  );
}

function DataSection() {
  return (
    <>
      <Block
        label="Table"
        note="Tabel status booth. Status memakai badge, dan caption menjelaskan isi tabel."
      >
        <div className="w-full min-w-0">
          <Table>
            <TableCaption>Status enam booth aktif per 23 September, data contoh.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Booth</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Kertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BOOTH_ROWS.map((row) => (
                <TableRow key={row.booth}>
                  <TableCell className="font-heading">{row.booth}</TableCell>
                  <TableCell>{row.outlet}</TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell>{row.paper}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-heading">Total</TableCell>
                <TableCell>{BOOTH_ROWS.length} booth</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Block>

      <Block
        label="DataTableDemo"
        note="Tabel interaktif dengan filter, sort, pilihan kolom, dan paginasi."
      >
        <div className="w-full min-w-0">
          <DataTableDemo />
        </div>
      </Block>

      <Block
        label="ChartContainer: tren sesi"
        note="Grafik garis area jumlah sesi foto per hari, data contoh satu minggu."
      >
        <div className="rounded-base border-2 border-border bg-secondary-background p-4">
          <ChartContainer config={CHART_SESSIONS_CONFIG} className="h-56 w-full">
            <AreaChart accessibilityLayer data={SESSION_TREND} margin={{ left: 8, right: 8 }}>
              <ChartStyle id="chart-sesi" config={CHART_SESSIONS_CONFIG} />
              <CartesianGrid vertical={false} />
              <XAxis dataKey="hari" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                dataKey="sesi"
                type="monotone"
                fill="var(--color-sesi)"
                fillOpacity={0.4}
                stroke="var(--color-sesi)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
          <ChartLegend content={<ChartLegendContent nameKey="sesi" />} />
        </div>
      </Block>

      <Block
        label="ChartContainer: pendapatan per outlet"
        note="Grafik batang pendapatan kotor per outlet, data contoh dalam Rupiah."
      >
        <div className="rounded-base border-2 border-border bg-secondary-background p-4">
          <ChartContainer config={CHART_REVENUE_CONFIG} className="h-56 w-full">
            <BarChart accessibilityLayer data={OUTLET_REVENUE} margin={{ left: 8, right: 8 }}>
              <ChartStyle id="chart-pendapatan" config={CHART_REVENUE_CONFIG} />
              <CartesianGrid vertical={false} />
              <XAxis dataKey="outlet" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} width={56} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="pendapatan" fill="var(--color-pendapatan)" radius={4} />
            </BarChart>
          </ChartContainer>
          <ChartLegend content={<ChartLegendContent nameKey="pendapatan" />} />
        </div>
      </Block>

      <Block label="Kbd dan KbdGroup" note="Panduan pintasan papan tik untuk konsol perangkat.">
        <ul className="flex flex-col gap-3 text-sm font-base">
          <li className="flex flex-wrap items-center gap-2">
            <span>Buka pencarian booth</span>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span>Mulai sesi foto</span>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>Shift</Kbd>
              <Kbd>S</Kbd>
            </KbdGroup>
          </li>
          <li className="flex flex-wrap items-center gap-2">
            <span>Kembali ke daftar outlet</span>
            <Kbd>Esc</Kbd>
          </li>
        </ul>
      </Block>

      <Block label="Item, ItemGroup" note="Daftar paket foto dengan harga dan aksi pilih.">
        <ItemGroup className="max-w-xl">
          {PACKAGES.map((paket) => (
            <Item key={paket.id} render={<div />}>
              <ItemMedia variant="icon">
                <ImageIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{paket.name}</ItemTitle>
                <ItemDescription>
                  {paket.price} per sesi, kuota {paket.quota}.
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  size="sm"
                  variant="neutral"
                  onClick={() => {
                    toast.add({
                      title: 'Paket dipilih',
                      description: `${paket.name} masuk keranjang.`,
                    });
                  }}
                >
                  Pilih paket
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </Block>

      <Block label="Marker" note="Penanda inline dengan ikon, plus satu varian pemisah.">
        <div className="flex max-w-xl flex-col gap-3">
          <Marker>
            <MarkerIcon>
              <WifiIcon />
            </MarkerIcon>
            <MarkerContent>Booth A2 tersambung ke jaringan outlet.</MarkerContent>
          </Marker>
          <Marker>
            <MarkerIcon>
              <InfoIcon />
            </MarkerIcon>
            <MarkerContent>Sisa kertas dihitung ulang setiap 15 menit.</MarkerContent>
          </Marker>
          <Marker variant="separator">
            <MarkerContent>Diperbarui 23 September 2026</MarkerContent>
          </Marker>
        </div>
      </Block>

      <Block
        label="ItemHeader dan ItemFooter"
        note="Kartu outlet dengan header, footer, dan aksi buka detail."
      >
        <div className="max-w-xl">
          <Item render={<div />}>
            <ItemHeader>
              <ItemTitle>Grand Indonesia</ItemTitle>
              <StatusBadge status="ONLINE" />
            </ItemHeader>
            <ItemContent>
              <ItemDescription>Dua booth, rata-rata 120 sesi per hari.</ItemDescription>
            </ItemContent>
            <ItemFooter>
              <ItemDescription>Terakhir disinkron 4 menit lalu.</ItemDescription>
              <Button
                size="sm"
                variant="noShadow"
                onClick={() => {
                  toast.add({
                    title: 'Detail outlet',
                    description: 'Membuka ringkasan Grand Indonesia.',
                  });
                }}
              >
                Buka detail
              </Button>
            </ItemFooter>
          </Item>
        </div>
      </Block>

      <Block
        label="Empty"
        note="Kondisi kosong yang benar-benar dipakai: belum ada sesi hari ini, dengan aksi yang berjalan."
      >
        <Empty className="max-w-xl">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SunIcon />
            </EmptyMedia>
            <EmptyTitle>Belum ada sesi hari ini</EmptyTitle>
            <EmptyDescription>
              Booth belum menerima tamu sejak pukul 00.00. Periksa koneksi perangkat bila ini di
              luar kebiasaan.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => {
                toast.add({
                  title: 'Pemeriksaan dimulai',
                  description: 'Memeriksa koneksi enam booth.',
                });
              }}
            >
              Periksa koneksi booth
            </Button>
          </EmptyContent>
        </Empty>
      </Block>

      <Block label="Skeleton" note="Kondisi memuat: baris teks dan kartu ringkasan.">
        <div className="flex max-w-xl flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="rounded-base border-2 border-border bg-background p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="mt-3 h-24 w-full" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </div>
        </div>
      </Block>
    </>
  );
}

function FeedbackSection() {
  const [progress, setProgress] = useState(40);

  return (
    <>
      <Block
        label="Alert"
        note="Varian default dan destructive, plus varian status memakai bg-chart-* sebagai pengganti sementara."
      >
        <div className="flex max-w-xl flex-col gap-3">
          <Alert>
            <InfoIcon />
            <AlertTitle>Antrean sinkronisasi normal</AlertTitle>
            <AlertDescription>Enam booth tersinkron dalam 5 menit terakhir.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <TrashIcon />
            <AlertTitle>Penyimpanan hampir penuh</AlertTitle>
            <AlertDescription>
              Sisa ruang 2 persen. Arsipkan galeri lama sebelum sesi berikutnya.
            </AlertDescription>
          </Alert>
          <Alert className="bg-chart-3 text-main-foreground">
            <InfoIcon />
            <AlertTitle>Kertas menipis</AlertTitle>
            <AlertDescription>Booth B1 hanya menyisakan 48 lembar kertas.</AlertDescription>
          </Alert>
          <Alert className="bg-chart-4 text-main-foreground">
            <CheckIcon />
            <AlertTitle>Pembayaran diterima</AlertTitle>
            <AlertDescription>
              Transaksi Rp 75.000 dari Grand Indonesia sudah tercatat.
            </AlertDescription>
          </Alert>
        </div>
      </Block>

      <Block
        label="Progress"
        note="Nilai berubah lewat tombol, dengan label dan nilai numerik yang ikut bergerak."
      >
        <div className="flex max-w-xl flex-col gap-4">
          <Progress value={progress}>
            <ProgressLabel>Unggah foto sesi</ProgressLabel>
            <ProgressValue>{() => `${progress}%`}</ProgressValue>
          </Progress>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="neutral"
              onClick={() => setProgress((current) => Math.min(100, current + 10))}
            >
              Tambah 10 persen
            </Button>
            <Button
              size="sm"
              variant="neutral"
              onClick={() => setProgress((current) => Math.max(0, current - 10))}
            >
              Kurangi 10 persen
            </Button>
            <span className="text-sm font-base">Nilai saat ini: {progress} persen</span>
          </div>
        </div>
      </Block>

      <Block
        label="Avatar"
        note="Fallback inisial, tanpa foto orang dari internet. Badge status dan grup avatar ikut ditampilkan."
      >
        <div className="flex flex-wrap items-center gap-6">
          <Avatar>
            <AvatarFallback>AR</AvatarFallback>
            <AvatarBadge aria-label="Sedang bertugas" />
          </Avatar>
          <Avatar size="lg">
            <AvatarFallback>SD</AvatarFallback>
          </Avatar>
          <AvatarGroup>
            <Avatar>
              <AvatarFallback>AR</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>SD</AvatarFallback>
            </Avatar>
            <Avatar>
              <AvatarFallback>NP</AvatarFallback>
            </Avatar>
            <AvatarGroupCount>+3</AvatarGroupCount>
          </AvatarGroup>
        </div>
      </Block>

      <Block label="Bubble, BubbleGroup" note="Gelembung percakapan dengan balasan singkat.">
        <BubbleGroup className="max-w-md">
          <Bubble align="start" variant="secondary">
            <BubbleContent>Booth B2 tersangkut, kertas tidak keluar.</BubbleContent>
          </Bubble>
          <Bubble align="end">
            <BubbleContent>Sudah dibuatkan tiket, teknisi menuju lokasi.</BubbleContent>
            <BubbleReactions aria-label="Dua staf menyetujui">
              <span>Setuju 2</span>
            </BubbleReactions>
          </Bubble>
        </BubbleGroup>
      </Block>

      <Block
        label="Message, MessageGroup"
        note="Satu utas percakapan antara operator dan sistem, dengan avatar, header, dan footer waktu."
      >
        <MessageGroup className="max-w-xl">
          <Message>
            <MessageAvatar>
              <Avatar>
                <AvatarFallback>OP</AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <MessageHeader>Operator, Rani</MessageHeader>
              <Bubble align="start" variant="muted">
                <BubbleContent>Minta rekap penjualan shift pagi.</BubbleContent>
              </Bubble>
              <MessageFooter>09.12</MessageFooter>
            </MessageContent>
          </Message>
          <Message align="end">
            <MessageAvatar>
              <Avatar>
                <AvatarFallback>SYS</AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <MessageHeader>Sistem SnapBox</MessageHeader>
              <Bubble align="end" variant="default">
                <BubbleContent>
                  Shift pagi: 86 sesi, pendapatan Rp 2.340.000. Rekap lengkap dikirim ke email.
                </BubbleContent>
              </Bubble>
              <MessageFooter>09.12</MessageFooter>
            </MessageContent>
          </Message>
        </MessageGroup>
      </Block>

      <Block
        label="Attachment"
        note="Lampiran foto hasil sesi dengan media, judul, deskripsi, dan aksi unduh atau hapus."
      >
        <div className="flex max-w-md flex-col gap-3">
          <Attachment state="done">
            <AttachmentMedia variant="icon">
              <ImageIcon />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>sesi-2026-09-23-grand-indonesia.zip</AttachmentTitle>
              <AttachmentDescription>18 foto, 24 MB</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                aria-label="Unduh lampiran sesi"
                onClick={() => {
                  toast.add({
                    title: 'Unduhan dimulai',
                    description: 'Arsip sesi sedang diunduh.',
                  });
                }}
              >
                <DownloadIcon />
              </AttachmentAction>
              <AttachmentAction
                aria-label="Hapus lampiran sesi"
                onClick={() => {
                  toast.add({
                    title: 'Lampiran dihapus',
                    description: 'Arsip dipindah ke tempat sampah.',
                  });
                }}
              >
                <TrashIcon />
              </AttachmentAction>
            </AttachmentActions>
            <AttachmentTrigger aria-label="Buka pratinjau lampiran" />
          </Attachment>

          <Attachment state="uploading" size="sm">
            <AttachmentMedia variant="icon">
              <Spinner />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>sesi-2026-09-23-kota-kasablanka.zip</AttachmentTitle>
              <AttachmentDescription>Mengunggah, 64 persen selesai</AttachmentDescription>
            </AttachmentContent>
            <AttachmentActions>
              <AttachmentAction
                aria-label="Batalkan unggahan"
                onClick={() => {
                  toast.add({
                    title: 'Unggahan dibatalkan',
                    description: 'Unggahan dihentikan oleh operator.',
                  });
                }}
              >
                <TrashIcon />
              </AttachmentAction>
            </AttachmentActions>
            <AttachmentTrigger aria-label="Buka detail unggahan" />
          </Attachment>
        </div>
      </Block>

      <Block
        label="ImageCard"
        note="Gambar placeholder dari picsum.photos (seed snapbox-booth), bukan aset produksi. Ganti dengan foto booth asli saat tersedia."
      >
        <ImageCard
          imageUrl="https://picsum.photos/seed/snapbox-booth/640/400"
          caption="Tampak depan unit booth, placeholder."
        />
      </Block>

      <Block
        label="Marquee"
        note="Marquee tunggal di halaman ini, berisi nama outlet yang berjalan dari kanan ke kiri."
      >
        <div className="w-full overflow-hidden rounded-base border-2 border-border">
          <Marquee
            items={[
              'Grand Indonesia',
              'Kota Kasablanka',
              'Senayan Park',
              'Summarecon Mall',
              'Paris Van Java',
            ]}
          />
        </div>
      </Block>

      <Block
        label="Toast"
        note="Tombol di bawah memanggil pengelola toast sehingga notifikasi benar-benar muncul di sudut layar."
      >
        <div className="flex flex-wrap gap-3">
          <Button
            variant="neutral"
            onClick={() => {
              toast.add({
                title: 'Perubahan disimpan',
                description: 'Pengaturan outlet tersimpan.',
              });
            }}
          >
            Simpan perubahan
          </Button>
          <Button
            variant="neutral"
            onClick={() => {
              toast.add({
                type: 'error',
                title: 'Gagal menyimpan',
                description: 'Koneksi ke server terputus. Coba lagi.',
              });
            }}
          >
            Picu galat simpan
          </Button>
          <Button
            variant="neutral"
            onClick={() => {
              toast.add({
                title: 'Menyinkronkan',
                description: 'Menarik data enam booth.',
                type: 'loading',
              });
            }}
          >
            Sinkronkan booth
          </Button>
        </div>
      </Block>

      <Block label="Tooltip" note="Tooltip muncul saat kursor diarahkan atau saat fokus papan tik.">
        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-3">
            <Tooltip>
              <TooltipTrigger
                render={<Button variant="neutral" size="icon" aria-label="Info kapasitas kertas" />}
              >
                <InfoIcon />
              </TooltipTrigger>
              <TooltipContent>Kapasitas kertas per gulungan: 600 lembar.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={<Button variant="neutral" size="icon" aria-label="Panduan unggah foto" />}
              >
                <UploadIcon />
              </TooltipTrigger>
              <TooltipContent>Unggah maksimal 2 GB per arsip sesi.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={<Button variant="neutral" aria-label="Bantuan jaringan kiosk" />}
              >
                <span className="flex items-center gap-2">
                  Perangkat
                  <ArrowDownIcon />
                </span>
              </TooltipTrigger>
              <TooltipContent>Perangkat akan memakai jaringan outlet terdekat.</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </Block>

      <Block
        label="Pintasan terkait"
        note="Tombol ini menggabungkan pemilih perangkat dan indikator proses dalam satu baris."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="neutral">
            <MonitorIcon />
            Konsol perangkat
            <ArrowRightIcon />
          </Button>
          <Button variant="neutral">
            <SmartphoneIcon />
            Kiosk seluler
          </Button>
          <span className="flex items-center gap-2 text-sm font-base">
            Sinkron booth
            <Spinner className="size-4" />
          </span>
          <ButtonGroup>
            <ButtonGroupText>Status</ButtonGroupText>
            <Button variant="neutral" size="sm">
              <CheckIcon />
              Tersambung
            </Button>
          </ButtonGroup>
        </div>
      </Block>
    </>
  );
}

const GROUP_TITLES: Record<GalleryGroup, { title: string; description: string }> = {
  actions: {
    title: 'Aksi',
    description:
      'Tombol, grup tombol, toggle, badge status, dan indikator proses. Setiap kontrol mengubah state atau memicu aksi nyata.',
  },
  forms: {
    title: 'Formulir',
    description:
      'Kontrol masukan dengan label, teks bantuan, dan kondisi galat. Semua controlled, dan nilai terpilih ditampilkan agar bisa diperiksa.',
  },
  data: {
    title: 'Data',
    description:
      'Tabel, grafik, dan daftar untuk memantau booth. Setiap tampilan data menyediakan kondisi kosong dan kondisi memuat.',
  },
  feedback: {
    title: 'Umpan Balik',
    description:
      'Peringatan, progres, avatar, percakapan, lampiran, dan notifikasi. Semuanya menunjukkan keadaan sistem yang sebenarnya.',
  },
};

export function PrimitivesSection({ group }: { group: GalleryGroup }) {
  const meta = GROUP_TITLES[group];

  return (
    <SectionHeader id={`gallery-${group}`} title={meta.title} description={meta.description}>
      {group === 'actions' ? <ActionsSection /> : null}
      {group === 'forms' ? <FormsSection /> : null}
      {group === 'data' ? <DataSection /> : null}
      {group === 'feedback' ? <FeedbackSection /> : null}
    </SectionHeader>
  );
}
