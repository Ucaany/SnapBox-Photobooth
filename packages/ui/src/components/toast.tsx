'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, type LucideIcon } from 'lucide-react';

import { cn } from '../lib/cn';

/** Empat tingkat keparahan toast. `default` netral, sisanya memetakan ikon + warna. */
export type ToastVariant = 'default' | 'success' | 'danger' | 'warning';

/**
 * Opsi satu toast.
 *
 * `duration` 0 = persistent (tanpa auto-dismiss) — PRD line 234 mewajibkan
 * `danger` persistent supaya user sempat membaca kegagalan yang tidak bisa
 * dipulihkan, sedangkan `success` cukup 3 detik.
 */
export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

/** Toast tersimpan di state; `id` dibuat provider agar konsumen tak perlu mengurus. */
export interface Toast extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/**
 * Durasi default per varian. `danger` = 0 (persistent) sesuai PRD line 234;
 * varian lain 3 detik agar tidak menumpuk di layar kios.
 */
const defaultDuration = (variant: ToastVariant): number => (variant === 'danger' ? 0 : 3000);

const variantIcon: Record<ToastVariant, LucideIcon> = {
  default: Info,
  success: CheckCircle2,
  danger: XCircle,
  warning: AlertTriangle,
};

/** Border 4px + shadow hard: kontrak visual neobrutalism (PRD Bab 4). */
const variantSurface: Record<ToastVariant, string> = {
  default: 'bg-snapbox-background',
  success: 'bg-snapbox-success/20',
  danger: 'bg-snapbox-danger/20',
  warning: 'bg-snapbox-warning/25',
};

const variantIconColor: Record<ToastVariant, string> = {
  default: 'text-snapbox-secondary',
  success: 'text-snapbox-success',
  danger: 'text-snapbox-danger',
  warning: 'text-snapbox-warning',
};

/**
 * Kartu satu toast. Ikon + judul teks wajib ada supaya status tidak pernah
 * dibedakan lewat warna saja (WCAG 2.2 AA, aturan yang sama dengan Alert).
 */
const ToastCard = React.forwardRef<
  HTMLLIElement,
  { toast: Toast; onDismiss: (id: string) => void; role: 'status' | 'alert' }
>(({ toast, onDismiss, role }, ref) => {
  const reduceMotion = useReducedMotion();
  const variant = toast.variant ?? 'default';
  const Icon = variantIcon[variant];

  const dismiss = React.useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);

  return (
    <motion.li
      ref={ref}
      role={role}
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: reduceMotion ? 0 : 0.18, ease: 'easeOut' }}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-md border-[4px] border-snapbox-ink',
        'p-4 text-snapbox-ink shadow-snapbox',
        variantSurface[variant],
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 h-6 w-6 shrink-0', variantIconColor[variant])} />
      <div className="flex-1 space-y-1">
        <p className="font-display text-sm font-bold tracking-wide uppercase">{toast.title}</p>
        {toast.description !== undefined ? (
          <p className="font-sans text-sm">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup notifikasi"
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-md border-[3px] border-snapbox-ink bg-snapbox-background',
          'transition-[transform,box-shadow] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-snapbox-pressed',
          'focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
        )}
      >
        <X aria-hidden className="h-5 w-5" />
      </button>
    </motion.li>
  );
});
ToastCard.displayName = 'ToastCard';

/**
 * Menghidupkan satu timer auto-dismiss per toast.
 *
 * Dipisah jadi komponen sendiri supaya `AnimatePresence` tetap punya satu anak
 * per toast (kalau map + useEffect digabung, jumlah hook berubah saat toast
 * keluar dan melanggar aturan hooks). `duration` 0 berarti persistent.
 */
function ToastTimer({ toast, onDone }: { toast: Toast; onDone: (id: string) => void }) {
  const { id, duration } = toast;

  React.useEffect(() => {
    if (duration === 0) {
      return;
    }
    const timer = window.setTimeout(() => onDone(id), duration);
    return () => window.clearTimeout(timer);
  }, [id, duration, onDone]);

  return null;
}

/** Viewport default: bawah-kanan di desktop, atas di mobile (kios lebih ramah jempol). */
export function ToastViewport() {
  const context = React.useContext(ToastContext);
  const toasts = context?.toasts ?? [];
  const dismissToast = context?.dismissToast ?? (() => {});

  /**
   * `role="region"` + `aria-label`: satu live region tunggal, bukan per-toast,
   * supaya screen reader tidak mengumumkan ulang seluruh stack saat satu toast
   * berganti.
   */
  return (
    <div
      role="region"
      aria-label="Notifikasi"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-3 top-3 z-[100] flex flex-col items-end gap-3',
        'sm:inset-x-auto sm:top-auto sm:right-4 sm:bottom-4 sm:w-[min(24rem,calc(100vw-2rem))]',
      )}
    >
      <ol className="flex w-full flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <React.Fragment key={item.id}>
              <ToastTimer toast={item} onDone={dismissToast} />
              <ToastCard
                toast={item}
                onDismiss={dismissToast}
                role={item.variant === 'danger' ? 'alert' : 'status'}
              />
            </React.Fragment>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

/**
 * Provider toast global. Merender stack lewat portal ke `document.body` supaya
 * tidak terjebak stacking context/overflow parent — tapi hanya setelah mount,
 * sebab `document` tak ada saat SSR.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const dismissToast = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const dismissAll = React.useCallback(() => setToasts([]), []);

  const addToast = React.useCallback((options: ToastOptions) => {
    const variant = options.variant ?? 'default';
    const duration = options.duration ?? defaultDuration(variant);
    const id = options.title ? `${variant}:${options.title}:${Date.now()}` : crypto.randomUUID();

    const next: Toast = {
      id,
      title: options.title,
      variant,
      duration,
      ...(options.description !== undefined ? { description: options.description } : {}),
    };

    // ponytail: batas 3 toast terlihat (YAGNI, tanpa konfigurasi). Naikkan ke
    // limit per-provider kalau kios butuh antrean lebih panjang.
    setToasts((current) => [...current.slice(-2), next]);

    return id;
  }, []);

  const value = React.useMemo(
    () => ({ addToast, dismissToast, dismissAll, toasts }),
    [addToast, dismissToast, dismissAll, toasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted ? createPortal(<ToastViewport />, document.body) : null}
    </ToastContext.Provider>
  );
}

/**
 * Akses API toast. Wajib dipanggil di bawah `<ToastProvider>`; kalau tidak,
 * error dilempar eksplisit supaya kesalahan pemasangan langsung ketahuan,
 * bukan toast yang diam-diam hilang.
 */
export function useToast(): {
  toast: (options: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
} {
  const context = React.useContext(ToastContext);

  if (context === null) {
    throw new Error('useToast harus dipakai di dalam <ToastProvider>. Bungkus root layout dulu.');
  }

  return { toast: context.addToast, dismiss: context.dismissToast, dismissAll: context.dismissAll };
}
