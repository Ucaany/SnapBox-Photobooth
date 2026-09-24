'use client';

import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

import * as React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog';

import { cn } from '../lib/cn';

/**
 * cmdk memanggil `scrollIntoView({ block: 'nearest' })` pada item terpilih dan
 * judul group saat mount. Karena `<html>` memakai `scroll-behavior: smooth`,
 * Chromium menaikkan panggilan itu ke dokumen sehingga halaman melompat jauh
 * tanpa interaksi pengguna (dip/cmdk issues #317 dan #405).
 *
 * `CommandList` mendaftar ke guard ini selama ia terpasang. Panggilan
 * `scrollIntoView` dari keturunan list dialihkan ke dalam list dan memakai
 * semantik `block: 'nearest'` yang sama, jadi scroll keyboard dan pointer tidak
 * berubah; hanya scroll halaman yang tidak lagi ikut bergerak.
 */
const scopedLists = new Set<HTMLElement>();
let originalScrollIntoView: typeof Element.prototype.scrollIntoView | null = null;

function scrollWithin(list: HTMLElement, element: Element) {
  const listRect = list.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  if (elementRect.top < listRect.top) {
    list.scrollTop -= listRect.top - elementRect.top;
  } else if (elementRect.bottom > listRect.bottom) {
    list.scrollTop += elementRect.bottom - listRect.bottom;
  }
}

function uninstallScrollGuard() {
  if (originalScrollIntoView === null) {
    return;
  }

  Element.prototype.scrollIntoView = originalScrollIntoView;
  originalScrollIntoView = null;
  scopedLists.clear();
}

function installScrollGuard(list: HTMLElement) {
  scopedLists.add(list);

  if (originalScrollIntoView !== null) {
    return;
  }

  originalScrollIntoView = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element, ...args) {
    for (const scoped of scopedLists) {
      if (scoped.contains(this)) {
        scrollWithin(scoped, this);
        return;
      }
    }
    originalScrollIntoView!.apply(this, args);
  };
}

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        'flex h-full w-full flex-col overflow-hidden rounded-[0px] border-2 border-border bg-background font-base text-foreground',
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
  title?: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden rounded-[0px]! border-0 p-0 shadow-shadow">
        <Command className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-heading [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-11 items-center gap-2 border-b-2 border-border px-3"
    >
      <Search className="size-4 shrink-0" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          'flex h-11 w-full rounded-base bg-transparent py-3 text-sm outline-hidden placeholder:text-foreground placeholder:opacity-50 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
}

/**
 * `max-h-*` dan `overflow-y-auto` wajib ada: itulah kontainer scroll internal
 * yang menerima pembelokan `scrollIntoView` dari guard di atas. Tanpanya
 * pembelokan jadi no-op dan halaman kembali melompat saat mount.
 */
function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    installScrollGuard(list);
    return () => {
      scopedLists.delete(list);
      if (scopedLists.size === 0) {
        uninstallScrollGuard();
      }
    };
  }, []);

  return (
    <CommandPrimitive.List
      ref={listRef}
      data-slot="command-list"
      className={cn('max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto', className)}
      {...props}
    />
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn('py-6 text-center text-sm', className)}
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        'overflow-hidden p-2 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-base [&_[cmdk-group-heading]]:font-heading',
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn('-mx-1 h-0.5 bg-border', className)}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex min-h-11 cursor-default items-center gap-2 rounded-base border-2 border-transparent px-2 py-1.5 text-sm text-foreground select-none aria-selected:border-border aria-selected:bg-main aria-selected:text-main-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn('ml-auto text-xs tracking-widest', className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
