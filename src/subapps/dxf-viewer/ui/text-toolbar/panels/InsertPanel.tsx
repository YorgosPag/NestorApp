'use client';

/**
 * ADR-344 Phase 5.D — Insert panel.
 *
 * Buttons that pipe inline MTEXT codes into the active editor:
 *   - Stack (\S) — opens a small dialog later (Phase 6); placeholder action now
 *   - Special chars %%c (⌀), %%d (°), %%p (±)
 *
 * The actual editor command execution lives in Phase 5.H (TipTap
 * mount). For now the buttons emit events via `onInsert`.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface InsertPanelProps {
  readonly onInsert: (token: string) => void;
  readonly disabled?: boolean;
}

const SPECIAL_CHARS: ReadonlyArray<{ readonly token: string; readonly display: string; readonly labelKey: string }> = [
  { token: '%%c', display: '⌀', labelKey: 'textToolbar:insert.diameter' },
  { token: '%%d', display: '°', labelKey: 'textToolbar:insert.degree' },
  { token: '%%p', display: '±', labelKey: 'textToolbar:insert.plusMinus' },
] as const;

export function InsertPanel({ onInsert, disabled }: InsertPanelProps) {
  const { t } = useTranslation(['textToolbar']);

  return (
    <section className="flex flex-wrap items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onInsert('\\S')}
        disabled={disabled}
        aria-label={t('textToolbar:insert.stack')}
        className={cn('min-h-[44px] sm:min-h-[36px]')}
      >
        <span aria-hidden="true" className="text-xs font-mono">¹⁄₂</span>
      </Button>
      {SPECIAL_CHARS.map((c) => (
        <Button
          key={c.token}
          variant="outline"
          size="sm"
          onClick={() => onInsert(c.token)}
          disabled={disabled}
          aria-label={t(c.labelKey)}
          className={cn('min-h-[44px] sm:min-h-[36px]')}
        >
          <span aria-hidden="true">{c.display}</span>
        </Button>
      ))}
    </section>
  );
}
