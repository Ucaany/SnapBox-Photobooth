'use client';

import * as React from 'react';

/**
 * State filter lokal untuk dataset contoh (PRD Task 1.3).
 *
 * Skeleton ini tidak punya backend, jadi filter/sort/search hanya bekerja pada
 * array di memori. Dipisah sebagai hook supaya tabel dengan filter berbeda
 * (tenant, invoice, device, promo, activity, security) memakai perilaku yang
 * sama, termasuk perhitungan "hasil kosong" untuk empty state.
 */

export interface FilterField<T> {
  /** Nilai filter aktif untuk kolom ini; `''` berarti semua. */
  readonly key: keyof T & string;
  readonly options: readonly string[];
}

export function useExampleFilter<T>(
  rows: readonly T[],
  fields: readonly FilterField<T>[],
  search?: (row: T) => string,
) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<Record<string, string>>({});

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();

    return rows.filter((row) => {
      for (const [key, value] of Object.entries(selected)) {
        if (value && String(row[key as keyof T]) !== value) return false;
      }
      if (needle && search && !search(row).toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, selected, query, search]);

  const activeCount = Object.values(selected).filter(Boolean).length + (query ? 1 : 0);

  function setFilter(key: keyof T & string, value: string) {
    setSelected((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setSelected({});
    setQuery('');
  }

  return { query, setQuery, selected, setFilter, filtered, activeCount, reset, fields };
}
