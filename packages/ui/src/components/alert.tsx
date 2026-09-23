'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleCheck, CircleX, Info, TriangleAlert, X } from 'lucide-react';

import { cn } from '../lib/cn';

/**
 * Alert neobrutalism: border 4px + ikon severity besar (PRD Bab 4).
 * Status TIDAK boleh dibedakan lewat warna saja — selalu ada ikon + judul teks.
 */
export const alertVariants = cva(
  [
    'relative flex items-start gap-3 rounded-lg border-4 border-snapbox-ink p-4',
    'shadow-snapbox-sm text-snapbox-ink',
    'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1',
  ].join(' '),
  {
    variants: {
      variant: {
        info: 'bg-snapbox-background',
        success: 'bg-snapbox-background',
        warning: 'bg-snapbox-warning/20',
        destructive: 'bg-snapbox-danger/15',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

const severityIcon = {
  success: CircleCheck,
  warning: TriangleAlert,
  destructive: CircleX,
  info: Info,
} as const;

const severityIconColor = {
  success: 'text-snapbox-success',
  warning: 'text-snapbox-warning',
  destructive: 'text-snapbox-danger',
  info: 'text-snapbox-secondary',
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  /** Judul tebal; opsional — bila kosong, `children` jadi isi utama. */
  title?: string;
  /** Menampilkan tombol tutup. */
  dismissible?: boolean;
  /** Override durasi auto-dismiss (ms). Default: 3000 hanya untuk `success`. */
  autoDismissMs?: number;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    { className, variant = 'info', title, dismissible = false, autoDismissMs, children, ...props },
    ref,
  ) => {
    const [open, setOpen] = React.useState(true);

    // PRD Bab 4: success auto-dismiss 3s (persistent untuk danger).
    const timeoutMs = autoDismissMs ?? (variant === 'success' ? 3000 : undefined);

    React.useEffect(() => {
      if (timeoutMs === undefined || !open) {
        return;
      }
      const timer = window.setTimeout(() => setOpen(false), timeoutMs);
      return () => window.clearTimeout(timer);
    }, [timeoutMs, open]);

    if (!open) {
      return null;
    }

    const Icon = severityIcon[variant ?? 'info'];

    return (
      <div
        ref={ref}
        role="alert"
        data-state="open"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <Icon
          aria-hidden
          className={cn('mt-0.5 h-6 w-6 shrink-0', severityIconColor[variant ?? 'info'])}
        />
        <div className="flex-1 space-y-1">
          {title !== undefined ? (
            <p className="font-display text-sm font-bold tracking-wide uppercase">{title}</p>
          ) : null}
          {children ? <div className="font-sans text-sm">{children}</div> : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup"
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-md border-[3px] border-snapbox-ink bg-snapbox-background',
              'transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-snapbox-pressed',
              'focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
            )}
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    );
  },
);
Alert.displayName = 'Alert';
