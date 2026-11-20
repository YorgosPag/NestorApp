'use client';

/**
 * **Η κάτω μπάρα του ποσού** (ADR-947, διάταξη) — στο κινητό και στο tablet το αποτέλεσμα είναι στο τέλος μιας μακριάς
 * φόρμας· η μπάρα κρατά το ποσό ορατό όσο συμπληρώνεις και πηγαίνει στην ανάλυση με ένα πάτημα.
 *
 * 🔑 **`sticky bottom-0`, ΟΧΙ `fixed`**: είναι το τελευταίο παιδί του `<main>`, άρα κολλά στο κάτω μέρος όσο κυλάς και
 * **προσγειώνεται στη ροή** στο τέλος — δεν καλύπτει ποτέ το τελευταίο περιεχόμενο, χωρίς `pb-*` στο κέλυφος
 * (CHECK 3.63).
 *
 * 🔑 **Κρύβεται όταν φαίνεται το ίδιο το αποτέλεσμα** (`invisible`, όχι `hidden` ⇒ καμία μετατόπιση διάταξης): δύο
 * φορές το ίδιο ποσό στην οθόνη είναι θόρυβος. Το `visibility: hidden` τη βγάζει ήδη από τη σειρά Tab και από τον
 * αναγνώστη οθόνης — κανένα `aria-hidden`/`tabIndex` επιπλέον.
 *
 * ⚠️ **Χωρίς `aria-live`**: το αποτέλεσμα έχει ήδη `role="status"` και ανακοινώνει κάθε αλλαγή — δεύτερη ζωντανή
 * περιοχή θα έλεγε το ίδιο ποσό δύο φορές.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrency } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { ObjectiveValueResult as Result } from '@/lib/objective-value/objective-value-types';

const NS = 'objective-value';
const R = `${NS}:result`;

interface ObjectiveValueMobileBarProps {
  readonly result: Result;
  /** Το αποτέλεσμα είναι ήδη στην οθόνη ⇒ η μπάρα κρύβεται. */
  readonly resultInView: boolean;
  readonly onShowBreakdown: () => void;
}

export function ObjectiveValueMobileBar({ result, resultInView, onShowBreakdown }: ObjectiveValueMobileBarProps) {
  const { t } = useTranslation([NS]);
  const computed = result.kind === 'computed';
  return (
    <aside
      aria-label={t(`${R}.barLabel`)}
      className={cn(
        'sticky bottom-0 z-[var(--z-index-sticky)] flex items-center justify-between gap-3 rounded-t-lg border border-b-0 border-border bg-card px-4 py-3 text-card-foreground shadow-lg lg:hidden',
        resultInView && 'invisible',
      )}
    >
      <p className="m-0 flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{t(`${R}.label`)}</span>
        <span className={cn('tabular-nums', computed ? 'text-lg font-semibold text-foreground' : 'text-sm text-foreground')}>
          {computed ? formatCurrency(result.value) : t(`${R}.barPending`)}
        </span>
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onShowBreakdown}>
        {t(`${R}.showBreakdown`)}
      </Button>
    </aside>
  );
}
