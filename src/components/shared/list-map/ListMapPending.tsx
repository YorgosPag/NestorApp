'use client';

/**
 * @fileoverview **«ΦΟΡΤΩΝΕΙ»** του σχήματος λίστα ‖ χάρτης — κράτηση θέσης για τη λίστα και για τον χάρτη.
 * @related ADR-896 §7Α.7 · ADR-777 §8.75 · list-map-layout · ListMapSplit
 * @module components/shared/list-map/ListMapPending
 *
 * 🏆 **Πρότυπο Zillow / Airbnb / Idealista**: όσο έρχονται τα δεδομένα, σκελετοί καρτών στη **θέση**
 * των καρτών — όχι μια γραμμή κειμένου που αφήνει τη σελίδα κοντή και το υποσέλιδο να «πέφτει» όταν
 * φτάσουν (web.dev/CLS: *reserve space for content that loads later*). Το ύψος κρατιέται σε **CSS**
 * (`LIST_MAP_PENDING`), χωρίς μέτρηση JS — σωστό από το πρώτο βάψιμο του διακομιστή (ADR-777 §8.84).
 *
 * ♿ **Ο σκελετός είναι εικόνα, όχι περιεχόμενο**: `aria-hidden`. Ο αναγνώστης οθόνης ακούει **μία**
 * φράση από `role="status"` — ποτέ τέσσερα κενά «στοιχεία λίστας».
 *
 * 🔑 Και η κράτηση του **χάρτη** ζει εδώ (`ListMapMapPending`): ήταν γραμμένη **δύο φορές**, με ίδιες
 * κλάσεις, στο `/pro` και στο `/offers` (N.0.2). Κάθε καταναλωτής κρατά μόνο τη δική του ετικέτα.
 */

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';

import { LIST_MAP_PENDING } from './list-map-layout';

/** Πόσοι σκελετοί: αρκετοί για να γεμίσουν την πρώτη οθόνη — το ύψος το κρατά ήδη η κλάση. */
const PENDING_CARDS = 4;

/** Μία κάρτα-σκελετός: εικόνα + τίτλος + δύο γραμμές — το σχήμα κάθε κάρτας καταλόγου. */
function SkeletonCard(): React.ReactElement {
  return (
    <li className="flex gap-3 rounded-lg border border-border p-4">
      <Skeleton className="size-14 shrink-0" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-2/5" />
      </span>
    </li>
  );
}

export interface ListMapPendingProps {
  /** Η φράση για τον αναγνώστη οθόνης (π.χ. «Φόρτωση επαγγελματιών…»), ήδη μεταφρασμένη. */
  readonly label: string;
}

/** Η λίστα που **έρχεται**: ίδια θέση, ίδιο (ελάχιστο) ύψος, μηδέν μετατόπιση στην άφιξη. */
export function ListMapPending({ label }: ListMapPendingProps): React.ReactElement {
  return (
    <section role="status" aria-busy="true" className={LIST_MAP_PENDING}>
      <span className="sr-only">{label}</span>
      <ul aria-hidden="true" className="m-0 flex list-none flex-col gap-3 p-0">
        {Array.from({ length: PENDING_CARDS }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </ul>
    </section>
  );
}

/** Ο χάρτης που **έρχεται** (`next/dynamic` → `loading`): γεμίζει τον **ίδιο** περιέκτη με τον χάρτη ⇒ μηδέν μετατόπιση. */
export function ListMapMapPending({ label }: ListMapPendingProps): React.ReactElement {
  return (
    <p aria-busy="true" className="m-0 flex h-full items-center justify-center rounded-md border border-border text-sm text-muted-foreground">
      {label}
    </p>
  );
}
