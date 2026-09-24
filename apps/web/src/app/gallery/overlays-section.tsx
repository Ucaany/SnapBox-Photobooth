'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Input,
  Label,
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
  NativeSelect,
  NativeSelectOption,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  ScrollArea,
  ScrollBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  toast,
} from '@snapbox/ui';
import { useState } from 'react';

import type { ReactNode } from 'react';

/* ------------------------------------------------------------------------- *
 * Ikon inline gaya Lucide.
 *
 * `lucide-react` adalah dependency `@snapbox/ui`, bukan `apps/web`. Mengimpornya
 * dari berkas ini bergantung pada hoisting pnpm yang tidak dijamin, jadi tiap
 * ikon yang dipakai digambar ulang sebagai SVG kecil di sini.
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

const ChevronDownIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m6 9 6 6 6-6" />
  </SvgIcon>
);

const DownloadIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </SvgIcon>
);

const CalendarIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </SvgIcon>
);

const GaugeIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </SvgIcon>
);

const PauseCircleIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M10 15V9M14 15V9" />
  </SvgIcon>
);

const PlayIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M6 3l14 9-14 9V3z" />
  </SvgIcon>
);

const PrinterIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M6 9V4h12v5" />
    <rect width="16" height="8" x="4" y="9" rx="2" />
    <path d="M8 17h8v4H8z" />
  </SvgIcon>
);

const RefreshIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </SvgIcon>
);

const RotateIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </SvgIcon>
);

const SlidersIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
    <path d="M2 14h4M10 8h4M18 16h4" />
  </SvgIcon>
);

const ShieldIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
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

const UnlinkIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m18.84 12.25 1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71" />
    <path d="m5.17 11.75-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71" />
    <path d="m8 2 8 20" />
  </SvgIcon>
);

const ImageIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </SvgIcon>
);

const PaletteIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </SvgIcon>
);

/* ------------------------------------------------------------------------- *
 * Kontrak bagian, disamakan dengan primitives-section.tsx milik W5a.
 * ------------------------------------------------------------------------- */

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

