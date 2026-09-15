'use client';

/**
 * @fileoverview **ΠΟΡΤΑ ΠΡΟΣ ΥΠΟΣΕΛΙΔΑ ΤΗΣ ΒΙΤΡΙΝΑΣ — και η ΕΠΙΣΤΡΟΦΗ** (ADR-841 §7 Α21.16.7 · Α23.9 Φέτα Β).
 * @related components/mandate/ShowcaseCardDoor.tsx · components/mandate/ShowcaseRegistryDoor.tsx
 * @module components/mandate/ShowcaseDoorLink
 *
 * 🔑 **N.0.2**: η διάταξη ζούσε γραμμένη μέσα στην πόρτα της κάρτας· η δεύτερη υποσελίδα («Στοιχεία ΓΕΜΗ») θα
 * την αντέγραφε. Δέχεται **έτοιμο κείμενο** — ποτέ κλειδιά: κάθε σελίδα πληρώνει στο route slice **μόνο** τα δικά
 * της (ίδιο ιδίωμα με το `AreaCombobox`, ADR-744).
 *
 * ⚠️ Ο σύνδεσμος από το **ΣΥΝΟΡΟ** (CHECK 3.61): το πρόθεμα χώρου το βάζει εκείνο.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';

import { Link } from '@/lib/workspace/navigation';

/** `alert` ⇒ η γραμμή κατάστασης ζητά προσοχή (π.χ. «κλειστή στο ΓΕΜΗ»). */
export type ShowcaseDoorTone = 'neutral' | 'alert';

export function ShowcaseDoorLink({
  href,
  icon: Icon,
  title,
  detail,
  tone = 'neutral',
  detailTestId,
}: {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly detail: string;
  readonly tone?: ShowcaseDoorTone;
  readonly detailTestId?: string;
}): React.ReactElement {
  return (
    <nav>
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{title}</span>
          <span
            className={tone === 'alert' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
            data-testid={detailTestId}
          >
            {detail}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    </nav>
  );
}

/** **Η επιστροφή στη βιτρίνα** — η ίδια σε κάθε υποσελίδα. */
export function ShowcaseBackLink({ href, label }: { readonly href: string; readonly label: string }): React.ReactElement {
  return (
    <nav>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-foreground underline underline-offset-4">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        {label}
      </Link>
    </nav>
  );
}
