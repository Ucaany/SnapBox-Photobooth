'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

/**
 * Kartu neobrutalism: border 4px ink, shadow 6px, latar warm white, sudut
 * `rounded-lg` (maksimal sedang — hindari rounded berlebihan, PRD Bab 4).
 */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border-4 border-snapbox-ink bg-snapbox-background text-snapbox-ink',
        'shadow-snapbox',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

/** Header kartu dengan pemisah bawah 3px. */
export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col gap-1.5 border-b-[3px] border-snapbox-ink p-5', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

/** Judul kartu: Space Grotesk, tebal, tracking rapat. */
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('font-display text-lg font-bold tracking-[-0.02em]', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

/** Badan kartu. */
export const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-5', className)} {...props} />,
);
CardBody.displayName = 'CardBody';

/** Footer kartu dengan pemisah atas 3px. */
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-3 border-t-[3px] border-snapbox-ink p-5', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
