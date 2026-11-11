'use client';

/**
 * @fileoverview **Το όνομα ενός βήματος της στοίβας αναίρεσης** (ADR-923 §5.5.2 Β9β · Β9γ · Β9δ) — ο ΕΝΑΣ ονοματοδότης για τα
 * κουμπιά («Αναίρεση: Αποδοχή «Κωδικός»», λίστα αναίρεσης του Revit) και για το toast της ομαδικής πράξης.
 * @module components/catalog/imports/use-review-step-name
 *
 * 🔑 Η λέξη του πεδίου (και της ιδιότητας μιας γραμμής) έρχεται από τον ίδιο ονοματοδότη με τη λίστα (`useTargetLabeler`).
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
  modelCode: 'review.history.step.modelCode',
  removeModelCode: 'review.history.step.removeModelCode',
  lineAttribute: 'review.history.step.lineAttribute',
  lineAxis: 'review.history.step.lineAxis',
  linePrice: 'review.history.step.linePrice',
  lineIgnore: 'review.history.step.lineIgnore',
  lineUndo: 'review.history.step.lineUndo',
};

export function useStepName(): (label: ReviewStepLabel | null) => string | null {
  const { t } = useImportText();
  const labelOf = useTargetLabeler();
  return useCallback((label: ReviewStepLabel | null): string | null => {
    if (!label) return null;
    if ('code' in label) return t(STEP_KEYS[label.kind], { code: label.code });
    if ('line' in label) {
      const values = { line: label.line, field: label.target ? labelOf({ target: label.target }) : '' };
      // Η ιδιότητα που γεννήθηκε από τη γραμμή (§5.5.2 Β3) λέγεται «νέα»: η αναίρεση γυρνά τη γραμμή, το σχήμα μένει (απόφαση Α).
      return label.bound ? t('review.history.step.lineAttributeBound', values) : t(STEP_KEYS[label.kind], values);
    }
    return t(STEP_KEYS[label.kind], { field: labelOf({ target: label.target }), count: label.count });
  }, [labelOf, t]);
}