/** Baris status kecil: menampilkan nilai state supaya perubahan bisa diperiksa. */
function StatusLine({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-base border-2 border-border bg-secondary-background px-3 py-1.5 text-sm font-base text-foreground">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------------- *
 * Data contoh.
 * ------------------------------------------------------------------------- */

interface LogEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const LOG_ENTRIES: readonly LogEntry[] = [
  { time: '14.02', level: 'info', message: 'Booth A1 mulai sesi foto, tamu 4 orang.' },
  { time: '14.03', level: 'info', message: 'Sesi A1 selesai, 6 foto terkirim ke antrean cetak.' },
  { time: '14.03', level: 'info', message: 'Printer A1 selesai, 2 strip keluar.' },
  { time: '14.06', level: 'warn', message: 'Kertas Booth B1 tersisa 48 lembar.' },
  { time: '14.09', level: 'error', message: 'Printer B2 tersangkut, sesi antre ditahan.' },
  { time: '14.10', level: 'info', message: 'Tiket gangguan 8841 dibuat untuk B2.' },
  { time: '14.14', level: 'info', message: 'Teknisi menuju Kota Kasablanka.' },
  { time: '14.21', level: 'warn', message: 'Sinkronisasi Booth C1 terlambat 6 menit.' },
  { time: '14.25', level: 'info', message: 'Sinkronisasi C1 pulih, antrean kosong.' },
  { time: '14.31', level: 'info', message: 'Booth A2 mulai sesi grup 6 orang.' },
  { time: '14.33', level: 'error', message: 'Unggahan sesi A2 gagal sekali, mencoba ulang.' },
  { time: '14.34', level: 'info', message: 'Unggahan sesi A2 berhasil setelah percobaan ulang.' },
  { time: '14.40', level: 'info', message: 'Stok kertas A1 diperbarui menjadi 400 lembar.' },
];

const LEVEL_CLASSES: Record<LogEntry['level'], string> = {
  info: 'bg-secondary-background text-foreground',
  warn: 'bg-chart-3 text-main-foreground',
  error: 'bg-chart-2 text-main-foreground',
};

/** Item accordion: satu single, satu multiple. */
const FAQ_SINGLE = [
  {
    value: 'pairing',
    question: 'Bagaimana cara memasangkan booth baru ke outlet?',
    answer:
      'Buka menu Perangkat di konsol, pilih Pasangkan booth, lalu masukkan enam digit kode yang tampil di layar kiosk. Kode berlaku sepuluh menit. Bila kedaluwarsa, tekan tombol perbarui kode di kiosk tanpa perlu memulai ulang.',
  },
  {
    value: 'printer-offline',
    question: 'Kenapa printer tiba-tiba terbaca offline padahal menyala?',
    answer:
      'Tiga penyebab paling sering: kabel USB longgar setelah dibersihkan, kertas habis sehingga printer menahan antrean, atau driver kehilangan port setelah kiosk tidur. Cabut dan pasang kabel, pastikan gulungan terpasang, lalu tekan Sinkronkan perangkat pada kartu booth.',
  },
  {
    value: 'print-count',
    question: 'Bagaimana kalau jumlah cetak tidak cocok dengan jumlah sesi?',
    answer:
      'Setiap sesi punya kuota cetak sendiri. Bila tamu menambah cetakan di luar kuota, sistem menagih biaya tambahan dan mencatatnya sebagai cetak ekstra pada rekap harian. Selisih yang tidak wajar bisa ditandai ke laporan insiden lewat tombol Laporkan pada baris transaksi.',
  },
] as const;

const FAQ_MULTIPLE = [
  {
    value: 'paper',
    question: 'Apakah saya bisa mengisi ulang kertas saat ada tamu mengantre?',
    answer:
      'Bisa. Antrean ditahan otomatis selama penutup printer terbuka, lalu lanjut setelah sensor menandai kertas terpasang. Tamu di depan melihat pesan menunggu, bukan galat.',
  },
  {
    value: 'lighting',
    question: 'Lampu studio meredup, apakah aman dilanjutkan?',
    answer:
      'Turunkan kecepatan rana lewat Pengaturan cepat bila lampu meredup. Bila kecerahan turun di bawah ambang, sistem menandai sesi sebagai perlu tinjauan supaya foto tidak diserahkan dalam kondisi gelap.',
  },
  {
    value: 'offline-queue',
    question: 'Apa yang terjadi pada foto saat internet outlet mati?',
    answer:
      'Foto disimpan lokal lebih dulu dan masuk antrean unggah. Begitu koneksi kembali, antrean dikirim berurutan. Sesi tetap bisa dicetak selama perangkat dan printer menyala.',
  },
] as const;

/* ------------------------------------------------------------------------- *
 * Bagian OVERLAYS.
 * ------------------------------------------------------------------------- */

function DialogSection() {
  const [deleted, setDeleted] = useState(false);

  return (
    <Block
      label="Dialog: konfirmasi hapus paket"
      note="Dialog dipakai untuk alur yang butuh keputusan tapi masih bisa dibatalkan tanpa risiko data. Di sini tombol hapus menandai paket sebagai terhapus lalu menutup dialog, tanpa menyentuh kartu paket di atasnya."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-base border-2 border-border bg-secondary-background p-4">
          <p className="text-base font-heading">Paket Polaroid</p>
          <p className="text-sm font-base text-foreground">
            Rp 35.000 per sesi, kuota 4 sesi. Dipakai di Grand Indonesia dan Senayan Park.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger render={<Button variant="reverse" disabled={deleted} />}>
              <TrashIcon />
              Hapus paket
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hapus paket Polaroid?</DialogTitle>
                <DialogDescription>
                  Paket ini dipakai dua outlet aktif. Menghapusnya menghentikan pilihan paket di
                  kiosk, dan tamu yang sedang mengantre akan dialihkan ke paket strip. Tindakan ini
                  tidak bisa dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="neutral" />}>Batal</DialogClose>
                <DialogClose
                  render={<Button variant="reverse" />}
                  onClick={() => {
                    setDeleted(true);
                    toast.add({
                      title: 'Paket dihapus',
                      description: 'Paket Polaroid tidak lagi tampil di kiosk.',
                      type: 'success',
                    });
                  }}
                >
                  Hapus paket
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {deleted ? (
            <StatusLine>Paket Polaroid sudah dihapus pada sesi galeri ini.</StatusLine>
          ) : (
            <StatusLine>Paket masih aktif. Tekan hapus untuk mencoba alurnya.</StatusLine>
          )}
        </div>
      </div>
    </Block>
  );
}

function AlertDialogSection() {
  const [revoked, setRevoked] = useState(false);

  return (
    <Block
      label="AlertDialog: cabut akses perangkat"
      note="Pakai AlertDialog, bukan Dialog, saat keputusan destruktif dan tidak punya jalur batal di dalam alur: tidak ada tombol tutup di sudut, fokus mendarat di tombol batal, dan klik luar tidak menutup panel."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-base border-2 border-border bg-secondary-background p-4">
          <p className="text-base font-heading">Kiosk Seluler 02</p>
          <p className="text-sm font-base text-foreground">
            Terakhir aktif 14.38 dari Kota Kasablanka, perangkat Android 13.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="reverse" disabled={revoked} />}>
              <UnlinkIcon />
              Cabut akses
            </AlertDialogTrigger>
            <AlertDialogPortal>
              <AlertDialogOverlay />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <ShieldIcon />
                  </AlertDialogMedia>
                  <AlertDialogTitle>Cabut akses Kiosk Seluler 02?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Perangkat akan keluar dari outlet dan tidak bisa membuka antrean sesi sampai
                    dipasangkan ulang oleh operator. Foto lokal yang belum terunggah tetap tersimpan
                    di perangkat.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Biarkan tetap aktif</AlertDialogCancel>
                  <AlertDialogAction
                    variant="reverse"
                    onClick={() => {
                      setRevoked(true);
                      toast.add({
                        title: 'Akses dicabut',
                        description: 'Kiosk Seluler 02 keluar dari outlet.',
                        type: 'error',
                      });
                    }}
                  >
                    Cabut akses
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogPortal>
          </AlertDialog>

          {revoked ? (
            <StatusLine>Akses perangkat dicabut. Pemasangan ulang lewat menu Perangkat.</StatusLine>
          ) : (
            <StatusLine>Perangkat masih terpasang di outlet.</StatusLine>
          )}
        </div>
      </div>
    </Block>
  );
}

