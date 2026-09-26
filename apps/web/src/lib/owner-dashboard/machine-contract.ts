/**
 * Kontrak Machine Manager (PRD Task 2.3, Bab 6.B/6.K).
 *
 * Berkas ini adalah batas kepercayaan untuk modul mesin: schema Zod, tipe
 * serializable, kode error aman, dan encoder QR. Ia sengaja TIDAK mengimpor
 * `@snapbox/db`/`next/*` supaya dapat dipakai server action, route handler,
 * komponen klien, dan test Node tanpa ikut menarik runtime server.
 *
 * Aturan yang mengikat:
 * - `tenantId` TIDAK PERNAH datang dari klien; selalu diturunkan dari sesi.
 * - Kode pairing tidak pernah dikembalikan lagi setelah sesi dibuat, dan server
 *   hanya menyimpan hash (ADR-001).
 * - UUID divalidasi sebelum menyentuh DB; id lintas tenant berakhir 404/NOT_FOUND
 *   yang tidak bisa dibedakan dari id tidak ada (PRD Bab 5.5).
 */
import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }, z.string().max(max).nullable().optional());

/** Bentuk UUID kanonik; satu tempat agar tidak ada pola kedua. */
export const machineIdSchema = z.string().uuid();

export const boothStatusSchema = z.enum(['UNPAIRED', 'ONLINE', 'OFFLINE', 'MAINTENANCE']);

export const createBoothInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama booth wajib diisi.').max(150),
  outletId: z.preprocess((v) => (v === '' ? null : v), machineIdSchema.nullable().optional()),
  locationTag: optionalText(150),
});
export type CreateBoothInput = z.infer<typeof createBoothInputSchema>;

export const updateBoothInputSchema = createBoothInputSchema.extend({
  id: machineIdSchema,
  paperCount: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().min(0).max(100000).optional(),
  ),
  paperCapacity: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().min(1).max(100000).optional(),
  ),
  maintenanceMode: z.boolean().optional(),
});
export type UpdateBoothInput = z.infer<typeof updateBoothInputSchema>;

export const updateBoothPackageInputSchema = z.object({
  packageId: machineIdSchema,
  price: z
    .string()
    .trim()
    .regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Harga harus berupa angka rupiah tanpa simbol.'),
});
export type UpdateBoothPackageInput = z.infer<typeof updateBoothPackageInputSchema>;

export const setPinLockInputSchema = z.object({
  boothId: machineIdSchema,
  enabled: z.boolean(),
  pin: z.preprocess(
    (v) => (v === '' ? null : v),
    z
      .string()
      .regex(/^\d{6}$/, 'PIN harus tepat 6 digit.')
      .nullable()
      .optional(),
  ),
});
export type SetPinLockInput = z.infer<typeof setPinLockInputSchema>;

export const createPairingSessionInputSchema = z.object({
  boothId: machineIdSchema,
});
export type CreatePairingSessionInput = z.infer<typeof createPairingSessionInputSchema>;

export const machineActionErrorCodes = [
  'INVALID_INPUT',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'LIMIT_REACHED',
  'LIMIT_REACHED',
  'CONFLICT',
  'SERVER_ERROR',
] as const;

export type MachineActionResult =
  | { readonly ok: true; readonly message: string; readonly boothId?: string }
  | {
      readonly ok: false;
      readonly code:
        | 'INVALID_INPUT'
        | 'UNAUTHORIZED'
        | 'NOT_FOUND'
        | 'LIMIT_REACHED'
        | 'CONFLICT'
        | 'SERVER_ERROR';
      readonly message: string;
      readonly fieldErrors?: Record<string, string>;
    };

export type PairingSessionResult =
  | {
      readonly ok: true;
      readonly boothId: string;
      readonly expiresAt: string;
      readonly qrDataUrl: string;
      readonly manualCode: string | null;
    }
  | {
      readonly ok: false;
      readonly code:
        | 'INVALID_INPUT'
        | 'UNAUTHORIZED'
        | 'NOT_FOUND'
        | 'LIMIT_REACHED'
        | 'CONFLICT'
        | 'SERVER_ERROR';
      readonly message: string;
    };

/** Sesi kiosk ringkas untuk tabel riwayat; hanya field aman. */
export type BoothSessionRow = {
  id: string;
  state: string;
  actor: string | null;
  enterAt: string;
  exitAt: string | null;
  durationMs: number | null;
};

