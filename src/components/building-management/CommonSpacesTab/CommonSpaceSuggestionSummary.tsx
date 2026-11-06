'use client';

/**
 * @fileoverview **Η περίληψη μιας πρότασης κοινόχρηστου** (ADR-931 §6.2) — όνομα · πού · λόγος, ΜΙΑ φορά, για τη λωρίδα
 * προτάσεων **και** τη λίστα απορριφθεισών (ίδια πρόταση ⇒ ίδια διατύπωση). Επιπλέον γραμμές (π.χ. ποιος/πότε) ως παιδιά.
 * @related `CommonSpaceSuggestionsStrip.tsx` · `DismissedCommonSpaceSuggestions.tsx`
 * @module components/building-management/CommonSpacesTab/CommonSpaceSuggestionSummary
 */

import type { ReactNode } from 'react';

import type { useFloorLabel } from '@/hooks/useFloorLabel';
import type { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CommonSpaceSuggestion } from '@/lib/common-spaces/common-space-suggestions';
import { cn } from '@/lib/utils';

export const SUGGESTIONS_KEY = 'tab.suggestions';

export type SuggestionTranslate = ReturnType<typeof useTranslation>['t'];
export type SuggestionFloorLabel = ReturnType<typeof useFloorLabel>;

/** Ο λόγος ως πρόταση — το γεγονός που γέννησε την πρόταση, με την ετικέτα ορόφου από τον ΕΝΑ μορφοποιητή. */
function reasonText(suggestion: CommonSpaceSuggestion, t: SuggestionTranslate, floorLabel: SuggestionFloorLabel): string {
  const { reason } = suggestion;
  switch (reason.code) {
    case 'storeysAboveGround':
      return t(`${SUGGESTIONS_KEY}.reasons.storeysAboveGround`, { count: reason.count });
    case 'elevatorDeclared':
      return t(`${SUGGESTIONS_KEY}.reasons.elevatorDeclared`);
    default:
      return t(`${SUGGESTIONS_KEY}.reasons.${reason.code}`, { floor: floorLabel(reason.floor) });
  }
}

/** Πού: όλο το κτίριο, ή ο όροφος της πρότασης (από τον λόγο — ο κανόνας στάθμης κουβαλά πάντα τη στάθμη του). */
function scopeText(suggestion: CommonSpaceSuggestion, t: SuggestionTranslate, floorLabel: SuggestionFloorLabel): string {
  const { reason } = suggestion;
  if (suggestion.floorId === null || !('floor' in reason)) return t(`${SUGGESTIONS_KEY}.wholeBuilding`);
  return floorLabel(reason.floor);
}

interface CommonSpaceSuggestionSummaryProps {
  readonly suggestion: CommonSpaceSuggestion;
  readonly t: SuggestionTranslate;
  readonly floorLabel: SuggestionFloorLabel;
  readonly mutedClass: string;
  readonly children?: ReactNode;
}

export function CommonSpaceSuggestionSummary({ suggestion, t, floorLabel, mutedClass, children }: CommonSpaceSuggestionSummaryProps) {
  return (
    <p className="min-w-0 text-sm">
      <span className="font-medium">{t(`categories.${suggestion.category}`)}</span>
      <span className={mutedClass}> · {scopeText(suggestion, t, floorLabel)}</span>
      <span className={cn('block text-xs', mutedClass)}>{reasonText(suggestion, t, floorLabel)}</span>
      {children}
    </p>
  );
}