function SheetSection() {
  const [rentang, setRentang] = useState('7-hari');
  const [outlet, setOutlet] = useState('grand-indonesia');
  const [hanyaMasalah, setHanyaMasalah] = useState(false);
  const [diterapkan, setDiterapkan] = useState<{
    rentang: string;
    outlet: string;
    masalah: boolean;
  } | null>(null);

  const ringkas = `Rentang ${rentang}, outlet ${outlet}, hanya masalah: ${hanyaMasalah ? 'ya' : 'tidak'}`;

  return (
    <Block
      label="Sheet: filter transaksi"
      note="Panel samping untuk filter yang punya beberapa kontrol. Isi panel controlled, dan tombol Terapkan menuliskan hasilnya supaya filter terasa nyata."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Sheet>
            <SheetTrigger render={<Button variant="neutral" />}>
              <SlidersIcon />
              Buka filter transaksi
            </SheetTrigger>
            <SheetPortal>
              <SheetOverlay />
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter transaksi</SheetTitle>
                  <SheetDescription>
                    Batasi daftar transaksi sebelum diunduh ke rekap harian.
                  </SheetDescription>
                </SheetHeader>

                <div className="flex flex-col gap-5 px-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gallery-sheet-rentang">Rentang waktu</Label>
                    <NativeSelect
                      id="gallery-sheet-rentang"
                      value={rentang}
                      onChange={(event) => setRentang(event.target.value)}
                    >
                      <NativeSelectOption value="hari-ini">Hari ini</NativeSelectOption>
                      <NativeSelectOption value="7-hari">7 hari terakhir</NativeSelectOption>
                      <NativeSelectOption value="30-hari">30 hari terakhir</NativeSelectOption>
                    </NativeSelect>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gallery-sheet-outlet">Outlet</Label>
                    <Select value={outlet} onValueChange={(value) => setOutlet(value as string)}>
                      <SelectTrigger id="gallery-sheet-outlet" aria-label="Pilih outlet transaksi">
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
                    <Label htmlFor="gallery-sheet-minimal">Nilai transaksi minimal</Label>
                    <Input
                      id="gallery-sheet-minimal"
                      inputMode="numeric"
                      placeholder="25000"
                      defaultValue="25000"
                    />
                    <p className="text-sm font-base text-foreground">
                      Transaksi di bawah nilai ini disembunyikan dari daftar.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="gallery-sheet-masalah"
                      checked={hanyaMasalah}
                      onCheckedChange={(checked) => setHanyaMasalah(checked === true)}
                    />
                    <Label htmlFor="gallery-sheet-masalah">Hanya transaksi bermasalah</Label>
                  </div>
                </div>

                <SheetFooter>
                  <StatusLine>
                    Rentang {rentang}, outlet {outlet}, hanya masalah:{' '}
                    {hanyaMasalah ? 'ya' : 'tidak'}
                  </StatusLine>
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <SheetClose render={<Button variant="neutral" />}>Tutup</SheetClose>
                    <SheetClose
                      render={<Button />}
                      onClick={() => {
                        setDiterapkan({ rentang, outlet, masalah: hanyaMasalah });
                        toast.add({
                          title: 'Filter diterapkan',
                          description: ringkas,
                        });
                      }}
                    >
                      Terapkan filter
                    </SheetClose>
                  </div>
                </SheetFooter>
              </SheetContent>
            </SheetPortal>
          </Sheet>
        </div>

        {diterapkan ? (
          <StatusLine>
            Filter aktif: rentang {diterapkan.rentang}, outlet {diterapkan.outlet}, hanya masalah:{' '}
            {diterapkan.masalah ? 'ya' : 'tidak'}
          </StatusLine>
        ) : (
          <StatusLine>
            Belum ada filter yang diterapkan. Daftar transaksi masih memakai setelan default.
          </StatusLine>
        )}
      </div>
    </Block>
  );
}

