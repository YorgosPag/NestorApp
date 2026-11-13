'use client';

/**
 * @fileoverview **Η απόφαση γραμμής δεν έφτασε** (ADR-923 §5.5.2 Β3.2) — μία ένδειξη για τη λίστα χωρίς πεδίο και τη λίστα αποφασισμένων.
 *   Όπως το «Couldn't send · Retry» του Gmail: η αποτυχία μένει **στη γραμμή** (το toast είναι παροδικό και γενικό), με το **ίδιο**
 *   αίτημα έτοιμο να ξανασταλεί. Ο διακομιστής γράφει την απόφαση και ό,τι παράγει σε μία συναλλαγή, και η «νέα ιδιότητα» είναι
 *   ιδεμπότητη κατά κωδικό — άρα η ξαναδοκιμή συνεχίζει από εκεί που σταμάτησε, χωρίς διπλότυπα.
 * @module components/catalog/imports/LineFailedNote
 */

import React from 'react';
import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useImportText } from './import-text';

export function LineFailedNote({ disabled, onRetry }: { readonly disabled: boolean; readonly onRetry: () => void }) {
  const { t } = useImportText();
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs" role="status">
      <span className="text-destructive">{t('review.lines.failedNote')}</span>
      <Button type="button" size="sm" variant="secondary" disabled={disabled} onClick={onRetry}>
        <RotateCcw className="mr-1 h-3 w-3" aria-hidden />{t('review.lines.retry')}
      </Button>
    </span>
  );
}
