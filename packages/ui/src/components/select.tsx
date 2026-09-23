'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '../lib/cn';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

/** Trigger menerima `asChild` (passthrough Radix). */
export const SelectTrigger = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex min-h-11 w-full items-center justify-between gap-2 rounded-md border-[3px] border-snapbox-ink',
      'bg-snapbox-background px-3 py-2 font-sans text-sm text-snapbox-ink shadow-snapbox-sm',
      'transition-[transform,box-shadow] data-[placeholder]:text-snapbox-ink/50',
      'focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-snapbox-pressed',
      'focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
      'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
      'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown aria-hidden className="h-4 w-4 shrink-0" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border-[3px] border-snapbox-ink',
        'bg-snapbox-background text-snapbox-ink shadow-snapbox',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        position === 'popper' && 'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center">
        <ChevronUp aria-hidden className="h-4 w-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center">
        <ChevronDown aria-hidden className="h-4 w-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectLabel = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'px-2 py-1.5 font-display text-[11px] font-bold tracking-wide text-snapbox-ink/60 uppercase',
      className,
    )}
    {...props}
  />
));
SelectLabel.displayName = 'SelectLabel';

export const SelectItem = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer items-center rounded-sm py-2 pr-8 pl-3 font-sans text-sm outline-none select-none',
      'data-[highlighted]:bg-snapbox-primary data-[highlighted]:text-snapbox-ink',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-60',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 grid h-4 w-4 place-items-center">
      <SelectPrimitive.ItemIndicator>
        <Check aria-hidden className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

export const SelectSeparator = React.forwardRef<
  React.ComponentRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-[2px] bg-snapbox-ink', className)}
    {...props}
  />
));
SelectSeparator.displayName = 'SelectSeparator';
