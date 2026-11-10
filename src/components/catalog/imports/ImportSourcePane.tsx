'use client';

/**
 * @fileoverview **Το PDF της πηγής δίπλα στις προτάσεις** (ADR-923 §5.5.1 · §5.5.2 Β3.1 · Β8): η σελίδα του επιλεγμένου στόχου,
 *   τα πλαίσια κατάστασης όλων όσων αναγνωρίστηκαν, υπόμνημα και διακόπτης. Κλικ σε πλαίσιο ⇒ επιλογή στη λίστα.
 * @module components/catalog/imports/ImportSourcePane
 *
 * 🔑 Δεν κρατά επιλογή: τη διαβάζει και τη γράφει στον **έναν** κάτοχο (`useReviewSelection`, στο `ImportBatchWorkspace`).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { PdfCanvasViewer } from '@/components/file-manager/PdfCanvasViewer';
import { pageDerivationOf } from '@/subapps/catalog/import/page-derivation';
import type { ImportBatchPages } from '@/subapps/catalog/types/catalog-import';
import type { ImportBatchDetailView } from '@/subapps/catalog/types/catalog-import-requests';
import { LINE_REFUSAL_KEYS, useImportText } from './import-text';
import { ImportReviewOverlay } from './ImportReviewOverlay';
import { createBoxPreview } from './review-box-preview';
import { countBoxTones, type ResolvedReviewTarget, type ReviewBox } from './review-overlay-model';
import { ReviewBoxPopover, type ReviewRemedyHandlers } from './ReviewBoxPopover';
import { ReviewOverlayLegend } from './ReviewOverlayLegend';
import type { ReviewSelection } from './use-review-selection';

/** Η σελίδα του επιλεγμένου στόχου — `null` όταν δεν έχει σημείο σε σελίδα (π.χ. πεδίο από κελί αρχείου). */
function pageOfTarget(resolved: ResolvedReviewTarget | null): number | null {
  if (resolved?.kind === 'line') return resolved.line.page;
  const anchor = resolved?.field.anchor;
  return anchor?.kind === 'page' ? anchor.page : null;
}

/**
 * §5.5.2 Β3.1: γραμμή χωρίς θέση στη σελίδα **δεν** σβήνει σιωπηλά την επισήμανση — λέει γιατί. Ο λόγος έρχεται από τη σφραγίδα της
 * σελίδας (η αναβάθμιση αρνήθηκε) ή είναι «παλαιότερη έκδοση» (δεν έχει ακόμη αναβαθμιστεί).
 */
function MissingRegion({ pages, resolved }: { readonly pages: ImportBatchPages | null | undefined; readonly resolved: ResolvedReviewTarget | null }) {
  const { t } = useImportText();
  if (resolved?.kind !== 'line' || (resolved.line.regions?.length ?? 0) > 0 || !pages) return null;
  const { refusal } = pageDerivationOf(pages, resolved.line.page);
  const reason = refusal === null ? t('review.lines.regionLegacy') : t(LINE_REFUSAL_KEYS[refusal]);
  return <p className="m-0 text-xs text-muted-foreground" role="status">{t('review.lines.regionMissing', { reason })}</p>;
}

/** Τα πλαίσια ανά σελίδα, μία φορά ανά αλλαγή δεδομένων — όχι σε κάθε ζωγραφιά της σελίδας. */
function boxesByPage(boxes: readonly ReviewBox[]): ReadonlyMap<number, readonly ReviewBox[]> {
  const byPage = new Map<number, ReviewBox[]>();
  for (const box of boxes) byPage.set(box.page, [...(byPage.get(box.page) ?? []), box]);
  return byPage;
}

interface ImportSourcePaneProps {
  readonly view: ImportBatchDetailView;
  readonly fileId: string;
  readonly boxes: readonly ReviewBox[];
  readonly selection: ReviewSelection;
  readonly resolved: ResolvedReviewTarget | null;
  /** §5.5.2 Β8 βήμα Β: η κρίση και η ενέργεια λύσης του popover — ζουν στον ΕΝΑ κάτοχο (`ImportBatchWorkspace`). */
  readonly remedy: ReviewRemedyHandlers;
}

/** ΕΝΑΣ ελεγκτής popover ανά πηγή — σταθερός, άρα ούτε η στρώση ούτε το popover ξαναζωγραφίζουν επειδή υπάρχει. */
function useBoxPreviewController() {
  const [controller] = useState(createBoxPreview);
  useEffect(() => controller.dispose, [controller]);
  return controller;
}

export function ImportSourcePane({ view, fileId, boxes, selection, resolved, remedy }: ImportSourcePaneProps) {
  const { t } = useImportText();
  const { batch, proposals } = view;
  const [showAll, setShowAll] = useState(true);
  const preview = useBoxPreviewController();
  const byPage = useMemo(() => boxesByPage(boxes), [boxes]);
  const counts = useMemo(() => countBoxTones(boxes), [boxes]);
  const page = pageOfTarget(resolved) ?? proposals[0]?.pages[0] ?? batch.pages?.from ?? 1;
  const { key, selectFromBox } = selection;
  const overlay = useCallback((shown: number) => (
    <ImportReviewOverlay boxes={byPage.get(shown) ?? []} selectedKey={key} showAll={showAll} onSelect={selectFromBox} preview={preview} />
  ), [byPage, key, showAll, selectFromBox, preview]);
  return (
    <aside className="flex min-h-0 flex-col gap-2" aria-label={t('review.source')}>
      {boxes.length > 0 ? <ReviewOverlayLegend counts={counts} showAll={showAll} onShowAll={setShowAll} cycle={selection.cycle} onNext={selection.nextInBox} /> : null}
      <MissingRegion pages={batch.pages} resolved={resolved} />
      <PdfCanvasViewer url="" fileId={fileId} title={batch.fileName} page={page} pageOverlay={overlay} className="min-h-0 flex-1" />
      <ReviewBoxPopover controller={preview} boxes={boxes} contextOf={remedy.contextOf} onRemedy={remedy.onRemedy} />
    </aside>
  );
}
