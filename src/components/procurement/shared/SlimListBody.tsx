'use client';

/**
 * =============================================================================
 * PROCUREMENT — Το σώμα μιας λεπτής λίστας, **μία φορά** (ADR-784 §10.4 · CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ:** συμφωνίες · υλικά · προμηθευτές έγραφαν **χαρακτήρα προς χαρακτήρα** την
 * ίδια τριάδα «σκελετός φόρτωσης → κενή κατάσταση → στοιχεία», και μέσα της **δύο φορές** τον
 * ίδιο βρόχο απόδοσης — μία για το πλέγμα και μία για τη λίστα. Το ονόμασε το **CHECK 3.28**
 * (jscpd, ADR-584).
 *
 * ⚠️ **Οι τρεις καταστάσεις είναι ΜΙΑ απόφαση**, γι' αυτό ζουν μαζί: «φορτώνω» · «δεν έχω
 * τίποτα» · «να τα». Χωρισμένες σε τρία components, η σειρά τους θα ήταν ξανά γραμμένη σε κάθε
 * καλούντα — δηλαδή το ίδιο διπλότυπο με άλλο σχήμα.
 *
 * ⚠️ **Το πλέγμα ρωτά τον SSoT** (`gridPatterns.cards.tile`), όχι το παράθυρο — ADR-784 §1.
 *
 * @module components/procurement/shared/SlimListBody
 */

import React from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { gridPatterns } from '@/styles/design-tokens';

/** Πόσες γραμμές σκελετού δείχνει η λίστα όσο φορτώνει — **ένας** αριθμός για τον τομέα. */
const SKELETON_ROWS = 6;

export type SlimListViewMode = 'list' | 'grid';

export interface SlimListBodyProps<TItem> {
  loading: boolean;
  items: readonly TItem[];
  viewMode: SlimListViewMode;
  /** Το εικονίδιο της κενής κατάστασης — το ίδιο της κεφαλίδας της λίστας. */
  emptyIcon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /** **Μεταφρασμένο** από τον καλούντα (N.11: μηδέν κείμενο εδώ). */
  emptyMessage: string;
  keyOf: (item: TItem) => string;
  renderItem: (item: TItem, viewMode: SlimListViewMode) => React.ReactNode;
}

export function SlimListBody<TItem>({
  loading,
  items,
  viewMode,
  emptyIcon: EmptyIcon,
  emptyMessage,
  keyOf,
  renderItem,
}: SlimListBodyProps<TItem>) {
  const colors = useSemanticColors();

  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex flex-col items-center gap-2 py-12 px-4 text-center', colors.text.muted)}>
        <EmptyIcon className="h-8 w-8 opacity-40" aria-hidden />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={viewMode === 'grid' ? `gap-3 p-3 grid ${gridPatterns.cards.tile}` : 'p-2 space-y-2'}>
      {items.map((item) => (
        <React.Fragment key={keyOf(item)}>{renderItem(item, viewMode)}</React.Fragment>
      ))}
    </div>
  );
}
