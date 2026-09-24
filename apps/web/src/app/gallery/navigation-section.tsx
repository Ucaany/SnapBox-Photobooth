'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  useSidebar,
} from '@snapbox/ui';
import { useState } from 'react';

import type { ReactNode } from 'react';

/* ------------------------------------------------------------------------- *
 * Ikon inline gaya Lucide.
 *
 * `lucide-react` milik `@snapbox/ui`, bukan `apps/web`. Digambar ulang di sini
 * supaya tidak bergantung pada hoisting pnpm.
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

const ChevronRightIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="m9 18 6-6-6-6" />
  </SvgIcon>
);

const HomeIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </SvgIcon>
);

const CameraIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z" />
    <circle cx="12" cy="13" r="3.5" />
  </SvgIcon>
);

const MonitorIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <rect width="20" height="14" x="2" y="3" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </SvgIcon>
);

const ChartIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </SvgIcon>
);

const SlidersIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
    <path d="M2 14h4M10 8h4M18 16h4" />
  </SvgIcon>
);

const FileIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </SvgIcon>
);

const ExitIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5M21 12H9" />
  </SvgIcon>
);

const PlusIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <path d="M5 12h14M12 5v14" />
  </SvgIcon>
);

const SearchIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </SvgIcon>
);

const HelpIcon = ({ className }: IconProps) => (
  <SvgIcon className={className}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </SvgIcon>
);

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

const SESSIONS = [
  { id: 'S-1043', waktu: '14.02', tamu: 4, status: 'Selesai' },
  { id: 'S-1044', waktu: '14.11', tamu: 2, status: 'Selesai' },
  { id: 'S-1045', waktu: '14.18', tamu: 6, status: 'Menunggu cetak' },
  { id: 'S-1046', waktu: '14.25', tamu: 3, status: 'Selesai' },
  { id: 'S-1047', waktu: '14.31', tamu: 6, status: 'Gagal unggah' },
  { id: 'S-1048', waktu: '14.39', tamu: 2, status: 'Selesai' },
  { id: 'S-1049', waktu: '14.44', tamu: 5, status: 'Selesai' },
] as const;

const COMMANDS = [
  { id: 'cmd-booth-a1', label: 'Buka detail Booth A1', short: 'B1' },
  { id: 'cmd-booth-b2', label: 'Buka detail Booth B2', short: 'B2' },
  { id: 'cmd-sesi-baru', label: 'Mulai sesi foto baru', short: 'Ctrl S' },
  { id: 'cmd-sinkron', label: 'Sinkronkan semua booth', short: 'Ctrl R' },
  { id: 'cmd-ekspor', label: 'Ekspor rekap harian', short: 'Ctrl E' },
  { id: 'cmd-printer', label: 'Uji cetak printer A1', short: 'Ctrl P' },
  { id: 'cmd-maintenance', label: 'Jadwalkan maintenance', short: 'Ctrl M' },
  { id: 'cmd-riwayat', label: 'Buka riwayat log perangkat', short: 'Ctrl L' },
] as const;

const RIWAYAT = [
  { id: 'S-1043', waktu: '23 September 14.02' },
  { id: 'S-1044', waktu: '23 September 14.11' },
  { id: 'S-1045', waktu: '23 September 14.18' },
  { id: 'S-1046', waktu: '23 September 14.25' },
  { id: 'S-1047', waktu: '23 September 14.31' },
] as const;

const LOG_RIWAYAT = [
  { id: 'L-8841', waktu: '23 September 14.09' },
  { id: 'L-8842', waktu: '23 September 14.10' },
  { id: 'L-8843', waktu: '23 September 14.21' },
  { id: 'L-8844', waktu: '23 September 14.33' },
  { id: 'L-8845', waktu: '23 September 14.34' },
] as const;

/* ------------------------------------------------------------------------- *
 * Bagian NAVIGATION.
 * ------------------------------------------------------------------------- */

function BreadcrumbBlock() {
  return (
    <Block
      label="Breadcrumb: jalur dashboard"
      note="Semua tautan menunjuk anchor yang benar-benar ada di halaman ini. Bagian tengah dipadatkan dengan elipsis supaya jalur panjang tetap ringkas."
    >
      <div className="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#navigation">Dasbor</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#overlays">Booth</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Booth 1, Grand Indonesia</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#navigation">Dasbor</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbEllipsis />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#overlays">Booth</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Sesi S-1045</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </Block>
  );
}

