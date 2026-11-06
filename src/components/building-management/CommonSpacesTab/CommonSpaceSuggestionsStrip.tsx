'use client';

/**
 * @fileoverview **Λωρίδα «Προτεινόμενοι κοινόχρηστοι»** (ADR-931 §6.2 · Β2) — κάθε πρόταση με τον **λόγο** της,
 * «Προσθήκη…» (προσυμπληρωμένος διάλογος) και «Απόρριψη» (μόνιμη για το κτίριο, με «Αναίρεση»), και από κάτω οι
 * «Απορριφθείσες (N)» με επαναφορά. Τίποτα από τα δύο ⇒ τίποτα στην οθόνη.
 * @related `useCommonSpaceSuggestions.ts` (κατάσταση) · `lib/common-spaces/common-space-suggestions.ts` (κανόνες)
 * @module components/building-management/CommonSpacesTab/CommonSpaceSuggestionsStrip
 */

import { useId } from 'react';
import { Lightbulb, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { CommonSpaceSuggestion } from '@/lib/common-spaces/common-space-suggestions';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import {
  CommonSpaceSuggestionSummary,
  SUGGESTIONS_KEY as KEY,
  type SuggestionFloorLabel,
  type SuggestionTranslate,
} from './CommonSpaceSuggestionSummary';
import { DismissedCommonSpaceSuggestions } from './DismissedCommonSpaceSuggestions';
import type { CommonSpaceSuggestionsHandle } from './useCommonSpaceSuggestions';

interface SuggestionItemProps {
  readonly suggestion: CommonSpaceSuggestion;
  readonly handle: CommonSpaceSuggestionsHandle;
  readonly t: SuggestionTranslate;
  readonly floorLabel: SuggestionFloorLabel;
  readonly mutedClass: string;
}

function SuggestionItem({ suggestion, handle, t, floorLabel, mutedClass }: SuggestionItemProps) {
  const name = t(`categories.${suggestion.category}`);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <CommonSpaceSuggestionSummary suggestion={suggestion} t={t} floorLabel={floorLabel} mutedClass={mutedClass} />
      <span className="flex shrink-0 gap-1">
        <Button size="sm" variant="outline" onClick={() => handle.accept(suggestion)} aria-label={t(`${KEY}.acceptLabel`, { name })}>
          <Plus className="mr-1 h-4 w-4" aria-hidden />
          {t(`${KEY}.accept`)}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { void handle.dismiss(suggestion); }} aria-label={t(`${KEY}.dismissLabel`, { name })}>
          <X className="mr-1 h-4 w-4" aria-hidden />
          {t(`${KEY}.dismiss`)}
        </Button>
      </span>
    </li>
  );
}

export function CommonSpaceSuggestionsStrip({ handle }: { readonly handle: CommonSpaceSuggestionsHandle }) {
  const { t } = useTranslation('common-spaces');
  const floorLabel = useFloorLabel();
  const colors = useSemanticColors();
  const headingId = useId();

  if (handle.suggestions.length === 0 && handle.dismissed.length === 0) return null;
  // Μόνο απορριφθείσες ⇒ μόνο η διακριτική γραμμή «Απορριφθείσες (N)» — καμία κενή κάρτα προτάσεων.
  if (handle.suggestions.length === 0) return <DismissedCommonSpaceSuggestions handle={handle} />;

  return (
    <aside aria-labelledby={headingId} className="flex flex-col gap-2 rounded-lg border p-3">
      <header className="flex items-center gap-2">
        <Lightbulb className={cn('h-4 w-4 shrink-0', colors.text.info)} aria-hidden />
        <h3 id={headingId} className="text-sm font-semibold">{t(`${KEY}.title`)}</h3>
      </header>
      <p className={cn('text-xs', colors.text.muted)}>{t(`${KEY}.hint`)}</p>
      <ul className="flex flex-col gap-2">
        {handle.suggestions.map((suggestion) => (
          <SuggestionItem
            key={suggestion.key}
            suggestion={suggestion}
            handle={handle}
            t={t}
            floorLabel={floorLabel}
            mutedClass={colors.text.muted}
          />
        ))}
      </ul>
      <DismissedCommonSpaceSuggestions handle={handle} />
    </aside>
  );
}
