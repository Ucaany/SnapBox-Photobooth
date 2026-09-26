/**
 * Pembacaan dan mutasi server Kiosk Theme Customizer (PRD Task 2.8).
 *
 * Semua query tenant-scoped dan TIDAK PERNAH menerima `tenantId` dari klien;
 * nilai itu selalu berasal dari `requireOwnerTenant`. Editor ini hanya mengelola
 * satu tema default tenant (`booth_id IS NULL`); tema per-booth, bila ada, tidak
 * disentuh.
 *
 * `kiosk_theme_versions` hanya menyimpan snapshot publikasi (maksimum lima).
 * Simpan draft biasa tidak menambah riwayat.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { getDatabase, kioskThemeVersions, kioskThemes } from '@snapbox/db';

import {
  summarizeVersion,
  type KioskThemeDraft,
  type KioskThemeRecord,
  type KioskThemeVersion,
  type KioskThemesData,
} from './kiosk-theme-contract';

/**
 * Field draft yang disimpan ke `kiosk_themes`. Semua field di sini punya kolom
 * nyata di schema, sehingga apa yang disimpan dapat dibaca kembali persis.
 */
const draftFields = [
  'logoUrl',
  'primaryColor',
  'accentColor',
  'backgroundColor',
  'fontFamily',
  'welcomeText',
  'ctaText',
  'attractModeType',
  'attractVideoUrl',
  'attractSlideshowEnabled',
  'panelStyle',
  'orientation',
] as const;

type ThemeRow = typeof kioskThemes.$inferSelect;

const snapshotOf = (row: ThemeRow): KioskThemeDraft =>
  Object.fromEntries(draftFields.map((field) => [field, row[field]])) as KioskThemeDraft;

const recordOf = (row: ThemeRow): KioskThemeRecord => ({
  ...snapshotOf(row),
  id: row.id,
  version: row.version,
  isPublished: row.isPublished,
  updatedAt: row.updatedAt.toISOString(),
});