function DrawerSection() {
  const [aksiTerakhir, setAksiTerakhir] = useState<string | null>(null);

  return (
    <Block
      label="Drawer: aksi cepat booth"
      note="Drawer naik dari bawah dan menyediakan pegangan geser untuk menutup di ponsel. Gunakan untuk aksi cepat saat operator berdiri di depan booth."
    >
      <div className="flex flex-col gap-4">
        <Drawer swipeDirection="down">
          <DrawerTrigger render={<Button variant="neutral" />}>
            <GaugeIcon />
            Aksi cepat booth
          </DrawerTrigger>
          <DrawerPortal>
            <DrawerOverlay />
            <DrawerContent>
              <DrawerSwipeHandle />
              <DrawerHeader>
                <DrawerTitle>Booth A1, Grand Indonesia</DrawerTitle>
                <DrawerDescription>
                  Status online, sisa kertas 412 lembar, antrean cetak kosong.
                </DrawerDescription>
              </DrawerHeader>

              <div className="flex flex-col gap-3 p-4">
                <Button
                  variant="neutral"
                  onClick={() => {
                    setAksiTerakhir('Sesi dicoba mulai di Booth A1');
                    toast.add({
                      title: 'Sesi percobaan dimulai',
                      description: 'Booth A1 masuk mode tamu.',
                    });
                  }}
                >
                  <PlayIcon />
                  Mulai sesi percobaan
                </Button>
                <Button
                  variant="neutral"
                  onClick={() => {
                    setAksiTerakhir('Kertas Booth A1 ditandai sudah diisi ulang');
                    toast.add({
                      title: 'Kertas diisi ulang',
                      description: 'Sisa kertas Booth A1 direset ke 600 lembar.',
                    });
                  }}
                >
                  <RefreshIcon />
                  Tandai kertas sudah diisi
                </Button>
                <Button
                  variant="reverse"
                  onClick={() => {
                    setAksiTerakhir('Printer Booth A1 dijeda sementara');
                    toast.add({
                      title: 'Printer dijeda',
                      type: 'error',
                      description: 'Antrean ditahan sampai dilanjutkan.',
                    });
                  }}
                >
                  <PauseCircleIcon />
                  Jeda printer
                </Button>
              </div>

              <DrawerFooter>
                <DrawerClose render={<Button variant="noShadow" />}>Tutup panel</DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </DrawerPortal>
        </Drawer>

        {aksiTerakhir ? (
          <StatusLine>Aksi terakhir: {aksiTerakhir}.</StatusLine>
        ) : (
          <StatusLine>Belum ada aksi cepat yang dijalankan.</StatusLine>
        )}
      </div>
    </Block>
  );
}

function PopoverSection() {
  const [cerah, setCerah] = useState([70]);
  const [orientasi, setOrientasi] = useState('potret');
  const [suara, setSuara] = useState(true);

  return (
    <Block
      label="Popover: pengaturan cepat kiosk"
      note="Popover menampung kontrol yang jarang dipakai tapi sering diubah saat menyiapkan sesi. Semua nilai controlled dan ditampilkan di luar panel."
    >
      <div className="flex flex-col gap-4">
        <Popover>
          <PopoverTrigger render={<Button variant="neutral" />}>
            <PaletteIcon />
            Pengaturan kiosk
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Pengaturan cepat</PopoverTitle>
              <PopoverDescription>
                Berlaku untuk sesi berikutnya di booth ini saja.
              </PopoverDescription>
            </PopoverHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="gallery-popover-orientasi">Orientasi foto</Label>
              <NativeSelect
                id="gallery-popover-orientasi"
                value={orientasi}
                onChange={(event) => setOrientasi(event.target.value)}
              >
                <NativeSelectOption value="potret">Potret 2x6</NativeSelectOption>
                <NativeSelectOption value="lanskap">Lanskap 4x6</NativeSelectOption>
                <NativeSelectOption value="persegi">Persegi 1x1</NativeSelectOption>
              </NativeSelect>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="gallery-popover-cerah">Kecerahan lampu ring</Label>
              <input
                id="gallery-popover-cerah"
                type="range"
                min={0}
                max={100}
                value={cerah[0]}
                onChange={(event) => setCerah([Number(event.target.value)])}
                className="w-full accent-main"
              />
              <p className="text-sm font-base text-foreground">Nilai {cerah[0]} persen.</p>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="gallery-popover-suara"
                checked={suara}
                onCheckedChange={(checked) => setSuara(checked === true)}
              />
              <Label htmlFor="gallery-popover-suara">Bunyi hitung mundur</Label>
            </div>
          </PopoverContent>
        </Popover>

        <StatusLine>
          Orientasi {orientasi}, kecerahan {cerah[0]} persen, bunyi hitung mundur{' '}
          {suara ? 'aktif' : 'senyap'}.
        </StatusLine>
      </div>
    </Block>
  );
}

