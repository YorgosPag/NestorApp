/**
 * @module components/reports/builder/AIQueryInput
 * @enterprise ADR-268 — AI Natural Language Query Input
 *
 * Text input with sparkle icon. Shows confidence + explanation after translation.
 */

'use client';

import '@/lib/design-system';
import { useState, useCallback, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AITranslatedQuery } from '@/config/report-builder/report-builder-types';

interface AIQueryInputProps {
  onSubmit: (query: string) => Promise<void>;
  loading: boolean;
  result: AITranslatedQuery | null;
}

export function AIQueryInput({ onSubmit, loading, result }: AIQueryInputProps) {
  const { t } = useTranslation('report-builder');
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (query.trim() && !loading) {
        onSubmit(query.trim());
      }
    },
    [query, loading, onSubmit],
  );

  return (
    <section className="space-y-2" aria-label={t('ai.label')}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('ai.placeholder')}
            className="pl-10"
            maxLength={500}
            disabled={loading}
          />
        </div>
        <Button type="submit" disabled={loading || !query.trim()} variant="outline">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t('ai.submit')
          )}
        </Button>
      </form>

      {/* AI Result Banner */}
      {result && (
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-purple-500" />
          <span className="flex-1">{result.explanation}</span>
          <ConfidenceBadge value={result.confidence} />
        </div>
      )}
    </section>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const { t } = useTranslation('report-builder');
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? 'text-success' : value >= 0.5 ? 'text-warning' : 'text-destructive';

  return (
    <span className={`shrink-0 text-xs font-medium ${color}`}>
      {t('ai.confidence')}: {pct}%
    </span>
  );
}
