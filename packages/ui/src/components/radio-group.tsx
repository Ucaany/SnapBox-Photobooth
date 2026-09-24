'use client';

import { Radio as RadioPrimitive } from '@base-ui/react/radio';
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group';
import { Circle } from 'lucide-react';

import * as React from 'react';

import { cn } from '../lib/cn';

function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('grid gap-2', className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioPrimitive.Root>) {
  // text-red-700 bukan text-red-500: di atas --background #dcebfe, red-500 hanya 3.15:1 (gagal WCAG AA 4.5:1), red-700 = 5.31:1.
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'inline-flex aspect-square size-4 items-center justify-center rounded-full border-2 border-border text-black focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none aria-invalid:border-red-700 aria-invalid:text-red-700 data-disabled:cursor-not-allowed data-disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <Circle className="size-2 fill-current text-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