/** Paket booth: override khusus booth atau paket tenant yang diwarisi. */
export type BoothPackageRow = {
  id: string;
  name: string;
  price: string;
  isOverride: boolean;
  isActive: boolean;
};

export type MachineListRow = {
  id: string;
  name: string;
  outletId: string | null;
  outletName: string | null;
  locationTag: string | null;
  status: string;
  /** Status tampilan turunan: heartbeat basi dipaksa OFFLINE (PRD Bab 6.B). */
  displayStatus: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'UNPAIRED';
  lastHeartbeatAt: string | null;
  paperCount: number;
  paperCapacity: number;
  maintenanceMode: boolean;
  pinLockEnabled: boolean;
  deviceFingerprintMasked: string | null;
  appVersion: string | null;
  platform: string | null;
};

export type MachineDetail = {
  id: string;
  name: string;
  outletId: string | null;
  outletName: string | null;
  locationTag: string | null;
  status: string;
  displayStatus: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'UNPAIRED';
  deviceFingerprintMasked: string | null;
  lastHeartbeatAt: string | null;
  paperCount: number;
  paperCapacity: number;
  paperAlertThresholdPct: number;
  maintenanceMode: boolean;
  pinLockEnabled: boolean;
  appVersion: string | null;
  platform: string | null;
  createdAt: string;
  packages: BoothPackageRow[];
  sessions: BoothSessionRow[];
};

export type MachineListData = {
  booths: MachineListRow[];
  quota: { used: number; limit: number | null };
  outlets: { id: string; name: string }[];
};

/** Ambang offline heartbeat, detik (PRD Bab 6.B). */
export const HEARTBEAT_OFFLINE_SECONDS = 90;

/**
 * Menurunkan status tampilan dari status tersimpan + kesegaran heartbeat.
 * Tidak pernah mengarang ONLINE: heartbeat basi selalu turun ke OFFLINE.
 */
export function deriveDisplayStatus(
  status: string,
  lastHeartbeatAt: string | null,
  maintenanceMode: boolean,
  nowMs: number = Date.now(),
): MachineListRow['displayStatus'] {
  if (status === 'UNPAIRED') return 'UNPAIRED';
  if (maintenanceMode) return 'MAINTENANCE';
  if (status !== 'ONLINE') return 'OFFLINE';
  if (!lastHeartbeatAt) return 'OFFLINE';
  const age = (nowMs - new Date(lastHeartbeatAt).getTime()) / 1000;
  return age > HEARTBEAT_OFFLINE_SECONDS ? 'OFFLINE' : 'ONLINE';
}

/** Menyamarkan fingerprint agar identitas perangkat penuh tidak ikut tercetak. */
export function maskFingerprint(fingerprint: string | null): string | null {
  if (!fingerprint) return null;
  return `${fingerprint.slice(0, 8)}…${fingerprint.slice(-4)}`;
}

export function fieldErrors(error: z.ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]),
  );
}

export function safeMachineError(
  code: Extract<MachineActionResult, { ok: false }>['code'],
  message: string,
  fields?: Record<string, string>,
): MachineActionResult {
  return { ok: false, code, message, ...(fields ? { fieldErrors: fields } : {}) };
}

// ============ QR ENCODER (dependency-free) ============
//
// Pairing QR tidak boleh memuat kredensial perangkat yang bisa dipakai ulang;
// isinya hanya URL halaman pairing + kode/sesi sekali pakai. Encoder kecil ini
// menghindari menambah dependensi QR ke repo untuk satu kebutuhan.

/**
 * [dataCodewords, ecCodewords] per versi, EC level L. Total codewords versi v
 * adalah data + ec dan keduanya harus konsisten dengan spesifikasi QR ISO/IEC
 * 18004 (satu blok untuk versi 1–10 pada level L).
 */
const EC_CODEWORDS: Record<number, [number, number]> = {
  1: [19, 7],
  2: [34, 10],
  3: [55, 15],
  4: [80, 20],
  5: [108, 26],
  6: [136, 18],
  7: [156, 20],
  8: [194, 24],
  9: [232, 30],
  10: [274, 18],
};
const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};
const FORMAT_EC_LEVEL = 1; // L
const FORMAT_MASK = 2;