function DropdownMenuSection() {
  const [notifikasi, setNotifikasi] = useState(true);
  const [papanSkor, setPapanSkor] = useState(false);
  const [orientasi, setOrientasi] = useState('potret');
  const [aksi, setAksi] = useState('Belum ada aksi dipilih');

  return (
    <Block
      label="DropdownMenu: menu aksi booth"
      note="Menu lengkap dengan label, pemisah, item checkbox, radio group orientasi, dan submenu. Setiap pilihan menulis state yang bisa dibaca di bawah."
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="neutral" />}>
              Aksi booth
              <ChevronDownIcon />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Booth A1</DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      setAksi('Mulai sesi baru di Booth A1');
                      toast.add({
                        title: 'Sesi baru dimulai',
                        description: 'Booth A1 menunggu tamu.',
                      });
                    }}
                  >
                    <PlayIcon />
                    Mulai sesi baru
                    <DropdownMenuShortcut>Ctrl S</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAksi('Uji cetak dikirim ke printer A1');
                      toast.add({
                        title: 'Uji cetak dikirim',
                        description: 'Satu strip uji menuju printer A1.',
                      });
                    }}
                  >
                    <PrinterIcon />
                    Uji cetak
                    <DropdownMenuShortcut>Ctrl P</DropdownMenuShortcut>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAksi('Jadwal maintenance dibuka untuk A1');
                      toast.add({
                        title: 'Maintenance dijadwalkan',
                        description: 'Booth A1 masuk daftar perawatan besok.',
                      });
                    }}
                  >
                    <CalendarIcon />
                    Jadwalkan maintenance
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tampilan</DropdownMenuLabel>
                <DropdownMenuCheckboxItem checked={notifikasi} onCheckedChange={setNotifikasi}>
                  Notifikasi gangguan
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={papanSkor} onCheckedChange={setPapanSkor}>
                  Papan skor harian
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Orientasi foto</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={orientasi}
                  onValueChange={(value) => setOrientasi(value as string)}
                >
                  <DropdownMenuRadioItem value="potret">Potret 2x6</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="lanskap">Lanskap 4x6</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="persegi">Persegi 1x1</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <DownloadIcon />
                    Ekspor galeri
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuItem
                      onClick={() => {
                        setAksi('Ekspor ZIP sesi hari ini dimulai');
                        toast.add({
                          title: 'Ekspor dimulai',
                          description: 'Arsip ZIP sesi hari ini sedang dibuat.',
                        });
                      }}
                    >
                      ZIP sesi hari ini
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAksi('Ekspor CSV transaksi mingguan dimulai');
                        toast.add({
                          title: 'Ekspor dimulai',
                          description: 'CSV transaksi satu minggu sedang dibuat.',
                        });
                      }}
                    >
                      CSV transaksi
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    setAksi('Permintaan cabut akses Booth A1 dikirim');
                    toast.add({
                      title: 'Permintaan cabut dikirim',
                      type: 'error',
                      description: 'Menunggu konfirmasi operator outlet.',
                    });
                  }}
                >
                  <UnlinkIcon />
                  Cabut akses booth
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>
        </div>

        <StatusLine>
          Aksi terakhir: {aksi}. Notifikasi gangguan {notifikasi ? 'aktif' : 'mati'}, papan skor{' '}
          {papanSkor ? 'tampil' : 'sembunyi'}, orientasi {orientasi}.
        </StatusLine>
      </div>
    </Block>
  );
}

function ContextMenuSection() {
  const [berkas, setBerkas] = useState<string | null>(null);
  const [gridTampil, setGridTampil] = useState(false);
  const [ukuran, setUkuran] = useState('sedang');
  const [catatan, setCatatan] = useState('Kanvas belum disentuh');

  return (
    <Block
      label="ContextMenu: area kanvas foto"
      note="Klik kanan pada area bergaris putus-putus untuk membuka menu. Menu memuat checkbox, radio group, dan submenu yang semuanya mengubah state."
    >
      <div className="flex flex-col gap-4">
        <ContextMenu>
          <ContextMenuTrigger className="flex h-40 items-center justify-center rounded-base border-2 border-border bg-secondary-background p-6 text-center">
            <span className="flex flex-col items-center gap-2 text-sm font-base text-foreground">
              <ImageIcon className="size-6" />
              Klik kanan di sini untuk membuka menu kanvas
            </span>
          </ContextMenuTrigger>
          <ContextMenuPortal>
            <ContextMenuContent className="w-64">
              <ContextMenuLabel>Kanvas sesi A1</ContextMenuLabel>
              <ContextMenuSeparator />

              <ContextMenuGroup>
                <ContextMenuItem
                  onClick={() => {
                    setCatatan('Kecerahan kanvas dinaikkan');
                    toast.add({ title: 'Kecerahan naik', description: 'Kanvas A1 lebih terang.' });
                  }}
                >
                  <GaugeIcon />
                  Naikkan kecerahan
                  <ContextMenuShortcut>Ctrl +</ContextMenuShortcut>
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    setCatatan('Kanvas diputar 90 derajat');
                    toast.add({
                      title: 'Kanvas diputar',
                      description: 'Orientasi berubah 90 derajat.',
                    });
                  }}
                >
                  <RotateIcon />
                  Putar 90 derajat
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    setCatatan('Filter monokrom dipasang');
                    toast.add({
                      title: 'Filter dipasang',
                      description: 'Kanvas memakai filter monokrom.',
                    });
                  }}
                >
                  <PaletteIcon />
                  Pasang filter monokrom
                </ContextMenuItem>
              </ContextMenuGroup>

              <ContextMenuSeparator />
              <ContextMenuCheckboxItem checked={gridTampil} onCheckedChange={setGridTampil}>
                Tampilkan garis bantu
              </ContextMenuCheckboxItem>

              <ContextMenuSeparator />
              <ContextMenuLabel>Ukuran pratinjau</ContextMenuLabel>
              <ContextMenuRadioGroup
                value={ukuran}
                onValueChange={(value) => setUkuran(value as string)}
              >
                <ContextMenuRadioItem value="kecil">Kecil</ContextMenuRadioItem>
                <ContextMenuRadioItem value="sedang">Sedang</ContextMenuRadioItem>
                <ContextMenuRadioItem value="besar">Besar</ContextMenuRadioItem>
              </ContextMenuRadioGroup>

              <ContextMenuSeparator />
              <ContextMenuSub>
                <ContextMenuSubTrigger>Simpan salinan ke</ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-48">
                  <ContextMenuItem
                    onClick={() => {
                      setBerkas('salinan-A1-hari-ini.zip');
                      toast.add({
                        title: 'Salinan disimpan',
                        description: 'Arsip hari ini dibuat.',
                      });
                    }}
                  >
                    Arsip hari ini
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      setBerkas('salinan-A1-mingguan.zip');
                      toast.add({
                        title: 'Salinan disimpan',
                        description: 'Arsip mingguan dibuat.',
                      });
                    }}
                  >
                    Arsip mingguan
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => {
                  setBerkas(null);
                  setCatatan('Foto terpilih dihapus dari kanvas');
                  toast.add({
                    title: 'Foto dihapus',
                    type: 'error',
                    description: 'Foto terpilih dibuang dari kanvas A1.',
                  });
                }}
              >
                <TrashIcon />
                Hapus foto terpilih
                <ContextMenuShortcut>Del</ContextMenuShortcut>
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenuPortal>
        </ContextMenu>

        <StatusLine>
          {catatan}. Garis bantu {gridTampil ? 'tampil' : 'sembunyi'}, ukuran pratinjau {ukuran},
          salinan terakhir {berkas ?? 'belum ada'}.
        </StatusLine>
      </div>
    </Block>
  );
}

