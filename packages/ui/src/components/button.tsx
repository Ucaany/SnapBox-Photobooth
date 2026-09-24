import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import * as React from 'react';

import { cn } from '../lib/cn';

const buttonVariants = cva(
  // R-03: seluruh Button dapat tap target >= 44px tanpa mengubah tinggi kotak.
  // Pseudo-element transparan (h-11, terpusat) hanya memperluas area sentuh; varian
  // yang sudah >= 44px tidak terpengaruh karena berada di dalam area itu. Ini pola
  // "naikkan tap target tanpa mengubah tampilan visual" yang diminta untuk R-03.
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-base text-sm font-base ring-offset-white transition-all gap-2 before:absolute before:pointer-events-none before:inset-x-0 before:top-1/2 before:-mt-[22px] before:h-11 before:content-[""] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'text-main-foreground bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
        noShadow: 'text-main-foreground bg-main border-2 border-border',
        neutral:
          'bg-secondary-background text-foreground border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none',
        reverse:
          'text-main-foreground bg-main border-2 border-border hover:translate-x-reverseBoxShadowX hover:translate-y-reverseBoxShadowY hover:shadow-shadow',
      },
      // R-03 (PRD Bab 4 baris "tap target min 44x44px" + Bab 8.12 WCAG 2.2 AA
      // "touch target >= 44x44px"): tap target adalah mandat aksesibilitas produk,
      // jadi mengalahkan kesetiaan referensi neobrutalism.dev. Seluruh skala digeser
      // satu langkah (h-10->h-11, dst) agar tetap konsisten sebagai SATU skala dan
      // setiap kontrol utama >= 44px. Tidak memakai min-h-* karena min-h mengubah
      // tinggi kotak saat konten lebih pendek, sehingga tidak benar-benar menjaga
      // tinggi visual 40px seperti yang diasumsikan Opsi A.
      size: {
        default: 'h-11 px-4 py-2',
        xs: 'h-9 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-10 px-3',
        lg: 'h-12 px-8',
        icon: 'size-11',
        'icon-xs': 'size-9 [&_svg]:size-3.5',
        'icon-sm': 'size-10',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
