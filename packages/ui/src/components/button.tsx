'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Varian tombol neobrutalism (PRD Bab 4).
 *
 * Aturan wajib: border 3px ink, hard shadow 4px, hover turun (2px, 2px) dengan
 * shadow mengecil ke 2px, `rounded-md` maksimal. Focus ring violet 2px agar
 * selalu terlihat di atas warna apa pun.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'border-[3px] border-snapbox-ink font-display font-bold uppercase tracking-[-0.01em]',
    'shadow-snapbox-sm transition-[transform,box-shadow]',
    'hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-snapbox-pressed',
    'active:translate-x-[2px] active:translate-y-[2px] active:shadow-snapbox-pressed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snapbox-secondary',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
    'disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0',
    'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-snapbox-primary text-snapbox-ink',
        secondary: 'bg-snapbox-secondary text-white',
        destructive: 'bg-snapbox-danger text-white',
        outline: 'bg-snapbox-background text-snapbox-ink',
        ghost:
          'border-transparent bg-transparent shadow-none hover:translate-x-0 hover:translate-y-0 hover:bg-snapbox-surface hover:shadow-none',
        link: 'border-transparent bg-transparent text-snapbox-ink underline underline-offset-4 shadow-none hover:translate-x-0 hover:translate-y-0 hover:shadow-none',
      },
      size: {
        sm: 'min-h-11 px-3 py-1.5 text-xs',
        default: 'min-h-11 px-5 py-2.5 text-sm',
        lg: 'min-h-12 px-7 py-3 text-base',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Menampilkan spinner dan menonaktifkan tombol. */
  loading?: boolean;
  /** Render sebagai child (mis. `<a>`) via Radix Slot. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, loading = false, asChild = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';

    if (asChild) {
      return (
        <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Comp>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
