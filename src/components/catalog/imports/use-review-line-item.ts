'use client';

/**
 * @fileoverview **Μια γραμμή πίνακα στη λίστα της αναθεώρησης** (ADR-923 §5.5.2 Β8) — χωρίς πεδίο (`ProposalUnmappedLines`) ή
 *   αποφασισμένη (`ProposalDecidedLines`): η ίδια ταυτότητα με το πλαίσιό της στο PDF, hover και στις δύο κατευθύνσεις, κύλιση και
 *   εστίαση όταν την επιλέξει το PDF. Ένα σημείο για τις δύο λίστες (CHECK 3.28: ήταν δίδυμα).
 * @module components/catalog/imports/use-review-line-item
 */

import type { ImportPageUnmappedLine } from '@/subapps/catalog/types/catalog-import';
import { useReviewHoverHandlers, useReviewHovered } from './review-hover-store';
import { lineTargetOf, reviewTargetKey } from './review-overlay-model';
import { useActiveReviewItem } from './use-review-selection';

export function useReviewLineItem(line: Pick<ImportPageUnmappedLine, 'page' | 'table' | 'line'>, active: boolean, focusRequested: boolean) {
  const keys = [reviewTargetKey(lineTargetOf(line))];
  const hovered = useReviewHovered(keys);
  const hover = useReviewHoverHandlers(keys);
  const { itemRef, buttonRef } = useActiveReviewItem<HTMLLIElement>(active, focusRequested);
  const itemProps = {
    ref: itemRef,
    className: `flex flex-col gap-1 rounded-md border p-2 ${active ? 'border-ring' : 'border-border'} ${hovered && !active ? 'bg-muted' : ''}`,
    onMouseEnter: hover.onMouseEnter,
    onMouseLeave: hover.onMouseLeave,
  };
  return { itemProps, buttonRef, hover };
}
