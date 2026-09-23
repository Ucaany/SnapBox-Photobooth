'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

/** Pembungkus tabel: overflow horizontal aman di mobile. */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto rounded-lg border-4 border-snapbox-ink shadow-snapbox">
    <table
      ref={ref}
      className={cn('w-full border-collapse text-sm text-snapbox-ink', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('bg-snapbox-primary', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />);
TableBody.displayName = 'TableBody';

/** Zebra: baris genap cream (`surface`), ganjil warm white (`background`). */
export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn('odd:bg-snapbox-background even:bg-snapbox-surface', className)}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'border-[3px] border-snapbox-ink px-3 py-2.5 text-left font-display text-xs font-bold tracking-wide uppercase',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('border-[3px] border-snapbox-ink px-3 py-2.5 align-middle', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
