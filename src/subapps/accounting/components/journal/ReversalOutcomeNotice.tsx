'use client';

/**
 * @fileoverview Αποτέλεσμα αντιλογισμού — ειδοποίηση πάνω από το βιβλίο (ADR-ACC-010 §2.1.1 Φ8)
 * @description Λέει ΤΙ έγινε με τη γλώσσα του λογιστή: σε ποια ημερομηνία καταχωρήθηκε το storno, και — αν η περίοδος
 *   της αρχικής ήταν κλειστή — ότι πήγε σε ανοιχτή (SAP: alternative posting date). Η ιδεμπότητη επανάληψη λέει
 *   «είχε ήδη αντιλογιστεί», όχι σφάλμα.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles, semantic HTML
 */

import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatAccountingDate } from '../../utils/format';
import type { JournalReversalDone } from './ReverseJournalEntryDialog';

interface ReversalOutcomeNoticeProps {
  readonly done: JournalReversalDone;
  readonly onDismiss: () => void;
}

export function ReversalOutcomeNotice({ done, onDismiss }: ReversalOutcomeNoticeProps) {
  const { t } = useTranslation(['accounting', 'accounting-tax-offices']);
  const { entry, result } = done;
  const message = result.alreadyReversed
    ? t('journal.reversal.outcome.alreadyReversed', { description: entry.description })
    : t('journal.reversal.outcome.reversed', {
        description: entry.description,
        date: formatAccountingDate(result.reversalDate ?? entry.date),
      });

  return (
    <aside role="status" className="mb-4 flex items-start justify-between gap-3 rounded-md border border-border bg-muted p-3 text-sm">
      <p>
        {message}
        {result.crossPeriod === true && <> {t('journal.reversal.outcome.crossPeriod')}</>}
      </p>
      <Button variant="ghost" size="sm" aria-label={t('journal.reversal.outcome.dismiss')} onClick={onDismiss}>
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </aside>
  );
}
