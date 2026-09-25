'use client';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@snapbox/ui';
import { cn } from '@snapbox/ui/lib/cn';

import { FAQ } from '@/content/public';

/**
 * FAQ publik dari `FAQ` (konten terpusat, hanya fakta PRD).
 *
 * Memakai primitif `Accordion` `@snapbox/ui` (Base UI). Trigger-nya adalah
 * `<button type="button">` native yang sudah mengeset `aria-expanded` dan
 * `aria-controls` (diverifikasi di AccordionTrigger base-ui 1.8.0), dan panel
 * mendapat `role="region"` + `aria-labelledby`. Jadi tidak perlu fallback
 * `<details>` dan tidak perlu menambal atribut ARIA manual.
 */
export function FaqAccordion({ className }: { readonly className?: string }) {
  return (
    <Accordion
      className={cn('w-full border-2 border-[#141414] bg-[#FFFEF5]', className)}
      defaultValue={[]}
    >
      {FAQ.map((entry) => (
        <AccordionItem
          key={entry.question}
          value={entry.question}
          className="rounded-none border-0 border-b-2 border-[#141414] shadow-none last:border-b-0"
        >
          <AccordionTrigger className="bg-[#FFFEF5] text-base font-heading text-[#141414] data-panel-open:bg-[#FFDD00]">
            {entry.question}
          </AccordionTrigger>
          <AccordionContent className="bg-[#F5F0DC] text-[#141414]">
            <p className="text-sm leading-relaxed">{entry.answer}</p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
