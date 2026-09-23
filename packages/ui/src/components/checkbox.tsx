'use client';

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox';
import { Check } from 'lucide-react';

import * as React from 'react';

import { cn } from '../lib/cn';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer flex size-4 shrink-0 items-center justify-center ring-offset-white outline-2 outline-border focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:outline-hidden aria-invalid:outline-red-500 data-checked:bg-main data-checked:text-white data-disabled:cursor-not-allowed data-disabled:opacity-50 data-indeterminate:bg-main data-indeterminate:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className={cn('flex items-center justify-center text-current')}
      >
        <Check className="size-4 text-main-foreground" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
