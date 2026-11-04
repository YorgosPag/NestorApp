'use client';

/**
 * @fileoverview **Ενότητα λίστας με τίτλο και γραμμή που επιλέγεται** — ουδέτερα, χωρίς namespace (ADR-923 Φάση 1γ ·
 *   ADR-928 Φ3γ-0).
 * @module components/shared/lists/SelectableList
 *
 * 🔑 Εξήχθη από το `catalog/shared/CatalogList.tsx`, που ήταν δεμένο στο namespace του καταλόγου μόνο για τη λέξη
 *    «Αποθήκευση…». Η βιβλιοθήκη υπεργολαβίας χρειάζεται **την ίδια** γραμμή· με εισαγωγή του αρχείου του καταλόγου θα
 *    κουβαλούσε τα κλειδιά του στο route slice της (στατική κλειστότητα εισαγωγών, ADR-744 §8). Ο κατάλογος μένει λεπτό
 *    περιτύλιγμα που δίνει τη λέξη του — ίδια συμπεριφορά, ίδια κλειδιά.
 * 🔑 Η γραμμή είναι **κουμπί** με `aria-current` (η επιλογή ζει στη διεύθυνση): πληκτρολόγιο και αναγνώστης οθόνης
 *    χωρίς επιπλέον κώδικα. Η εκκρεμής αποθήκευση φαίνεται με **λέξη** (`aria-busy` + σημάδι), όχι μόνο με χρώμα.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Badge, type BadgeVariantProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SelectableListSectionProps {
  readonly title: string;
  readonly count?: number;
  readonly children: React.ReactNode;
  readonly actions?: React.ReactNode;
}

export function SelectableListSection({ title, count, children, actions }: SelectableListSectionProps) {
  return (
    <section className="flex flex-col gap-1 py-1">
      <header className="flex items-center justify-between gap-2 px-2">
        <h3 className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          {count !== undefined ? <span className="ml-1 font-normal">({count})</span> : null}
        </h3>
        {actions}
      </header>
      {children}
    </section>
  );
}

export interface SelectableListBadge {
  readonly label: string;
  readonly variant: NonNullable<BadgeVariantProps['variant']>;
}

export interface SelectableListItemProps {
  readonly primary: string;
  readonly secondary?: string;
  readonly icon?: LucideIcon;
  /** Οπτικό στοιχείο στη θέση του εικονιδίου (π.χ. μικρογραφία μέσου) — κερδίζει το `icon`. */
  readonly leading?: React.ReactNode;
  readonly badges?: readonly SelectableListBadge[];
  readonly selected: boolean;
  /** Η λέξη της εκκρεμούς αποθήκευσης· παρούσα ⇒ η γραμμή είναι `aria-busy`. */
  readonly pendingLabel?: string;
  readonly onSelect: () => void;
  /** Λαβή αναδιάταξης (από `SortableList`), όταν η λίστα ταξινομείται. */
  readonly handle?: React.ReactNode;
}

export function SelectableListItem({ primary, secondary, icon: Icon, leading, badges = [], selected, pendingLabel, onSelect, handle }: SelectableListItemProps) {
  const pending = pendingLabel !== undefined;
  return (
    <span className={cn('flex items-center gap-1 rounded-md', selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50')}>
      {handle}
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        aria-busy={pending || undefined}
        onClick={onSelect}
        className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {leading ?? (Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null)}
        {/* Το όνομα έχει προτεραιότητα: όταν δεν χωρά δίπλα στα σήματα, τα σήματα κατεβαίνουν σε δική τους γραμμή. */}
        <span className="flex min-w-0 flex-[1_1_10rem] flex-col">
          <span className="truncate text-sm font-medium">{primary}</span>
          {secondary ? <span className="truncate font-mono text-xs text-muted-foreground">{secondary}</span> : null}
        </span>
        {badges.length > 0 ? (
          <span className="ml-auto flex max-w-full flex-wrap justify-end gap-1">
            {badges.map((badge) => <Badge key={badge.label} variant={badge.variant}>{badge.label}</Badge>)}
          </span>
        ) : null}
        {pending ? <span className="shrink-0 text-xs text-muted-foreground">{pendingLabel}</span> : null}
      </button>
    </span>
  );
}