function MenubarSection() {
  const [modeKiosk, setModeKiosk] = useState(true);
  const [terang, setTerang] = useState(false);
  const [resolusi, setResolusi] = useState('500x750');
  const [lintasan, setLintasan] = useState('Booth A1, Grand Indonesia');

  return (
    <Block
      label="Menubar: menu aplikasi konsol"
      note="Tiga menu dengan item fungsional, satu checkbox, satu radio group, dan satu submenu. Setiap pilihan tercatat pada baris status."
    >
      <div className="flex flex-col gap-4">
        <Menubar className="max-w-full overflow-x-auto">
          <MenubarMenu>
            <MenubarTrigger>Berkas</MenubarTrigger>
            <MenubarContent>
              <MenubarLabel>Berkas</MenubarLabel>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  setLintasan('Berkas sesi baru dibuat untuk Booth A1');
                  toast.add({
                    title: 'Berkas dibuat',
                    description: 'Lembar kerja sesi baru siap.',
                  });
                }}
              >
                Berkas sesi baru
                <MenubarShortcut>Ctrl N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  setLintasan('Konfigurasi outlet dimuat ulang');
                  toast.add({
                    title: 'Konfigurasi dimuat',
                    description: 'Setelan tiga outlet diperbarui.',
                  });
                }}
              >
                Muat konfigurasi outlet
              </MenubarItem>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>Ekspor laporan</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem
                    onClick={() => {
                      setLintasan('Laporan harian diekspor sebagai CSV');
                      toast.add({
                        title: 'Laporan diekspor',
                        description: 'CSV harian sedang dibuat.',
                      });
                    }}
                  >
                    CSV harian
                  </MenubarItem>
                  <MenubarItem
                    onClick={() => {
                      setLintasan('Laporan bulanan diekspor sebagai PDF');
                      toast.add({
                        title: 'Laporan diekspor',
                        description: 'PDF bulanan sedang dibuat.',
                      });
                    }}
                  >
                    PDF bulanan
                  </MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Booth</MenubarTrigger>
            <MenubarContent>
              <MenubarLabel>Booth</MenubarLabel>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarItem
                  onClick={() => {
                    setLintasan('Sinkronisasi enam booth dijalankan');
                    toast.add({
                      title: 'Sinkronisasi jalan',
                      description: 'Menarik data enam booth.',
                    });
                  }}
                >
                  Sinkronkan semua booth
                </MenubarItem>
                <MenubarItem
                  onClick={() => {
                    setLintasan('Booth A1 dijeda sementara');
                    toast.add({
                      title: 'Booth A1 dijeda',
                      type: 'error',
                      description: 'Antrean sesi ditahan.',
                    });
                  }}
                >
                  Jeda Booth A1
                </MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarCheckboxItem checked={modeKiosk} onCheckedChange={setModeKiosk}>
                Mode kiosk penuh
              </MenubarCheckboxItem>
              <MenubarCheckboxItem checked={terang} onCheckedChange={setTerang}>
                Perkecil kecerahan layar
              </MenubarCheckboxItem>
              <MenubarSeparator />
              <MenubarLabel>Resolusi cetak</MenubarLabel>
              <MenubarRadioGroup
                value={resolusi}
                onValueChange={(value) => setResolusi(value as string)}
              >
                <MenubarRadioItem value="400x600">Strip kecil 400x600</MenubarRadioItem>
                <MenubarRadioItem value="500x750">Strip standar 500x750</MenubarRadioItem>
                <MenubarRadioItem value="1200x1800">Postcard 1200x1800</MenubarRadioItem>
              </MenubarRadioGroup>
            </MenubarContent>
          </MenubarMenu>

          <MenubarMenu>
            <MenubarTrigger>Bantuan</MenubarTrigger>
            <MenubarContent>
              <MenubarItem
                onClick={() => {
                  setLintasan('Panduan pemasangan booth dibuka');
                  toast.add({
                    title: 'Panduan dibuka',
                    description: 'Langkah pemasangan booth baru ditampilkan.',
                  });
                }}
              >
                Panduan pemasangan booth
              </MenubarItem>
              <MenubarItem
                onClick={() => {
                  setLintasan('Status layanan diperiksa');
                  toast.add({
                    title: 'Layanan normal',
                    description: 'Tiga layanan inti berjalan tanpa gangguan.',
                  });
                }}
              >
                Periksa status layanan
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => {
                  setLintasan('Pintasan papan tik ditampilkan');
                  toast.add({
                    title: 'Pintasan tampil',
                    description: 'Daftar pintasan konsol dibuka.',
                  });
                }}
              >
                Pintasan papan tik
                <MenubarShortcut>?</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <StatusLine>
          Mode kiosk {modeKiosk ? 'aktif' : 'mati'}, layar {terang ? 'redup' : 'terang'}, resolusi{' '}
          {resolusi}. {lintasan}.
        </StatusLine>
      </div>
    </Block>
  );
}

