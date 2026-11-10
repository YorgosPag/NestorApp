'use client';

/**
 * @fileoverview **Ο κάτοχος της λύσης** (ADR-923 §5.5.2 Β8 βήμα Β): η κρίση «επιτρέπεται;» για κάθε στόχο του PDF, και η εκτέλεση
 *   κάθε κουμπιού του popover από τον **ίδιο** δρόμο με τη λίστα.
 * @module components/catalog/imports/use-review-remedy
 *
 * 🔑 Ενέργεια που γράφει (`keepValue` · `ignoreLine`) ⇒ η **ίδια** κλήση με το κουμπί της λίστας (`workspace.change` με
 *    `fieldEditChange` · `workspace.decideLine` με `lineRequestOf`). Ποτέ μέσα από effect: σε StrictMode ένα effect που γράφει
 *    τρέχει δύο φορές.
 * 🔑 Ενέργεια που ανοίγει εργαλείο (`editField` · `lineTool` · `pickPriceTarget`) ⇒ **πρόθεση** στον κάτοχο της επιλογής
 *    (`requestRemedy`)· την καταναλώνει το εργαλείο της λίστας. Καμία δεύτερη υλοποίηση ενέργειας.
 * 🔑 `decidable` = η ίδια κρίση με τα κουμπιά της λίστας: πρόταση σε εκκρεμότητα · παρτίδα ανοιχτή · καμία αναβάθμιση σελίδων σε εξέλιξη.
 */

import { useCallback } from 'react';

import { pageTableGroupKey } from '@/subapps/catalog/import/import-keys';
import { lineKeyOf } from '@/subapps/catalog/import/page-line-overrides';
import type { ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView, ImportProposalWire } from '@/subapps/catalog/types/catalog-import-requests';
import { IMPORT_FINISHED_BATCH_STATUSES } from '@/subapps/catalog/vocabulary/catalog-import';
import { useCatalogAccess } from '../shared/catalog-neutral-hooks';
import { useCatalogCanManage } from '../shared/catalog-ui-hooks';
import { lineRequestOf } from './line-state';
import { fieldEditChange } from './proposal-change-queue';
import { resolveReviewTarget, type ReviewTarget } from './review-overlay-model';
import type { RemedyAction, RemedyContext } from './review-remedy';
import type { ReviewRemedyHandlers } from './ReviewBoxPopover';
import type { useImportBatch } from './use-import-batch';
import type { ReviewSelection } from './use-review-selection';

type Workspace = ReturnType<typeof useImportBatch>;

/** Ε7 · §5.5.2 Μ9: μια γραμμή ανήκει στην πρόταση του **πίνακά** της — η μία απάντηση για λίστα και popover. */
export const ownsLine = (proposal: ImportProposalWire, line: Pick<ImportPageUnmappedLine, 'page' | 'table'>): boolean =>
  proposal.groupKey === pageTableGroupKey(line.page, line.table);

/** Η παρτίδα έχει τιμοκατάλογο ⇒ μια γραμμή μπορεί να γίνει τιμή (το δικαίωμα κρίνεται και στον διακομιστή). */
export const priceTargetOf = (view: ImportBatchDetailView): string | null =>
  (view.batch.target.purpose === 'attributes' ? (view.batch.target.priceListVersionId ?? null) : null);

const linesOfBatch = (view: ImportBatchDetailView): readonly ImportPageUnmappedLine[] => view.batch.pages?.unmappedLines ?? [];

/** Η πρόταση που κρίνει τον στόχο: του πεδίου, ή του πίνακα της γραμμής. */
function proposalOfTarget(view: ImportBatchDetailView, target: ReviewTarget): ImportProposalWire | undefined {
  if (target.kind === 'field') return view.proposals.find((proposal) => proposal.id === target.proposalId);
  const line = linesOfBatch(view).find((candidate) => lineKeyOf(candidate) === target.lineKey);
  return line ? view.proposals.find((proposal) => ownsLine(proposal, line)) : undefined;
}

/** Η ενέργεια που γράφει, επιτόπου — `false` = δεν είναι τέτοια (ή ο στόχος χάθηκε). */
function runInPlace(workspace: Workspace, view: ImportBatchDetailView, target: ReviewTarget, action: RemedyAction): boolean {
  const resolved = resolveReviewTarget(target, view.proposals, linesOfBatch(view));
  if (action.kind === 'keepValue' && resolved?.kind === 'field') {
    void workspace.change(resolved.proposal, fieldEditChange(resolved.row, resolved.field, action.text));
    return true;
  }
  const owner = proposalOfTarget(view, target);
  if (action.kind === 'ignoreLine' && resolved?.kind === 'line' && owner) {
    void workspace.decideLine(owner, lineRequestOf(resolved.line, { kind: 'ignore' }));
    return true;
  }
  return false;
}

/** `view: null` = η παρτίδα φορτώνει ακόμη ⇒ τίποτα αποφασίσιμο, καμία ενέργεια (το hook ζει πριν από το «φόρτωση…»). */
export function useReviewRemedy(workspace: Workspace, selection: ReviewSelection): ReviewRemedyHandlers {
  const { view } = workspace;
  const canManage = useCatalogCanManage();
  const canPrice = useCatalogAccess('pricing') === 'granted';
  const open = view !== null && !IMPORT_FINISHED_BATCH_STATUSES.includes(view.batch.status) && workspace.upgrade === null;
  const hasPriceTarget = view !== null && priceTargetOf(view) !== null;
  const { requestRemedy } = selection;

  const contextOf = useCallback((target: ReviewTarget): RemedyContext => ({
    decidable: open && view !== null && proposalOfTarget(view, target)?.status === 'pending', canManage, canPrice, hasPriceTarget,
  }), [open, view, canManage, canPrice, hasPriceTarget]);

  const onRemedy = useCallback((target: ReviewTarget, action: RemedyAction) => {
    if (view === null) return;
    if (runInPlace(workspace, view, target, action)) return requestRemedy(target, null);
    if (action.kind === 'editField') return requestRemedy(target, { kind: 'editField' });
    if (action.kind === 'lineTool') return requestRemedy(target, { kind: 'lineTool', mode: action.mode });
    if (action.kind === 'pickPriceTarget') requestRemedy(target, { kind: 'priceTarget' });
  }, [workspace, view, requestRemedy]);

  return { contextOf, onRemedy };
}
