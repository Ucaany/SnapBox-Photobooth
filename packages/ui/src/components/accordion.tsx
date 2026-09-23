'use client';

import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

import { cn } from '../lib/cn';

/** Radix Accordion Root: `type="single" collapsible defaultValue` diteruskan apa adanya. */
export const Accordion = AccordionPrimitive.Root;

export const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b-[3px] border-snapbox-ink last:border-b-0', className)}
    {...props}
  />
));
AccordionItem.displayName = 'AccordionItem';

export const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'group flex flex-1 items-center justify-between gap-3 px-4 py-3 text-left',
        'font-display text-sm font-bold tracking-wide text-snapbox-ink uppercase',
        'transition-colors hover:bg-snapbox-surface',
        'focus-visible:ring-2 focus-visible:ring-snapbox-secondary focus-visible:outline-none',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
        'data-[state=open]:bg-snapbox-primary',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown
        aria-hidden
        className="h-5 w-5 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
AccordionTrigger.displayName = 'AccordionTrigger';

export const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn('overflow-hidden font-sans text-sm text-snapbox-ink', className)}
    {...props}
  >
    <div className="px-4 py-3">{children}</div>
  </AccordionPrimitive.Content>
));
AccordionContent.displayName = 'AccordionContent';
