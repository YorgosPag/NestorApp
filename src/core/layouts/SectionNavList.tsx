'use client';

/**
 * @fileoverview **Η λίστα ενοτήτων μιας σελίδας list-detail** — κάθετη, με **ζωντανή σύνοψη** και **μετρητή** σε κάθε
 * στοιχείο, ώστε τίποτα κρίσιμο να μη μένει κρυμμένο πίσω από μια ενότητα που δεν άνοιξε.
 * @related ADR-946 · `SectionListDetail` (ο μόνος οικοδεσπότης) · `components/ui/badge`
 * @module core/layouts/SectionNavList
 *
 * 🔑 **Γιατί όχι οι καρτέλες του έργου** (`base-tabs` · `tabs-rail` · `UniversalTabsRenderer`): όλες είναι **οριζόντιες**
 *   και το μόνο «σήμα» τους είναι ένα boolean `warningDot`. Η αντίρρηση του NN/g για τις καρτέλες (*«critical content in a
 *   non-default tab is missed»*) απαντιέται μόνο αν το στοιχείο λίστας **λέει** τι έχει μέσα — γραμμή σύνοψης + αριθμός.
 * 🔑 Στο κινητό τα ίδια στοιχεία είναι **κάρτες** με βέλος (drill-down)· από τη βαθμίδα `pane-split` (διαθέσιμος χώρος, `constants/pane-tiers`) και πάνω, λίστα πλοήγησης δίπλα στην
 *   ενότητα. Ένα component, γεωμετρία μόνο με CSS — σωστό από το πρώτο καρέ.
 */

import { ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Ένα στοιχείο της λίστας ενοτήτων. Τα κείμενα έρχονται **μεταφρασμένα** από τον καταναλωτή. */
export interface SectionEntry {
  readonly id: string;
  readonly label: string;
  /** Μία γραμμή: τι υπάρχει μέσα **τώρα** (ζωντανή σύνοψη), όχι περιγραφή της ενότητας. */
  readonly summary?: string;
  /** Μετρητής δίπλα στην ετικέτα· `0`/απών ⇒ τίποτα. */
  readonly count?: number;
  /** Ο μετρητής ζητά προσοχή (π.χ. κάτι λήγει) ⇒ χρώμα προειδοποίησης. */
  readonly attention?: boolean;
}

interface SectionNavListProps {
  readonly sections: readonly SectionEntry[];
  /** Η ενότητα που φαίνεται· `null` ⇒ καμία (κινητό, οθόνη λίστας). */
  readonly currentId: string | null;
  readonly onSelect: (sectionId: string) => void;
  readonly ariaLabel: string;
  readonly className?: string;
}

const ITEM = cn(
  'flex min-h-11 w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
  'bg-card hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'pane-split:border-transparent pane-split:bg-transparent pane-split:px-3 pane-split:py-2',
);
const CURRENT = 'pane-split:border-border pane-split:bg-accent';

function SectionNavItem({
  entry,
  current,
  onSelect,
}: {
  readonly entry: SectionEntry;
  readonly current: boolean;
  readonly onSelect: (sectionId: string) => void;
}) {
  const showCount = entry.count !== undefined && entry.count > 0;
  return (
    <button
      type="button"
      aria-current={current ? 'true' : undefined}
      onClick={() => onSelect(entry.id)}
      className={cn(ITEM, current && CURRENT)}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center justify-between gap-2">
          <span className="truncate font-medium text-foreground">{entry.label}</span>
          {showCount && (
            <Badge variant={entry.attention ? 'warning' : 'secondary'} className="shrink-0 tabular-nums">
              {entry.count}
            </Badge>
          )}
        </span>
        {entry.summary !== undefined && <span className="text-sm text-muted-foreground">{entry.summary}</span>}
      </span>
      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground pane-split:hidden" />
    </button>
  );
}

export function SectionNavList({ sections, currentId, onSelect, ariaLabel, className }: SectionNavListProps) {
  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="flex flex-col gap-2 pane-split:gap-1">
        {sections.map((entry) => (
          <li key={entry.id}>
            <SectionNavItem entry={entry} current={entry.id === currentId} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