function HoverCardSection() {
  return (
    <Block
      label="HoverCard: pratinjau booth"
      note="Kartu ini juga terbuka saat penerima fokus lewat Tab pada pengalih, jadi bisa dibaca tanpa tetikus."
    >
      <div className="flex flex-wrap items-center gap-3 text-sm font-base">
        <span>Antrean cetak hari ini:</span>
        <HoverCard>
          <HoverCardTrigger
            href="#overlays"
            className="inline-flex min-h-11 items-center rounded-base border-2 border-border bg-secondary-background px-2 py-1 font-heading"
          >
            Booth B2, Kota Kasablanka
          </HoverCardTrigger>
          <HoverCardContent>
            <p className="font-heading">Booth B2</p>
            <p className="mt-1 text-sm">
              Printer tersangkut sejak 14.09. Teknisi ditugaskan, perkiraan tiba 15 menit lagi.
              Antrean sesi ditahan sementara.
            </p>
            <p className="mt-2 text-sm">Sisa kertas 380 lembar, suhu ruang normal.</p>
          </HoverCardContent>
        </HoverCard>
        <span>sedang ditangani.</span>
      </div>
    </Block>
  );
}

function CollapsibleSection() {
  const [buka, setBuka] = useState(false);
  const [rincian, setRincian] = useState(false);

  return (
    <Block
      label="Collapsible: rincian gangguan"
      note="Dua panel lipat independen. Status buka terlihat dari ikon dan baris ringkasan di bawahnya."
    >
      <div className="flex flex-col gap-4">
        <Collapsible open={buka} onOpenChange={setBuka}>
          <CollapsibleTrigger render={<Button variant="neutral" />}>
            <ChevronDownIcon
              className={
                buka ? 'size-4 rotate-180 transition-transform' : 'size-4 transition-transform'
              }
            />
            {buka ? 'Sembunyikan langkah pemulihan' : 'Tampilkan langkah pemulihan'}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 rounded-base border-2 border-border bg-secondary-background p-4">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm font-base text-foreground">
              <li>Buka penutup printer Booth B2 dan lepaskan sisa kertas yang tersangkut.</li>
              <li>Tutup penutup sampai berbunyi klik, lalu tunggu sensor menandai siap.</li>
              <li>Tekan Lanjutkan antrean pada kartu booth untuk mengirim ulang sesi tertahan.</li>
            </ol>
          </CollapsibleContent>
        </Collapsible>

        <Collapsible open={rincian} onOpenChange={setRincian}>
          <CollapsibleTrigger render={<Button variant="noShadow" size="sm" className="min-h-11" />}>
            {rincian ? 'Sembunyikan rincian teknis' : 'Tampilkan rincian teknis'}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 rounded-base border-2 border-border bg-secondary-background p-4">
            <p className="text-sm font-base text-foreground">
              Kode galat P-114, waktu kejadian 14.09, firmware printer 3.2.1, panjang antrean saat
              kejadian 4 sesi.
            </p>
          </CollapsibleContent>
        </Collapsible>

        <StatusLine>
          Panel langkah pemulihan {buka ? 'terbuka' : 'tertutup'}, panel rincian teknis{' '}
          {rincian ? 'terbuka' : 'tertutup'}.
        </StatusLine>
      </div>
    </Block>
  );
}