/** Generator Galois Field GF(256) untuk Reed-Solomon. */
function gfTables() {
  const exp = new Uint8Array(512);
  const log = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) exp[i] = exp[i - 255]!;
  return { exp, log };
}
const GF = gfTables();

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i += 1) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j += 1) {
      const coefficient = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ coefficient;
      next[j + 1] = (next[j + 1] ?? 0) ^ (GF.exp[(GF.log[coefficient] ?? 0) + i] ?? 0);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: Uint8Array, ecCount: number): Uint8Array {
  const generator = rsGenerator(ecCount);
  const result = new Uint8Array(ecCount);
  for (const byte of data) {
    const factor = byte ^ (result[0] ?? 0);
    result.copyWithin(0, 1);
    result[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < ecCount; i += 1) {
        const generatorByte = generator[i + 1] ?? 0;
        const product = (GF.log[generatorByte] ?? 0) + (GF.log[factor] ?? 0);
        result[i] = (result[i] ?? 0) ^ (GF.exp[product] ?? 0);
      }
    }
  }
  return result;
}

function maskBit(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
  }
}

function bchFormat(bits: number): number {
  let value = bits << 10;
  for (let i = 0; i < 5; i += 1) {
    if (value & (1 << (14 - i))) value ^= 0b10100110111 << (4 - i);
  }
  return (bits << 10) | value;
}

/**
 * Meng-encode teks menjadi matriks modul QR versi 1–10 EC level L.
 * @throws Error bila pesan melebihi kapasitas versi 10.
 */
function encodeQrModules(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);

  let version = 0;
  let dataCodewords = 0;
  let ecCount = 0;
  for (let v = 1; v <= 10; v += 1) {
    const [dc, ec] = EC_CODEWORDS[v]!;
    const capacity = dc - 2; // mode(4 bit) + panjang(8 bit) = 12 bit
    if (bytes.length <= capacity) {
      version = v;
      dataCodewords = dc;
      ecCount = ec;
      break;
    }
  }
  if (!version) throw new Error('Payload QR melebihi kapasitas yang didukung.');

  // Bit stream: mode byte (0100) + panjang 8 bit + data + terminator.
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, dataCodewords * 8 - bits.length));

  const capacityBits = dataCodewords * 8;
  for (let i = 0; bits.length % 8 !== 0 && bits.length < capacityBits; i += 1) bits.push(0);
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (bits.length < capacityBits) {
    push(padBytes[padIndex % 2]!, 8);
    padIndex += 1;
  }

  const data = new Uint8Array(dataCodewords);
  for (let i = 0; i < dataCodewords; i += 1) {
    let byte = 0;
    for (let b = 0; b < 8; b += 1) byte = (byte << 1) | bits[i * 8 + b]!;
    data[i] = byte;
  }

  const codewords = new Uint8Array(dataCodewords + ecCount);
  codewords.set(data, 0);
  codewords.set(rsEncode(data, ecCount), dataCodewords);

  const size = version * 4 + 17;
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );

  const setFunction = (row: number, col: number, dark: boolean) => {
    if (row < 0 || col < 0 || row >= size || col >= size) return;
    modules[row]![col] = dark;
    reserved[row]![col] = true;
  };

  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const inRing = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inRing &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFunction(row + r, col + c, dark);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    setFunction(6, i, i % 2 === 0);
    setFunction(i, 6, i % 2 === 0);
  }

  const align = ALIGNMENT_POSITIONS[version]!;
  for (const r of align) {
    for (const c of align) {
      // Hanya tiga pusat yang menimpa finder yang dilewati. Memakai pita
      // koordinat (mis. r<=8) akan salah membuang alignment sah di baris/kolom 6.
      const overlapsFinder =
        (r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6);
      if (overlapsFinder) continue;
      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunction(r + dr, c + dc, dark);
        }
      }
    }
  }

  setFunction(size - 8, 8, true); // modul gelap tetap

  // Format info: 15 bit, ditempatkan dua salinan.
  const format = bchFormat((FORMAT_EC_LEVEL << 3) | FORMAT_MASK);
  const formatBits = (format ^ 0b101010000010010) & 0x7fff;
  const formatPositions: [number, number][] = [
    [8, 0],
    [8, 1],
    [8, 2],
    [8, 3],
    [8, 4],
    [8, 5],
    [8, 7],
    [8, 8],
    [7, 8],
    [5, 8],
    [4, 8],
    [3, 8],
    [2, 8],
    [1, 8],
    [0, 8],
  ];
  for (let i = 0; i < 15; i += 1) {
    const dark = ((formatBits >> (14 - i)) & 1) === 1;
    setFunction(formatPositions[i]![1], formatPositions[i]![0], dark);
    if (i < 7) {
      setFunction(i, size - 8, dark);
    } else if (i === 7) {
      setFunction(size - 1 - (i - 7), size - 8, dark);
    } else {
      setFunction(size - 15 + i, 8, dark);
    }
  }
  setFunction(size - 8, 8, true);

  // Data placement: pola zig-zag kolom dari kanan, melewati kolom timing.
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (let i = 0; i < size; i += 1) {
      const row = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (reserved[row]![c]) continue;
        let dark = false;
        if (bitIndex < totalBits) {
          dark = ((codewords[bitIndex >> 3]! >> (7 - (bitIndex & 7))) & 1) === 1;
        }
        modules[row]![c] = dark !== maskBit(FORMAT_MASK, row, c);
        bitIndex += 1;
      }
    }
    upward = !upward;
  }

  return modules.map((row) => row.map((cell) => cell === true));
}

