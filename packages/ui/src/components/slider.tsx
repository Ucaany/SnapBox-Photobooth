'use client';

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

import { cn } from '../lib/cn';

/**
 * Slider: track tebal ink, thumb kotak 24x24 border putih (PRD Bab 4).
 * Mendukung multi-thumb: jumlah thumb mengikuti `value`/`defaultValue`.
 * `thumbLabels` memberi nama aksesibel per thumb (default `Nilai n`).
 * Tap target kecil; untuk kiosk bungkus dengan padding sentuh sendiri.
 */
export const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    /** Label aksesibel per thumb; default `Nilai n`. */
    thumbLabels?: readonly string[];
  }
>(({ className, thumbLabels, ...props }, ref) => {
  const values = props.value ?? props.defaultValue ?? [0];

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        'relative flex w-full touch-none items-center select-none',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-none border-[3px] border-snapbox-ink bg-snapbox-ink">
        <SliderPrimitive.Range className="absolute h-full bg-snapbox-primary" />
      </SliderPrimitive.Track>
      {values.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels?.[index] ?? `Nilai ${index + 1}`}
          className={cn(
            'block h-6 w-6 rounded-none border-2 border-white bg-snapbox-ink shadow-snapbox-pressed',
            'transition-transform hover:scale-110',
            'focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = 'Slider';
