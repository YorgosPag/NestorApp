'use client';

/**
 * @fileoverview **Λωρίδα «Προτεινόμενοι κοινόχρηστοι»** (ADR-931 §6.2 · Β2) — κάθε πρόταση με τον **λόγο** της,
 * «Προσθήκη…» (προσυμπληρωμένος διάλογος) και «Απόρριψη» (μόνιμη για το κτίριο). Καμία πρόταση ⇒ τίποτα στην οθόνη.
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

import type { CommonSpaceSuggestionsHandle } from './useCommonSpaceSuggestions';

const KEY = 'tab.suggestions';

type Translate = ReturnType<typeof useTranslation>['t'];
type FloorLabel = ReturnType<typeof useFloorLabel>;

/** Ο λόγος ως πρόταση — το γεγονός που γέννησε την πρόταση, με την ετικέτα ορόφου από τον ΕΝΑ μορφοποιητή. */
function reasonText(suggestion: CommonSpaceSuggestion, t: Translate, floorLabel: FloorLabel): string {
  const { reason } = suggestion;
  switch (reason.code) {
    case 'storeysAboveGround':
      return t(`${KEY}.reasons.storeysAboveGround`, { count: reason.count });
    case 'elevatorDeclared':
      return t(`${KEY}.reasons.elevatorDeclared`);
    default:
      return t(`${KEY}.reasons.${reason.code}`, { floor: floorLabel(reason.floor) });
  }
}

/** Πού: όλο το κτίριο, ή ο όροφος της πρότασης (από τον λόγο — ο κανόνας στάθμης κουβαλά πάντα τη στάθμη του). */
function scopeText(suggestion: CommonSpaceSuggestion, t: Translate, floorLabel: FloorLabel): string {
  const { reason } = suggestion;
  if (suggestion.floorId === null || !('floor' in reason)) return t(`${KEY}.wholeBuilding`);
  return floorLabel(reason.floor);
}

interface SuggestionItemProps {
  readonly suggestion: CommonSpaceSuggestion;
  readonly handle: CommonSpaceSuggestionsHandle;
  readonly t: Translate;
  readonly floorLabel: FloorLabel;
  readonly mutedClass: string;
}

function SuggestionItem({ suggestion, handle, t, floorLabel, mutedClass }: SuggestionItemProps) {
  const name = t(`categories.${suggestion.category}`);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2">
      <p className="min-w-0 text-sm">
        <span className="font-medium">{name}</span>
        <span className={mutedClass}> · {scopeText(suggestion, t, floorLabel)}</span>
        <span className={cn('block text-xs', mutedClass)}>{reasonText(suggestion, t, floorLabel)}</span>
      </p>
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

  if (handle.suggestions.length === 0) return null;

  return (
    <aside aria-labelledby={headingId} className="rounded-lg border p-3">
      <header className="mb-1 flex items-center gap-2">
        <Lightbulb className={cn('h-4 w-4 shrink-0', colors.text.info)} aria-hidden />
        <h3 id={headingId} className="text-sm font-semibold">{t(`${KEY}.title`)}</h3>
      </header>
      <p className={cn('mb-2 text-xs', colors.text.muted)}>{t(`${KEY}.hint`)}</p>
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
    </aside>
  );
}
