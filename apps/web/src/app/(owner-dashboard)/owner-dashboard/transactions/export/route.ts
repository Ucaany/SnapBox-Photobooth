import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireOwnerTenant } from '@/lib/owner-dashboard/outlet-server';
import { csvCell, transactionExportSchema } from '@/lib/owner-dashboard/transaction-contract';
import { exportOwnerTransactions } from '@/lib/owner-dashboard/transaction-server';

const columns = [
  'Kode',
  'Booth',
  'Outlet',
  'Paket',
  'Nominal',
  'Metode',
  'Status',
  'Dibuat',
  'Dibayar',
];

export async function GET(request: NextRequest) {
  return handleExport(request, false);
}

export async function POST(request: NextRequest) {
  return handleExport(request, true);
}

async function handleExport(request: NextRequest, zipRequest: boolean) {
  const auth = await requireOwnerTenant();
  if (!auth) return NextResponse.json({ message: 'Sesi tidak berwenang.' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  let payload: unknown;
  if (zipRequest) {
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ message: 'Permintaan ekspor tidak valid.' }, { status: 400 });
    }
  } else {
    payload = Object.fromEntries(
      ['status', 'method', 'boothId', 'from', 'to'].map((key) => [
        key,
        params.get(key) || undefined,
      ]),
    );
  }
  const parsed = transactionExportSchema.safeParse(payload);
  if (!parsed.success)
    return NextResponse.json({ message: 'Filter ekspor tidak valid.' }, { status: 400 });
  try {
    const rows = await exportOwnerTransactions(auth.tenantId, parsed.data, parsed.data.ids);
    if (parsed.data.ids && rows.length !== new Set(parsed.data.ids).size)
      return NextResponse.json(
        { message: 'Sebagian transaksi tidak tersedia untuk tenant ini.' },
        { status: 404 },
      );
    if (zipRequest && !parsed.data.ids?.length)
      return NextResponse.json({ message: 'Pilih transaksi untuk ZIP.' }, { status: 400 });
    const lines = [
      columns,
      ...rows.map((row) => [
        row.code,
        row.booth,
        row.outlet,
        row.packageName,
        row.amount,
        row.method,
        row.status,
        row.createdAt.toISOString(),
        row.paidAt?.toISOString() ?? '',
      ]),
    ];
    const content = lines.map((line) => line.map(csvCell).join(',')).join('\r\n');
    const headers = {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `attachment; filename="${zipRequest ? 'transaksi-snapbox.zip' : 'transaksi-snapbox.csv'}"`,
    };
    if (!zipRequest)
      return new Response(content, {
        headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
      });
    return new Response(zipFile(content), {
      headers: { ...headers, 'Content-Type': 'application/zip' },
    });
  } catch {
    return NextResponse.json(
      { message: 'Ekspor gagal. Coba kembali.' },
      { status: 500, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}

function zipFile(csv: string) {
  const encoder = new TextEncoder();
  const body = encoder.encode(csv);
  const name = encoder.encode('transaksi.csv');
  let crc = 0xffffffff;
  for (const byte of body) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  crc = (crc ^ 0xffffffff) >>> 0;
  const local = new Uint8Array(30 + name.length + body.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint32(14, crc, true);
  localView.setUint32(18, body.length, true);
  localView.setUint32(22, body.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);
  local.set(body, 30 + name.length);
  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint32(16, crc, true);
  centralView.setUint32(20, body.length, true);
  centralView.setUint32(24, body.length, true);
  centralView.setUint16(28, name.length, true);
  central.set(name, 46);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length, true);
  return new Blob([local, central, end], { type: 'application/zip' });
}