function TabsBlock() {
  return (
    <Block
      label="Tabs: varian default dan line"
      note="Dua varian penanda yang berbeda, keduanya punya isi terpisah: ringkasan, sesi, dan log."
    >
      <div className="flex flex-col gap-6">
        <Tabs defaultValue="ringkasan">
          <TabsList aria-label="Ringkasan booth, varian default">
            <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
            <TabsTrigger value="sesi">Sesi</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>
          <TabsContent value="ringkasan" className="text-sm font-base text-foreground">
            Booth A1 berjalan normal. Rata-rata 120 sesi per hari dengan puncak pada Sabtu, dan
            pendapatan kotor minggu ini Rp 12.400.000 dari outlet Grand Indonesia.
          </TabsContent>
          <TabsContent value="sesi" className="text-sm font-base text-foreground">
            Empat sesi selesai sejak pukul 14.00, satu menunggu cetak, satu gagal unggah dan sedang
            dicoba ulang otomatis oleh antrean.
          </TabsContent>
          <TabsContent value="log" className="text-sm font-base text-foreground">
            Tidak ada galat kritis pada jam terakhir. Dua peringatan tercatat: kertas menipis di B1
            dan sinkronisasi C1 yang sempat terlambat.
          </TabsContent>
        </Tabs>

        <Tabs defaultValue="ringkasan">
          <TabsList variant="line" aria-label="Ringkasan booth, varian line">
            <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
            <TabsTrigger value="sesi">Sesi</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>
          <TabsContent value="ringkasan" className="text-sm font-base text-foreground">
            Varian garis dipakai saat tab menempel di tepi panel tanpa kotak latar, misalnya di
            kepala laci detail perangkat.
          </TabsContent>
          <TabsContent value="sesi" className="text-sm font-base text-foreground">
            Daftar sesi memakai tabel ringkas dengan nomor sesi, waktu mulai, dan jumlah tamu.
          </TabsContent>
          <TabsContent value="log" className="text-sm font-base text-foreground">
            Log menampung paling banyak lima ratus baris terakhir per booth.
          </TabsContent>
        </Tabs>
      </div>
    </Block>
  );
}

