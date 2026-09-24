'use client';

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../lib/cn';

const toggleVariants = cva(
  // R-03: tap target >= 44px tanpa mengubah kotak (lihat catatan di button.tsx).
  'group/toggle relative inline-flex items-center justify-center gap-1 rounded-base border-2 border-border text-sm font-heading whitespace-nowrap transition-all outline-none ring-offset-white before:absolute before:pointer-events-none before:inset-x-0 before:top-1/2 before:-mt-[22px] before:h-11 before:content-[""] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-disabled:pointer-events-none data-disabled:opacity-50 aria-pressed:bg-main aria-pressed:text-main-foreground data-pressed:bg-main data-pressed:text-main-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-secondary-background text-foreground',
        outline: 'bg-secondary-background text-foreground',
      },
      // R-03: skala digeser satu langkah mengikuti Button agar tap target >= 44px.
      size: {
        default:
          'h-11 min-w-11 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
        sm: "h-10 min-w-10 px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: 'h-12 min-w-12 px-4 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Toggle({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