/** Tema default tenant, dibuat sekali bila belum ada (idempoten via advisory lock). */
export async function getOrCreateOwnerKioskTheme(tenantId: string): Promise<KioskThemeRecord> {
  const db = getDatabase();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${tenantId}, 2))`);
    let [row] = await tx
      .select()
      .from(kioskThemes)
      .where(and(eq(kioskThemes.tenantId, tenantId), isNull(kioskThemes.boothId)))
      .limit(1);
    if (!row) {
      [row] = await tx.insert(kioskThemes).values({ tenantId, boothId: null }).returning();
    }
    if (!row) throw new Error('KIOSK_THEME_CREATE_FAILED');
    return recordOf(row);
  });
}

export async function loadOwnerKioskTheme(tenantId: string): Promise<KioskThemesData> {
  const theme = await getOrCreateOwnerKioskTheme(tenantId);
  const versions = await listOwnerKioskThemeVersions(tenantId);
  return { theme, versions };
}

export async function listOwnerKioskThemeVersions(tenantId: string): Promise<KioskThemeVersion[]> {
  const rows = await getDatabase()
    .select({
      id: kioskThemeVersions.id,
      snapshot: kioskThemeVersions.snapshot,
      createdAt: kioskThemeVersions.createdAt,
    })
    .from(kioskThemeVersions)
    .innerJoin(
      kioskThemes,
      and(
        eq(kioskThemeVersions.themeId, kioskThemes.id),
        eq(kioskThemes.tenantId, tenantId),
        isNull(kioskThemes.boothId),
      ),
    )
    .orderBy(desc(kioskThemeVersions.createdAt))
    .limit(5);
  // Nomor versi ditampilkan berurutan dari riwayat terbaru; snapshot lama tidak
  // menyimpan `version` sendiri, jadi urutan riwayat dipakai sebagai identitas.
  return rows.map((row, index) => {
    const summary = summarizeVersion(row.snapshot);
    return {
      id: row.id,
      version: index + 1,
      createdAt: row.createdAt.toISOString(),
      ...summary,
    };
  });
}

/** Simpan draft tanpa mengubah status publish atau menambah riwayat. */
export async function saveOwnerKioskTheme(
  tenantId: string,
  draft: KioskThemeDraft,
): Promise<KioskThemeRecord | null> {
  const persisted = persistedDraft(draft);
  const [row] = await getDatabase()
    .update(kioskThemes)
    .set({ ...persisted, updatedAt: new Date() })
    .where(and(eq(kioskThemes.tenantId, tenantId), isNull(kioskThemes.boothId)))
    .returning();
  return row ? recordOf(row) : null;
}

export type PublishResult = { theme: KioskThemeRecord; version: number } | null;

/**
 * Publikasi atomik: perbarui tema, tandai publish, simpan snapshot lengkap, lalu
 * pertahankan lima versi terbaru. Mengembalikan null bila tema tidak ditemukan
 * untuk tenant tersebut.
 */
export async function publishOwnerKioskTheme(
  tenantId: string,
  draft: KioskThemeDraft,
): Promise<PublishResult> {
  const persisted = persistedDraft(draft);
  const snapshot = { ...draft };
  return getDatabase().transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(kioskThemes)
      .where(and(eq(kioskThemes.tenantId, tenantId), isNull(kioskThemes.boothId)))
      .limit(1);
    if (!row) return null;
    const version = row.version + 1;
    const [updated] = await tx
      .update(kioskThemes)
      .set({ ...persisted, version, isPublished: true, updatedAt: new Date() })
      .where(and(eq(kioskThemes.id, row.id), eq(kioskThemes.tenantId, tenantId)))
      .returning();
    if (!updated) return null;
    await tx.insert(kioskThemeVersions).values({ themeId: row.id, snapshot });
    const history = await tx
      .select({ id: kioskThemeVersions.id })
      .from(kioskThemeVersions)
      .where(eq(kioskThemeVersions.themeId, row.id))
      .orderBy(desc(kioskThemeVersions.createdAt));
    const stale = history.slice(5).map((item) => item.id);
    if (stale.length)
      await tx
        .delete(kioskThemeVersions)
        .where(
          and(
            eq(kioskThemeVersions.themeId, row.id),
            sql`${kioskThemeVersions.id} = any(${stale})`,
          ),
        );
    return { theme: recordOf(updated), version };
  });
}

/**
 * Snapshot versi tenant-owned untuk dipulihkan ke draft. Tidak mengubah DB; aksi
 * pemulihan hanya mengembalikan draft agar pemilik dapat meninjau lalu simpan.
 */
export async function getOwnerKioskThemeVersion(
  tenantId: string,
  versionId: string,
): Promise<KioskThemeDraft | null> {
  const [row] = await getDatabase()
    .select({ snapshot: kioskThemeVersions.snapshot })
    .from(kioskThemeVersions)
    .innerJoin(
      kioskThemes,
      and(
        eq(kioskThemeVersions.themeId, kioskThemes.id),
        eq(kioskThemes.tenantId, tenantId),
        isNull(kioskThemes.boothId),
      ),
    )
    .where(eq(kioskThemeVersions.id, versionId))
    .limit(1);
  return (row?.snapshot as KioskThemeDraft | undefined) ?? null;
}

function persistedDraft(draft: KioskThemeDraft) {
  return {
    logoUrl: draft.logoUrl ?? null,
    primaryColor: draft.primaryColor,
    accentColor: draft.accentColor,
    backgroundColor: draft.backgroundColor,
    fontFamily: draft.fontFamily,
    welcomeText: draft.welcomeText ?? null,
    ctaText: draft.ctaText,
    attractModeType: draft.attractModeType,
    attractVideoUrl: draft.attractVideoUrl ?? null,
    attractSlideshowEnabled: draft.attractSlideshowEnabled,
    panelStyle: draft.panelStyle,
    orientation: draft.orientation,
  };
}
