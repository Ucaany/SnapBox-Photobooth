'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '../lib/cn';

/** Radix Tabs Root: `defaultValue`, `value`, `onValueChange` diteruskan apa adanya. */
export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex flex-wrap items-stretch gap-1 border-b-[3px] border-snapbox-ink',
      className,
    )}
    {...props}
  />
));
TabsList.displayName = 'TabsList';

/** Trigger: teks ink, aktif = highlight kuning + underline 3px. */
export const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative -mb-[3px] inline-flex min-h-11 items-center justify-center border-b-[3px] border-transparent px-4 py-2',
      'font-display text-sm font-bold tracking-wide text-snapbox-ink/60 uppercase transition-colors',
      'hover:bg-snapbox-surface hover:text-snapbox-ink',
      'data-[state=active]:border-snapbox-ink data-[state=active]:bg-snapbox-primary data-[state=active]:text-snapbox-ink',
      'focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
      'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
      'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = 'TabsContent';
