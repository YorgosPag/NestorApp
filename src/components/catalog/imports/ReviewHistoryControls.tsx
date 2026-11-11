'use client';

/**
 * @fileoverview **Τα κουμπιά αναίρεσης / επανάληψης της οθόνης ελέγχου** (ADR-923 §5.5.2 Β9β).
 * @module components/catalog/imports/ReviewHistoryControls
 *
 * 🔑 **Ονομασμένο βήμα** (λίστα αναίρεσης του Revit): το κουμπί λέει **τι** θα αναιρεθεί — «Αναίρεση: Αποδοχή «Κωδικός»» —
 *    με τη λέξη του πεδίου από τον ίδιο ονοματοδότη με τη λίστα (`useTargetLabeler`).
 * 🔑 Το πληκτρολόγιο δηλώνεται στον αναγνώστη οθόνης (`aria-keyshortcuts`), και η λέξη μένει ορατή (όχι μόνο εικονίδιο).
 */

import React from 'react';
import { Redo2, Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useImportText } from './import-text';
import { useTargetLabeler } from './import-target-label';
import type { ReviewStepKind, ReviewStepLabel } from './review-history';
import type { ReviewHistory } from './use-review-history';

const STEP_KEYS: Readonly<Record<ReviewStepKind, string>> = {
  accept: 'review.history.step.accept',
  reject: 'review.history.step.reject',
  undoDecision: 'review.history.step.undoDecision',
  edit: 'review.history.step.edit',
  revertEdit: 'review.history.step.revertEdit',
  acceptRow: 'review.history.step.acceptRow',
};

function useStepName(): (label: ReviewStepLabel | null) => string | null {
  const { t } = useImportText();
  const labelOf = useTargetLabeler();
  return (label) => (label ? t(STEP_KEYS[label.kind], { field: labelOf(label), count: label.count }) : null);
}

export function ReviewHistoryControls({ history, disabled }: { readonly history: ReviewHistory; readonly disabled: boolean }) {
  const { t } = useImportText();
  const nameOf = useStepName();
  const undoName = nameOf(history.nextUndo);
  const redoName = nameOf(history.nextRedo);
  return (
    <nav className="flex items-center gap-1" aria-label={t('review.history.title')}>
      <Button type="button" size="sm" variant="ghost" disabled={disabled || !history.canUndo} onClick={history.undo}
        aria-keyshortcuts="Control+Z Meta+Z" aria-label={undoName ? t('review.history.undoNamed', { action: undoName }) : t('review.history.undo')}>
        <Undo2 className="mr-1 h-4 w-4" aria-hidden />{t('review.history.undo')}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={disabled || !history.canRedo} onClick={history.redo}
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y" aria-label={redoName ? t('review.history.redoNamed', { action: redoName }) : t('review.history.redo')}>
        <Redo2 className="mr-1 h-4 w-4" aria-hidden />{t('review.history.redo')}
      </Button>
      {undoName ? <span className="text-xs text-muted-foreground" aria-hidden>{undoName}</span> : null}
    </nav>
  );
}