/**
 * Membuat PNG data URL dari teks QR. Tanpa dependensi: encoder QR + PNG minimal.
 * @param text Isi QR (URL pairing + kode sekali pakai).
 * @param targetModules Lebar matriks target, dibulatkan ke bilangan ganjil.
 */
export function qrPngDataUrl(text: string, targetModules = 41): string {
  const modules = encodeQrModules(text);
  const size = modules.length;
  const quietZone = 4;
  const scale = Math.max(1, Math.ceil((targetModules - quietZone * 2) / size));
  const pixels = (size + quietZone * 2) * scale;

  const raw = new Uint8Array(pixels * (pixels * 4 + 1));
  let offset = 0;
  for (let y = 0; y < pixels; y += 1) {
    raw[offset] = 0; // filter type 0
    offset += 1;
    const moduleRow = Math.floor(y / scale) - quietZone;
    for (let x = 0; x < pixels; x += 1) {
      const moduleCol = Math.floor(x / scale) - quietZone;
      const dark =
        moduleRow >= 0 &&
        moduleCol >= 0 &&
        moduleRow < size &&
        moduleCol < size &&
        modules[moduleRow]![moduleCol]!;
      const value = dark ? 0 : 255;
      raw[offset] = value;
      raw[offset + 1] = value;
      raw[offset + 2] = value;
      raw[offset + 3] = 255;
      offset += 4;
    }
  }

  const idat = zlibDeflate(raw);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, pixels);
  view.setUint32(4, pixels);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const png = concatBytes([
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', new Uint8Array(0)),
  ]);

  return `data:image/png;base64,${bytesToBase64(png)}`;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const body = concatBytes([typeBytes, data]);
  const chunk = new Uint8Array(body.length + 8);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(body, 4);
  view.setUint32(chunk.length - 4, crc32(body));
  return chunk;
}

/**
 * Deflate tersimpan (stored/uncompressed). PNG valid meski bukan kompresi
 * optimal; menghindari implementasi kompresi zlib penuh di repo.
 */
function zlibDeflate(input: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = [];
  const header = new Uint8Array([0x78, 0x01]);
  blocks.push(header);

  const maxBlock = 65535;
  for (let offset = 0; offset < input.length || input.length === 0; offset += maxBlock) {
    const chunk = input.subarray(offset, Math.min(offset + maxBlock, input.length));
    const stored = new Uint8Array(chunk.length + 5);
    stored[0] = offset + maxBlock >= input.length ? 0x01 : 0x00;
    stored[1] = chunk.length & 0xff;
    stored[2] = (chunk.length >> 8) & 0xff;
    stored[3] = ~chunk.length & 0xff;
    stored[4] = (~chunk.length >> 8) & 0xff;
    stored.set(chunk, 5);
    blocks.push(stored);
    if (input.length === 0) break;
  }

  const adler = new Uint8Array(4);
  const view = new DataView(adler.buffer);
  view.setUint32(0, adler32(input));
  blocks.push(adler);

  return concatBytes(blocks);
}

function adler32(input: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of input) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