function PaginationBlock() {
  const total = 12;
  const [halaman, setHalaman] = useState(1);

  const maju = (target: number) => {
    setHalaman(Math.min(total, Math.max(1, target)));
  };

  return (
    <Block
      label="Pagination: daftar sesi"
      note="Navigasi halaman dengan nomor halaman yang benar-benar berubah. Tombol mundur dan maju dinonaktifkan di ujung rentang."
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-base text-foreground">
          Sesi terbaru ditampilkan tiga per halaman. Halaman aktif: {halaman}.
        </p>

        <div className="max-w-full min-w-0 overflow-x-auto">
          <Pagination className="justify-start">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#navigation"
                  aria-disabled={halaman === 1 ? 'true' : undefined}
                  className={halaman === 1 ? 'pointer-events-none opacity-50' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    maju(halaman - 1);
                  }}
                />
              </PaginationItem>
              {[1, 2, 3].map((nomor) => (
                <PaginationItem key={nomor}>
                  <PaginationLink
                    href="#navigation"
                    isActive={nomor === halaman}
                    onClick={(event) => {
                      event.preventDefault();
                      maju(nomor);
                    }}
                  >
                    {nomor}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink
                  href="#navigation"
                  isActive={halaman === total}
                  onClick={(event) => {
                    event.preventDefault();
                    maju(total);
                  }}
                >
                  {total}
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#navigation"
                  aria-disabled={halaman === total ? 'true' : undefined}
                  className={halaman === total ? 'pointer-events-none opacity-50' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    maju(halaman + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>

        <StatusLine>
          Halaman {halaman} dari {total} total, menampilkan sesi {(halaman - 1) * 3 + 1} sampai{' '}
          {Math.min(halaman * 3, 36)} dari 36 sesi.
        </StatusLine>
      </div>
    </Block>
  );
}

function NavigationMenuBlock() {
  return (
    <Block
      label="NavigationMenu: menu navigasi konsol"
      note="Menu tarik turun dengan konten. Setiap tautan menuju anchor yang benar-benar ada di halaman ini, jadi tidak ada tautan mati."
    >
      <NavigationMenu className="max-w-full">
        <NavigationMenuList className="justify-start">
          <NavigationMenuItem>
            <NavigationMenuTrigger>Dasbor</NavigationMenuTrigger>
            <NavigationMenuContent className="w-64">
              <ul className="flex flex-col gap-1 p-1">
                <li>
                  <NavigationMenuLink href="#navigation" className="text-sm font-heading">
                    Ikhtisar operasional
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#overlays" className="text-sm font-heading">
                    Kartu booth bermasalah
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuTrigger>Booth</NavigationMenuTrigger>
            <NavigationMenuContent className="w-64">
              <ul className="flex flex-col gap-1 p-1">
                <li>
                  <NavigationMenuLink href="#overlays" className="text-sm font-heading">
                    Aksi cepat booth
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#navigation" className="text-sm font-heading">
                    Daftar semua booth
                  </NavigationMenuLink>
                </li>
                <li>
                  <NavigationMenuLink href="#navigation" className="text-sm font-heading">
                    Riwayat pemasangan perangkat
                  </NavigationMenuLink>
                </li>
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>

          <NavigationMenuItem>
            <NavigationMenuLink href="#overlays">Panduan</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </Block>
  );
}

function CommandBlock() {
  const [buka, setBuka] = useState(false);

  return (
    <Block
      label="Command: pencarian perintah"
      note="Ketik untuk memfilter daftar, dan CommandEmpty muncul saat tidak ada hasil. Versi dialog terbuka dari tombol dan bisa ditutup dengan Escape."
    >
      <div className="flex flex-col gap-5">
        <div className="w-full max-w-md">
          <Command className="h-72">
            <CommandInput placeholder="Cari perintah, misalnya booth atau ekspor" />
            <CommandList>
              <CommandEmpty>Tidak ada perintah yang cocok.</CommandEmpty>
              <CommandGroup heading="Booth">
                <CommandItem
                  onSelect={() => {
                    toast.add({
                      title: 'Perintah dijalankan',
                      description: 'Membuka detail Booth A1.',
                    });
                  }}
                >
                  <MonitorIcon />
                  Buka detail Booth A1
                  <CommandShortcut>B1</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    toast.add({
                      title: 'Perintah dijalankan',
                      description: 'Membuka detail Booth B2.',
                    });
                  }}
                >
                  <MonitorIcon />
                  Buka detail Booth B2
                  <CommandShortcut>B2</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Aksi">
                <CommandItem
                  onSelect={() => {
                    toast.add({
                      title: 'Sesi baru dimulai',
                      description: 'Booth A1 menunggu tamu.',
                    });
                  }}
                >
                  Mulai sesi foto baru
                  <CommandShortcut>Ctrl S</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    toast.add({
                      title: 'Sinkronisasi jalan',
                      description: 'Menarik data enam booth.',
                    });
                  }}
                >
                  Sinkronkan semua booth
                  <CommandShortcut>Ctrl R</CommandShortcut>
                </CommandItem>
                <CommandItem
                  onSelect={() => {
                    toast.add({
                      title: 'Ekspor dimulai',
                      description: 'Rekap harian sedang dibuat.',
                    });
                  }}
                >
                  Ekspor rekap harian
                  <CommandShortcut>Ctrl E</CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Bantuan">
                <CommandItem
                  onSelect={() => {
                    toast.add({
                      title: 'Panduan dibuka',
                      description: 'Langkah pemasangan booth.',
                    });
                  }}
                >
                  <HelpIcon />
                  Panduan pemasangan booth
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="neutral" onClick={() => setBuka(true)}>
              <SearchIcon />
              Buka command palette
            </Button>
            <StatusLine>
              Command palette{' '}
              {buka ? 'sedang terbuka.' : 'tertutup. Tekan tombol untuk membukanya.'}
            </StatusLine>
          </div>
        </div>

        <CommandDialog
          open={buka}
          onOpenChange={setBuka}
          title="Command palette SnapBox"
          description="Cari perintah konsol, booth, atau laporan."
        >
          <CommandInput placeholder="Cari perintah atau nama booth" />
          <CommandList>
            <CommandEmpty>Tidak ada perintah yang cocok.</CommandEmpty>
            <CommandGroup heading="Perintah cepat">
              {COMMANDS.map((command) => (
                <CommandItem
                  key={command.id}
                  onSelect={() => {
                    setBuka(false);
                    toast.add({ title: 'Perintah dijalankan', description: command.label });
                  }}
                >
                  {command.label}
                  <CommandShortcut>{command.short}</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>
    </Block>
  );
}

/** Isi sidebar dipisah agar hook useSidebar punya konteks provider. */
function BoothSidebarContent() {
  const { state } = useSidebar();
  const [submenuBuka, setSubmenuBuka] = useState(true);

  return (
    <>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <span className="rounded-base border-2 border-border bg-main px-2 py-1 text-sm font-heading text-main-foreground">
            SB
          </span>
          <span className="text-sm font-heading">Konsol Booth</span>
        </div>
        <SidebarInput placeholder="Cari booth atau outlet" aria-label="Cari booth atau outlet" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operasional</SidebarGroupLabel>
          <SidebarGroupAction
            aria-label="Tambah booth"
            onClick={() => {
              toast.add({
                title: 'Form tambah booth',
                description: 'Menyiapkan pemasangan booth baru.',
              });
            }}
          >
            <PlusIcon />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton isActive tooltip="Ikhtisar" render={<a href="#navigation" />}>
                  <HomeIcon />
                  <span>Ikhtisar</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sesi foto" render={<a href="#overlays" />}>
                  <CameraIcon />
                  <span>Sesi foto</span>
                </SidebarMenuButton>
                <SidebarMenuBadge aria-label="Tiga sesi menunggu cetak">3</SidebarMenuBadge>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Perangkat" render={<a href="#overlays" />}>
                  <MonitorIcon />
                  <span>Perangkat</span>
                </SidebarMenuButton>
                <SidebarMenuBadge aria-label="Dua perangkat bermasalah">2</SidebarMenuBadge>
                <SidebarMenuAction
                  aria-label="Sinkronkan perangkat"
                  showOnHover
                  onClick={() => {
                    toast.add({
                      title: 'Sinkronisasi jalan',
                      description: 'Memeriksa enam booth.',
                    });
                  }}
                >
                  <ChevronRightIcon />
                </SidebarMenuAction>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Laporan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Pendapatan" render={<a href="#navigation" />}>
                  <ChartIcon />
                  <span>Pendapatan</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Setelan" render={<a href="#navigation" />}>
                  <SlidersIcon />
                  <span>Setelan</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Detail per booth</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Booth A1"
                  isActive={submenuBuka}
                  onClick={() => setSubmenuBuka((current) => !current)}
                >
                  <FileIcon />
                  <span>Booth A1</span>
                </SidebarMenuButton>
                {submenuBuka ? (
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton render={<a href="#overlays" />}>
                        Aksi cepat
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton render={<a href="#navigation" />}>
                        Riwayat sesi
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Memuat data outlet</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuSkeleton showIcon />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenuButton tooltip="Keluar" render={<a href="#navigation" />}>
          <ExitIcon />
          <span>Keluar</span>
        </SidebarMenuButton>
        <p className="px-2 text-xs font-base text-foreground">
          Papan tik: Ctrl B {state === 'expanded' ? 'menyembunyikan' : 'menampilkan'} sidebar.
        </p>
      </SidebarFooter>
    </>
  );
}

function SidebarBlock() {
  return (
    <Block
      label="Sidebar: navigasi konsol"
      note="Sidebar fungsional dengan SidebarProvider. Tombol pemicu membuka dan menutup, item menu menuju anchor nyata, badge menampilkan angka bermakna, dan satu grup punya submenu yang bisa dibuka tutup."
    >
      <div className="overflow-hidden rounded-base border-2 border-border">
        <SidebarProvider defaultOpen className="min-h-0">
          <Sidebar collapsible="offcanvas">
            <BoothSidebarContent />
            <SidebarRail />
          </Sidebar>
          <SidebarInset className="min-w-0 bg-background">
            <div className="flex items-center gap-3 border-b-2 border-border bg-background p-3">
              <SidebarTrigger aria-label="Buka atau tutup sidebar" />
              <span className="text-sm font-heading">Dasbor Booth A1</span>
            </div>
            <div className="flex flex-col gap-2 p-4">
              <p className="text-sm font-base text-foreground">
                Tekan tombol di atas untuk membuka dan menutup sidebar. Tiga badge pada grup
                operasional menunjukkan sesi menunggu cetak, perangkat bermasalah, dan item
                perangkat yang perlu ditengok.
              </p>
              <p className="text-sm font-base text-foreground">
                Grup Detail per booth punya submenu yang bisa dibuka tutup dari tombol Booth A1.
              </p>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </Block>
  );
}

function AccordionNavigationBlock() {
  return (
    <Block
      label="Accordion: panduan navigasi konsol"
      note="Panduan singkat untuk tiga alur konsol yang paling sering ditanyakan operator baru."
    >
      <Accordion className="flex flex-col gap-3">
        <AccordionItem value="pindah-booth">
          <AccordionTrigger>Bagaimana cara berpindah antar booth dengan cepat?</AccordionTrigger>
          <AccordionContent>
            Buka command palette dengan tombol di baris alat, lalu ketik nomor booth. Daftar
            menyusut saat Anda mengetik, jadi cukup tekan Enter pada hasil pertama. Untuk kembali ke
            ikhtisar, tekan Ctrl B untuk menyembunyikan sidebar.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="filter-sesi">
          <AccordionTrigger>Di mana saya bisa menyaring sesi per outlet?</AccordionTrigger>
          <AccordionContent>
            Saringan transaksi ada di panel samping kanan pada bagian Overlay. Setelah rentang dan
            outlet dipilih, tekan Terapkan filter agar daftar sesi di dasbor ikut berubah.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="kembali">
          <AccordionTrigger>
            Bagaimana cara kembali ke daftar outlet dari halaman booth?
          </AccordionTrigger>
          <AccordionContent>
            Gunakan jejak navigasi di bagian atas halaman. Tautan Dasbor dan Booth pada jejak itu
            mengarah ke bagian galeri yang sesuai, jadi Anda tidak perlu menekan tombol mundur
            peramban.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Block>
  );
}

function RiwayatList({ data }: { data: readonly { id: string; waktu: string }[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {data.map((baris) => (
        <li
          key={baris.id}
          className="flex flex-wrap items-center gap-3 rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-sm font-base"
        >
          <span className="font-heading">{baris.id}</span>
          <span>{baris.waktu}</span>
        </li>
      ))}
    </ul>
  );
}

function RiwayatBlock() {
  return (
    <Block
      label="Riwayat: daftar sesi dan log"
      note="Dua daftar datar sebagai pendamping navigasi, dipakai untuk memeriksa hasil penyaringan tanpa membuka tabel penuh."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-heading">Sesi terakhir</p>
          <RiwayatList data={RIWAYAT} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-heading">Log perangkat</p>
          <RiwayatList data={LOG_RIWAYAT} />
        </div>
      </div>
    </Block>
  );
}

export function NavigationSection() {
  return (
    <SectionHeader
      id="gallery-navigation"
      title="Navigasi"
      description="Jejak navigasi, tab, paginasi, menu tarik turun, sidebar fungsional, dan command palette. Semua tautan menuju anchor yang ada di halaman ini, dan setiap kontrol mengubah state yang bisa diperiksa."
    >
      <BreadcrumbBlock />
      <TabsBlock />
      <PaginationBlock />
      <NavigationMenuBlock />
      <CommandBlock />
      <SidebarBlock />
      <AccordionNavigationBlock />
      <RiwayatBlock />
      <StatusLine>
        Ringkasan halaman: {SESSIONS.length} sesi contoh, {COMMANDS.length} perintah cepat, dua
        varian tab.
      </StatusLine>
    </SectionHeader>
  );
}
