'use client';

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@snapbox/ui';
import * as React from 'react';

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@snapbox/ui';

import { type FilterField, useExampleFilter } from './use-example-filter';

/**
 * Tabel data contoh yang dapat difilter (PRD Task 1.3).
 *
 * Tiga state wajib R-27 disediakan dan dapat benar-benar dipicu:
 * - `loading`: tombol "Muat ulang" memutar spinner selama 700 ms,
 * - `error`: tombol "Coba lagi" disimulasikan gagal sekali, lalu berhasil,
 * - `empty`: filter/search yang tidak menghasilkan baris.
 *
 * Skeleton tidak memanggil backend; state di sini simulasi lokal yang jujur,
 * bukan pura-pura fetch.
 */
export interface ExampleColumn<T> {
  readonly key: string;
  readonly header: string;
  readonly render: (row: T) => React.ReactNode;
  readonly mono?: boolean;
}

export interface ExampleTableProps<T> {
  readonly rows: readonly T[];
  readonly columns: readonly ExampleColumn<T>[];
  readonly fields: readonly FilterField<T>[];
  readonly search?: (row: T) => string;
  readonly searchLabel?: string;
  readonly filterLabel?: string;
  readonly subject: string;
  /** Label satuan baris untuk empty state, mis. "tenant". */
  readonly itemNoun: string;
}

export function ExampleTable<T>({
  rows,
  columns,
  fields,
  search,
  searchLabel = 'Cari',
  filterLabel = 'Filter',
  subject,
  itemNoun,
}: ExampleTableProps<T>) {
  const { query, setQuery, selected, setFilter, filtered, activeCount, reset } = useExampleFilter(
    rows,
    fields,
    search,
  );

  const [status, setStatus] = React.useState<'idle' | 'loading' | 'error' | 'ok'>('idle');

  function simulateReload(outcome: 'ok' | 'error') {
    setStatus('loading');
    window.setTimeout(() => setStatus(outcome), 700);
  }

  return (
    <div className="ceo-table-wrap">
      <div className="ceo-toolbar">
        {search ? (
          <div className="ceo-field ceo-field-search">
            <label className="ceo-label" htmlFor={`${subject}-search`}>
              {searchLabel}
            </label>
            <Input
              id={`${subject}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Cari ${itemNoun}`}
              autoComplete="off"
            />
          </div>
        ) : null}

        {fields.map((field) => (
          <div className="ceo-field" key={field.key}>
            <label className="ceo-label" htmlFor={`${subject}-${field.key}`}>
              {filterLabel} {field.key}
            </label>
            <Select
              value={selected[field.key] ?? ''}
              onValueChange={(value) => setFilter(field.key, value ?? '')}
            >
              <SelectTrigger id={`${subject}-${field.key}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Semua</SelectItem>
                {field.options.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <div className="ceo-toolbar-actions">
          <Button
            type="button"
            variant="neutral"
            size="default"
            onClick={() => simulateReload('ok')}
            disabled={status === 'loading'}
          >
            Muat ulang
          </Button>
          <Button
            type="button"
            variant="reverse"
            size="default"
            onClick={() => simulateReload('error')}
            disabled={status === 'loading'}
          >
            Simulasikan gagal
          </Button>
          {activeCount > 0 ? (
            <Button type="button" variant="noShadow" size="default" onClick={reset}>
              Reset ({activeCount})
            </Button>
          ) : null}
        </div>
      </div>

      {status === 'loading' ? (
        <div className="ceo-table-state" role="status" aria-live="polite">
          <Spinner />
          <p>Memuat {itemNoun} contoh...</p>
        </div>
      ) : status === 'error' ? (
        <div className="ceo-table-state" role="alert">
          <p className="ceo-table-state-title">Gagal memuat {itemNoun} contoh.</p>
          <p>Ini simulasi state error, bukan kegagalan nyata. Tidak ada permintaan jaringan.</p>
          <Button
            type="button"
            variant="default"
            size="default"
            onClick={() => simulateReload('ok')}
          >
            Coba lagi
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Tidak ada {itemNoun} yang cocok</EmptyTitle>
            <EmptyDescription>
              Ubah kata kunci atau kosongkan filter untuk melihat seluruh data contoh.
            </EmptyDescription>
          </EmptyHeader>
          <Button type="button" variant="neutral" size="default" onClick={reset}>
            Kosongkan filter
          </Button>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  scope="col"
                  className={column.mono ? 'ceo-mono' : undefined}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.mono ? 'ceo-mono' : undefined}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <p className="ceo-table-count" role="status">
        Menampilkan {filtered.length} dari {rows.length} baris data contoh.
      </p>
    </div>
  );
}
