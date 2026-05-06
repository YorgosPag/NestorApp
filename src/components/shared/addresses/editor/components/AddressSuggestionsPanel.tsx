'use client';

import { useRef } from 'react';
import { MapPin, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { AddressConfidenceMeter } from './AddressConfidenceMeter';
import { FIELD_LABEL_I18N_KEY } from '../helpers/fieldLabels';
import type { GeocodingApiResponse, ResolvedAddressFields, SuggestionRanking, SuggestionTrigger } from '../types';

const TRIGGER_I18N_KEY: Record<SuggestionTrigger, string> = {
  'no-results-after-retry': 'editor.suggestions.triggerReason.noResultsAfterRetry',
  'low-confidence': 'editor.suggestions.triggerReason.lowConfidence',
  'multiple-candidates-similar': 'editor.suggestions.triggerReason.multipleCandidatesSimilar',
  'partial-match-flag': 'editor.suggestions.triggerReason.partialMatchFlag',
};

export interface AddressSuggestionsPanelProps {
  trigger: SuggestionTrigger | null;
  candidates: SuggestionRanking[];
  nextOmitField: keyof ResolvedAddressFields | null;
  retryExhausted: boolean;
  onSelect: (candidate: GeocodingApiResponse) => void;
  onRetry?: (field: keyof ResolvedAddressFields) => void;
  onDismiss?: () => void;
  className?: string;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}`;
  return `${(meters / 1000).toFixed(1)}κμ`;
}

export function AddressSuggestionsPanel({
  trigger,
  candidates,
  nextOmitField,
  retryExhausted,
  onSelect,
  onRetry,
  onDismiss,
  className,
}: AddressSuggestionsPanelProps) {
  const { t } = useTranslation('addresses');
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleItemKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(candidates.length - 1, index + 1);
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      itemRefs.current[prev]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss?.();
    }
  }

  return (
    <section className={cn('border rounded-md overflow-hidden', className)}>
      <header className="flex items-start justify-between px-3 py-2 bg-muted/40 border-b gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">{t('editor.suggestions.title')}</p>
          {trigger && (
            <p className="text-xs text-muted-foreground truncate">
              {t(TRIGGER_I18N_KEY[trigger])}
            </p>
          )}
        </div>
        {onDismiss && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 shrink-0"
            onClick={onDismiss}
            aria-label={t('editor.suggestions.dismiss')}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </header>

      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground px-3 py-3 text-center">
          {t('editor.suggestions.empty')}
        </p>
      ) : (
        <ul role="listbox" aria-label={t('editor.suggestions.title')} className="divide-y">
          {candidates.map((ranking, idx) => (
            <li key={ranking.candidate.displayName + idx} role="option" aria-selected={false}>
              <button
                ref={(el) => { itemRefs.current[idx] = el; }}
                type="button"
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 text-left text-xs',
                  'hover:bg-muted/60 focus:bg-muted/80 focus:outline-none transition-colors',
                )}
                onClick={() => onSelect(ranking.candidate)}
                onKeyDown={(e) => handleItemKeyDown(e, idx)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />

                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium text-foreground">
                    {ranking.candidate.displayName}
                  </span>
                  <span className="flex items-center gap-2 mt-0.5">
                    <AddressConfidenceMeter
                      confidence={ranking.candidate.confidence}
                      className="w-16"
                    />
                    <span className="text-muted-foreground">
                      {t('editor.suggestions.confidence', {
                        percent: Math.round(ranking.candidate.confidence * 100),
                      })}
                    </span>
                    {ranking.distanceFromCenterM !== null && (
                      <span className="text-muted-foreground">
                        {t('editor.suggestions.distance', {
                          distance: formatDistance(ranking.distanceFromCenterM),
                        })}
                      </span>
                    )}
                  </span>
                </span>

                {idx === 0 && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {t('editor.suggestions.select')}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {(nextOmitField || retryExhausted) && (
        <footer className="px-3 py-2 border-t bg-muted/20">
          {retryExhausted ? (
            <p className="text-xs text-muted-foreground">{t('editor.suggestions.noMoreRetries')}</p>
          ) : nextOmitField && onRetry ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={() => onRetry(nextOmitField)}
            >
              <RotateCcw className="h-3 w-3" />
              {t('editor.suggestions.retryWithout', {
                field: t(FIELD_LABEL_I18N_KEY[nextOmitField]),
              })}
            </Button>
          ) : null}
        </footer>
      )}
    </section>
  );
}
