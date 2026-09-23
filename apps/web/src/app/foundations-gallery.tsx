'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@snapbox/ui';

/**
 * Galeri smoke test Task 0.2.
 *
 * Bukan halaman produksi: tujuannya membuktikan token tema, font next/font,
 * dan tiap base component `@snapbox/ui` benar-benar ter-render. Tiap status
 * memakai icon + label + teks, bukan warna saja (PRD Bab 4 aksesibilitas).
 */
export default function FoundationsGallery() {
  return (
    <main className="flex min-h-screen flex-col gap-12 px-6 py-12">
      <header className="flex flex-col gap-3 border-b-[3px] border-snapbox-ink bg-snapbox-primary px-6 py-8 shadow-snapbox">
        <p className="font-mono text-xs tracking-widest uppercase">Fase 0 / Task 0.2</p>
        <h1 className="font-display text-4xl font-bold tracking-tight uppercase sm:text-5xl">
          Design System Foundations
        </h1>
        <p className="max-w-3xl text-base leading-relaxed">
          Galeri smoke test untuk token neobrutalism, tipografi Space Grotesk + Inter + JetBrains
          Mono, dan seluruh base component bersama.
        </p>
      </header>

      <Section id="tipografi" title="Tipografi">
        <div className="grid gap-6 md:grid-cols-3">
          <div className="nb-border bg-snapbox-background p-5">
            <p className="font-mono text-xs tracking-widest uppercase">--font-display</p>
            <p className="mt-3 font-display text-3xl font-bold uppercase">Space Grotesk</p>
          </div>
          <div className="nb-border bg-snapbox-background p-5">
            <p className="font-mono text-xs tracking-widest uppercase">--font-sans</p>
            <p className="mt-3 font-sans text-3xl font-semibold">Inter</p>
          </div>
          <div className="nb-border bg-snapbox-background p-5">
            <p className="font-mono text-xs tracking-widest uppercase">--font-mono</p>
            <p className="mt-3 font-mono text-3xl font-medium">JetBrains Mono</p>
          </div>
        </div>
      </Section>

      <Section id="warna" title="Token Warna">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Swatch label="primary" className="bg-snapbox-primary" />
          <Swatch label="secondary" className="bg-snapbox-secondary" />
          <Swatch label="accent" className="bg-snapbox-accent" />
          <Swatch label="success" className="bg-snapbox-success" />
          <Swatch label="danger" className="bg-snapbox-danger" />
          <Swatch label="warning" className="bg-snapbox-warning" />
          <Swatch label="background" className="bg-snapbox-background" />
          <Swatch label="surface" className="bg-snapbox-surface" />
          <Swatch label="ink" className="bg-snapbox-ink" />
        </ul>
      </Section>

      <Section id="button" title="Button">
        <div className="flex flex-wrap items-center gap-4">
          <Button variant="default">Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Buka pengaturan">
            <GearGlyph />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
      </Section>

      <Section id="badge" title="Badge Status">
        <div className="flex flex-wrap items-center gap-4">
          <Badge tone="success">
            <DotGlyph /> ACTIVE
          </Badge>
          <Badge tone="success">
            <DotGlyph /> PAID
          </Badge>
          <Badge tone="success">
            <DotGlyph /> ONLINE
          </Badge>
          <Badge tone="warning">
            <DotGlyph /> WARNING
          </Badge>
          <Badge tone="danger">
            <DotGlyph /> ERROR
          </Badge>
          <Badge tone="danger">
            <DotGlyph /> SUSPENDED
          </Badge>
          <Badge tone="neutral">
            <DotGlyph /> UNPAIRED
          </Badge>
          <Badge tone="accent">
            <DotGlyph /> BARU
          </Badge>
        </div>
      </Section>

      <Section id="alert" title="Alert">
        <div className="grid gap-4 lg:grid-cols-2">
          <Alert variant="success" title="Pembayaran diterima">
            Sesi #4821 sudah tercatat. Invoice dikirim ke email owner.
          </Alert>
          <Alert variant="warning" title="Kertas menipis">
            Booth 3 tersisa 12 lembar. Segera ganti roll.
          </Alert>
          <Alert variant="destructive" title="Printer offline">
            Spooler Canon EOS 200D tidak merespons. Cek koneksi USB.
          </Alert>
          <Alert variant="info" title="Sinkronisasi berjalan">
            Konfigurasi baru sedang dikirim ke 8 booth.
          </Alert>
        </div>
      </Section>

      <Section id="card" title="Card">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Paket Single</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed">
                1 pose, 1 cetak 4×6, retake 1×. Cocok untuk photobooth kasual.
              </p>
            </CardBody>
            <CardFooter className="flex items-center justify-between gap-4">
              <span className="font-mono text-sm">Rp 35.000</span>
              <Button size="sm">Pilih</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paket Couple</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed">
                3 pose strip 2×6, retake 2×, soft copy via QR.
              </p>
            </CardBody>
            <CardFooter className="flex items-center justify-between gap-4">
              <span className="font-mono text-sm">Rp 50.000</span>
              <Button size="sm" variant="secondary">
                Pilih
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Paket Family</CardTitle>
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed">
                4 pose kolase, retake 3×, cetak 2 lembar, filter kustom.
              </p>
            </CardBody>
            <CardFooter className="flex items-center justify-between gap-4">
              <span className="font-mono text-sm">Rp 75.000</span>
              <Button size="sm" variant="outline">
                Pilih
              </Button>
            </CardFooter>
          </Card>
        </div>
      </Section>

      <Section id="form" title="Input & Form">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nama-outlet">Nama outlet</Label>
            <Input id="nama-outlet" placeholder="Paris Van Java Lantai 2" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="harga">Harga paket (Rp)</Label>
            <Input id="harga" type="number" defaultValue={35000} />
          </div>
          <div className="flex flex-col gap-2 lg:col-span-2">
            <Label htmlFor="catatan">Catatan internal</Label>
            <Textarea id="catatan" placeholder="Instruksi operator untuk booth ini…" rows={3} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="outlet-select">Outlet</Label>
            <Select defaultValue="bandung">
              <SelectTrigger id="outlet-select">
                <SelectValue placeholder="Pilih outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bandung">Bandung</SelectItem>
                <SelectItem value="surabaya">Surabaya</SelectItem>
                <SelectItem value="yogyakarta">Yogyakarta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="retake-range">Retake limit</Label>
            <Slider id="retake-range" defaultValue={[2]} min={0} max={5} step={1} />
          </div>
        </div>
      </Section>

      <Section id="table" title="Table">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Booth</TableHead>
                <TableHead>Outlet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Kertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Booth 1</TableCell>
                <TableCell>Bandung</TableCell>
                <TableCell>
                  <Badge tone="success">
                    <DotGlyph /> ONLINE
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">180/200</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Booth 2</TableCell>
                <TableCell>Surabaya</TableCell>
                <TableCell>
                  <Badge tone="warning">
                    <DotGlyph /> WARNING
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">90/200</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Booth 3</TableCell>
                <TableCell>Yogyakarta</TableCell>
                <TableCell>
                  <Badge tone="danger">
                    <DotGlyph /> ERROR
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">12/200</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </Section>

      <Section id="progress" title="Progress">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Kertas tersisa</Label>
              <span className="font-mono text-xs">180 / 200</span>
            </div>
            <Progress value={90} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Label>Penyimpanan lokal</Label>
              <span className="font-mono text-xs">62%</span>
            </div>
            <Progress value={62} />
          </div>
        </div>
      </Section>

      <Section id="tabs" title="Tabs">
        <Tabs defaultValue="ringkasan">
          <TabsList>
            <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
            <TabsTrigger value="sesi">Sesi</TabsTrigger>
            <TabsTrigger value="log">Log</TabsTrigger>
          </TabsList>
          <TabsContent value="ringkasan">
            <p className="p-5 text-sm leading-relaxed">
              12 sesi hari ini, 8 konversi, rata-rata 2 menit per sesi.
            </p>
          </TabsContent>
          <TabsContent value="sesi">
            <p className="p-5 text-sm leading-relaxed">
              Sesi terakhir #4821, paket Couple, selesai 10 menit lalu.
            </p>
          </TabsContent>
          <TabsContent value="log">
            <p className="p-5 font-mono text-xs leading-relaxed">
              10:04:12 INFO booth.online bandung-01
            </p>
          </TabsContent>
        </Tabs>
      </Section>

      <Section id="accordion" title="Accordion">
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>Bagaimana pairing booth baru?</AccordionTrigger>
            <AccordionContent>
              Buat device di dasbor, sistem menghasilkan pairing code 6 karakter yang berlaku 10
              menit. Teknisi memindai QR dari SnapBox Desktop.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>Apakah harga bisa berbeda per outlet?</AccordionTrigger>
            <AccordionContent>
              Ya. Paket foto dikonfigurasi per booth, jadi outlet yang berbeda boleh punya harga dan
              retake limit sendiri.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Bagaimana kalau printer offline?</AccordionTrigger>
            <AccordionContent>
              NeoAlert merah muncul, sesi tetap tercatat, dan soft copy ditawarkan sebagai fallback.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Section>

      <Section id="overlay" title="Dialog, Dropdown & Tooltip">
        <div className="flex flex-wrap items-center gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Buka Dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hapus paket foto?</DialogTitle>
                <DialogDescription>
                  Paket Single akan dihapus dari Booth 1. Tindakan ini tidak bisa dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Batal</Button>
                </DialogClose>
                <Button variant="destructive">Hapus</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Menu Aksi</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Booth 1</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Edit konfigurasi</DropdownMenuItem>
              <DropdownMenuItem>Restart perangkat</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Hapus booth</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline">Hover saya</Button>
              </TooltipTrigger>
              <TooltipContent>Sisa kertas diperbarui tiap heartbeat 60 detik.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </Section>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-6">
      <h2
        id={`${id}-heading`}
        className="inline-flex w-fit border-b-[4px] border-snapbox-ink bg-snapbox-primary px-4 py-2 font-display text-xl font-bold tracking-tight uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ label, className }: { label: string; className: string }) {
  return (
    <li className="flex flex-col gap-2">
      <span
        aria-hidden="true"
        className={`h-12 w-full border-[3px] border-snapbox-ink ${className}`}
      />
      <span className="font-mono text-xs">--color-snapbox-{label}</span>
    </li>
  );
}

function DotGlyph() {
  return <span aria-hidden="true" className="inline-block size-2 rounded-full bg-current" />;
}

function GearGlyph() {
  return (
    <span aria-hidden="true" className="text-base leading-none">
      *
    </span>
  );
}
