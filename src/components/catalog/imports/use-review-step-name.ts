'use client';

/**
 * @fileoverview **Το όνομα ενός βήματος της στοίβας αναίρεσης** (ADR-923 §5.5.2 Β9β · Β9γ) — ο ΕΝΑΣ ονοματοδότης για τα κουμπιά
 * («Αναίρεση: Αποδοχή «Κωδικός»», λίστα αναίρεσης του Revit) και για το toast της ομαδικής πράξης.
 * @module components/catalog/imports/use-review-step-name
 *
 * 🔑 Η λέξη του πεδίου έρχεται από τον ίδιο ονοματοδότη με τη λίστα (`useTargetLabeler`).
 */

import { useCallback } from 'react';

import { useImportText } from './import-text';
import { useTargetLabeler } from './import-target-label';
import type { ReviewStepKind, ReviewStepLabel } from './review-history';

const STEP_KEYS: Readonly<Record<ReviewStepKind, string>> = {
  accept: 'review.history.step.accept',
  reject: 'review.history.step.reject',
  undoDecision: 'review.history.step.undoDecision',
  edit: 'review.history.step.edit',
  revertEdit: 'review.history.step.revertEdit',
  acceptRow: 'review.history.step.acceptRow',
};

export function useStepName(): (label: ReviewStepLabel | null) => string | null {
  const { t } = useImportText();
  const labelOf = useTargetLabeler();
  return useCallback(
    (label: ReviewStepLabel | null) => (label ? t(STEP_KEYS[label.kind], { field: labelOf(label), count: label.count }) : null),
    [labelOf, t],
  );
}
