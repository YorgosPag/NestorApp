/**
 * @fileoverview **Ποια πόρτα παίρνει κάθε βήμα της στοίβας** (ADR-923 §5.5.2 Β9δ). Καθαρό, χωρίς React.
 * @module components/catalog/imports/review-history-plan
 *
 * 🔑 Ένας διανομέας για τα τρία είδη βήματος της ΜΙΑΣ στοίβας: πεδία και κωδικός μοντέλου → `change` της ουράς · γραμμή →
 *    `decideLine`. Οι δύο πλευρές ενός βήματος έχουν πάντα το ίδιο είδος (`review-history`).
 */

import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { planFieldMarks, planModelCode, type ReviewStep, type ReviewStepPlan } from './review-history';
import { planLineStep } from './review-history-line';

const NOTHING: ReviewStepPlan = { send: null, skipped: 0 };

/** Από την πλευρά `from` στην πλευρά `to`, πάνω στην όψη όπως είναι **τώρα**. */
export function planReviewStep(view: ImportBatchDetailView, from: ReviewStep, to: ReviewStep): ReviewStepPlan {
  if (to.kind === 'fields' && from.kind === 'fields') return planFieldMarks(view.proposals, to.proposalId, from.marks, to.marks);
  if (to.kind === 'modelCode' && from.kind === 'modelCode') return planModelCode(view.proposals, from, to);
  if (to.kind === 'line' && from.kind === 'line') return planLineStep(view, from, to);
  return NOTHING;
}
