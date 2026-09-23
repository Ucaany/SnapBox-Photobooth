'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

/**
 * Badge pill: border 2px, uppercase kecil. Warna tidak pernah jadi satu-satunya
 * pembeda status (PRD Bab 4) — konsumen wajib menyertakan ikon/label teks.
 */
export const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 rounded-full border-2 border-snapbox-ink',
    'px-2.5 py-0.5 font-display text-[11px] font-bold uppercase leading-none tracking-wide',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snapbox-secondary',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
  ].join(' '),
  {
    variants: {
      tone: {
        success: '',
        warning: '',
        danger: '',
        neutral: '',
        accent: '',
      },
      variant: {
        solid: '',
        outline: 'bg-transparent',
      },
    },
    compoundVariants: [
      { tone: 'success', variant: 'solid', class: 'bg-snapbox-success text-white' },
      { tone: 'success', variant: 'outline', class: 'text-snapbox-success' },
      { tone: 'warning', variant: 'solid', class: 'bg-snapbox-warning text-snapbox-ink' },
      { tone: 'warning', variant: 'outline', class: 'text-snapbox-warning' },
      { tone: 'danger', variant: 'solid', class: 'bg-snapbox-danger text-white' },
      { tone: 'danger', variant: 'outline', class: 'text-snapbox-danger' },
      { tone: 'neutral', variant: 'solid', class: 'bg-snapbox-surface text-snapbox-ink' },
      { tone: 'neutral', variant: 'outline', class: 'text-snapbox-ink' },
      { tone: 'accent', variant: 'solid', class: 'bg-snapbox-accent text-white' },
      { tone: 'accent', variant: 'outline', class: 'text-snapbox-accent' },
    ],
    defaultVariants: {
      tone: 'neutral',
      variant: 'solid',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ tone, variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';
