'use client';

import { Calendar, DataTableDemo } from '@snapbox/ui';
import { useState } from 'react';

/**
 * `DataTableDemo` dan `Calendar` dipisah ke berkas sendiri.
 *
 * `@tanstack/react-table` dan `react-day-picker` adalah dependency paling berat
 * di halaman ini. Berkas ini di-`lazy` dari `primitives-section.tsx` lewat
 * `next/dynamic` (`ssr: false`) supaya keduanya tidak ikut di jalur kritis `/`.
 */

export function DataTableBlock() {
  return (
    <div className="w-full min-w-0">
      <DataTableDemo />
    </div>
  );
}

export function CalendarBlock() {
  const [tanggal, setTanggal] = useState<Date | undefined>(undefined);

  return (
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
  );
}
