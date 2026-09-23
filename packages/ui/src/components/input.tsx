'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '../lib/cn';

/** Class dasar field: border 3px, bg warm white, fokus ring violet 2px + shadow turun. */
const fieldBase = [
  'w-full rounded-md border-[3px] border-snapbox-ink bg-snapbox-background text-snapbox-ink',
  'font-sans text-sm shadow-snapbox-sm transition-[transform,box-shadow]',
  'placeholder:text-snapbox-ink/50',
  'focus-visible:translate-x-[2px] focus-visible:translate-y-[2px] focus-visible:shadow-snapbox-pressed',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-snapbox-secondary',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-snapbox-background',
  'disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none',
].join(' ');

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(fieldBase, 'min-h-11 px-3 py-2', className)}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-28 px-3 py-2', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<
  React.ComponentRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'font-display text-xs font-bold tracking-wide text-snapbox-ink uppercase',
      'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';