function ResizableSection() {
  const [rimbun, setRimbun] = useState(true);

  return (
    <Block
      label="ResizablePanelGroup: editor dan pratinjau"
      note="Panel kiri menahan pengaturan, panel kanan menampilkan pratinjau. Pegangan di tengah bisa digeser dengan tetikus maupun tombol panah saat fokus."
    >
      <div className="flex flex-col gap-4">
        <ResizablePanelGroup
          orientation="horizontal"
          className="h-64 rounded-base border-2 border-border"
        >
          <ResizablePanel defaultSize={40} minSize={20} className="bg-secondary-background">
            <div className="flex h-full flex-col gap-3 overflow-auto p-4">
              <p className="text-base font-heading">Pengaturan sesi</p>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="gallery-resizable-rimbun"
                  checked={rimbun}
                  onCheckedChange={(checked) => setRimbun(checked === true)}
                />
                <Label htmlFor="gallery-resizable-rimbun">Tampilkan bingkai rimbun</Label>
              </div>
              <p className="text-sm font-base text-foreground">
                Geser pegangan untuk melihat panel kanan meluas.
              </p>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} className="bg-background">
            <div className="flex h-full flex-col gap-3 overflow-auto p-4">
              <p className="text-base font-heading">Pratinjau strip</p>
              <p className="text-sm font-base text-foreground">
                Bingkai rimbun {rimbun ? 'aktif' : 'mati'}. Pratinjau memakai dua slot foto potret
                dengan keterangan outlet di bagian bawah.
              </p>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>

        <ResizablePanelGroup
          orientation="vertical"
          className="h-64 rounded-base border-2 border-border"
        >
          <ResizablePanel defaultSize={50} className="bg-secondary-background">
            <div className="flex h-full items-center p-4 text-sm font-base text-foreground">
              Panel atas untuk daftar frame.
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} className="bg-background">
            <div className="flex h-full items-center p-4 text-sm font-base text-foreground">
              Panel bawah untuk daftar stiker.
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </Block>
  );
}

function ScrollAreaSection() {
  return (
    <Block
      label="ScrollArea: riwayat log perangkat"
      note="Tinggi dibatasi agar batang gulir benar-benar muncul. Baris galat dan peringatan memakai warna status."
    >
      <ScrollArea className="h-48 rounded-base border-2 border-border bg-secondary-background">
        <ul className="flex flex-col divide-y-2 divide-border">
          {LOG_ENTRIES.map((entry, index) => (
            <li key={`${entry.time}-${index}`} className="flex items-start gap-3 px-3 py-2">
              <span className="text-sm font-heading tabular-nums">{entry.time}</span>
              <span
                className={`rounded-base border-2 border-border px-2 py-0.5 text-xs font-base ${LEVEL_CLASSES[entry.level]}`}
              >
                {entry.level}
              </span>
              <span className="text-sm font-base text-foreground">{entry.message}</span>
            </li>
          ))}
        </ul>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </Block>
  );
}

function AccordionSection() {
  const [periode, setPeriode] = useState<string[]>(['paper']);

  return (
    <Block
      label="Accordion: pertanyaan operasional"
      note="Tiga pertanyaan yang sering muncul di outlet, memakai mode satu terbuka. Daftar kedua memakai mode beberapa terbuka sekaligus, dan nilai yang terbuka ditampilkan."
    >
      <div className="flex flex-col gap-6">
        <Accordion className="flex flex-col gap-3">
          {FAQ_SINGLE.map((item) => (
            <AccordionItem key={item.value} value={item.value}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-base text-foreground">
            Mode beberapa terbuka sekaligus, berguna saat operator menyiapkan outlet baru.
          </p>
          <Accordion
            multiple
            value={periode}
            onValueChange={(value) => setPeriode(value as string[])}
            className="flex flex-col gap-3"
          >
            {FAQ_MULTIPLE.map((item) => (
              <AccordionItem key={item.value} value={item.value}>
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <StatusLine>
            {periode.length === 0
              ? 'Tidak ada pertanyaan yang terbuka pada daftar kedua.'
              : `${periode.length} pertanyaan terbuka: ${periode.join(', ')}.`}
          </StatusLine>
        </div>
      </div>
    </Block>
  );
}

export function OverlaysSection() {
  return (
    <SectionHeader
      id="gallery-overlays"
      title="Overlay"
      description="Dialog, panel samping, drawer, popover, menu, kartu hover, panel lipat, dan panel berukuran bisa diubah. Setiap pemicu benar-benar membuka sesuatu, bisa ditutup dengan Escape atau klik luar, dan menuliskan state yang bisa diperiksa."
    >
      <DialogSection />
      <AlertDialogSection />
      <SheetSection />
      <DrawerSection />
      <PopoverSection />
      <DropdownMenuSection />
      <ContextMenuSection />
      <MenubarSection />
      <HoverCardSection />
      <CollapsibleSection />
      <ResizableSection />
      <ScrollAreaSection />
      <AccordionSection />
    </SectionHeader>
  );
}
