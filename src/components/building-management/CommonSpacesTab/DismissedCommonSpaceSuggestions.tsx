'use client';

/**
 * @fileoverview **«Απορριφθείσες (N)»** (ADR-931 §6.2 · Β2) — πτυσσόμενη λίστα των απορριφθεισών προτάσεων κοινοχρήστων
 * που **ισχύουν ακόμη**, με τον λόγο, **ποιος/πότε** (GitHub «dismissed by … on …») και επαναφορά μίας ή όλων
 * (Google Ads «Undismiss all»). Καμία απορριφθείσα ⇒ τίποτα στην οθόνη.
 * @related `useCommonSpaceSuggestions.ts` (κατάσταση) · `CommonSpaceSuggestionSummary.tsx` (ίδια διατύπωση με τη λωρίδα)
 * @module components/building-management/CommonSpacesTab/DismissedCommonSpaceSuggestions
 */

import { ChevronDown, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { useUserDisplayNames } from '@/hooks/useUserDisplayNames';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DismissedCommonSpaceSuggestionView } from '@/lib/common-spaces/common-space-suggestion-dismissals';
import { formatDateTime } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import {
  CommonSpaceSuggestionSummary,
  SUGGESTIONS_KEY as KEY,
  type SuggestionFloorLabel,
  type SuggestionTranslate,
} from './CommonSpaceSuggestionSummary';
import type { CommonSpaceSuggestionsHandle } from './useCommonSpaceSuggestions';

interface DismissedItemProps {
  readonly view: DismissedCommonSpaceSuggestionView;
  readonly dismisser: string | undefined;
  readonly onRestore: (key: string) => void;
  readonly t: SuggestionTranslate;
  readonly floorLabel: SuggestionFloorLabel;
  readonly mutedClass: string;
}

function DismissedItem({ view, dismisser, onRestore, t, floorLabel, mutedClass }: DismissedItemProps) {
  const { suggestion, dismissal } = view;
  const name = t(`categories.${suggestion.category}`);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
      <CommonSpaceSuggestionSummary suggestion={suggestion} t={t} floorLabel={floorLabel} mutedClass={mutedClass}>
        <span className={cn('block text-xs', mutedClass)}>
          {t(`${KEY}.dismissedBy`, { name: dismisser ?? t(`${KEY}.dismissedByUnknown`) })}
          {' · '}
          <time dateTime={dismissal.dismissedAt}>{formatDateTime(dismissal.dismissedAt)}</time>
        </span>
      </CommonSpaceSuggestionSummary>
      <Button size="sm" variant="outline" onClick={() => onRestore(suggestion.key)} aria-label={t(`${KEY}.restoreLabel`, { name })}>
        <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
        {t(`${KEY}.restore`)}
      </Button>
    </li>
  );
}

export function DismissedCommonSpaceSuggestions({ handle }: { readonly handle: CommonSpaceSuggestionsHandle }) {
  const { t } = useTranslation('common-spaces');
  const floorLabel = useFloorLabel();
  const colors = useSemanticColors();
  const { dismissed } = handle;
  const names = useUserDisplayNames([...new Set(dismissed.map((view) => view.dismissal.dismissedBy))]);

  if (dismissed.length === 0) return null;

  return (
    <Collapsible className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <CollapsibleTrigger className={cn('group flex min-h-11 items-center gap-1 text-xs font-medium sm:min-h-6', colors.text.muted)}>
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          {t(`${KEY}.dismissedTitle`, { count: dismissed.length })}
        </CollapsibleTrigger>
        {dismissed.length > 1 && (
          <Button size="sm" variant="ghost" onClick={() => { void handle.restoreAll(); }}>
            <RotateCcw className="mr-1 h-4 w-4" aria-hidden />
            {t(`${KEY}.restoreAll`)}
          </Button>
        )}
      </span>
      <CollapsibleContent>
        <ul className="flex flex-col gap-2">
          {dismissed.map((view) => (
            <DismissedItem
              key={view.suggestion.key}
              view={view}
              dismisser={names.get(view.dismissal.dismissedBy)}
              onRestore={(key) => { void handle.restore(key); }}
              t={t}
              floorLabel={floorLabel}
              mutedClass={colors.text.muted}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
