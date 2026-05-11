'use client';

/**
 * ADR-344 Phase 5.C — Justification 3×3 grid control.
 *
 * Renders the nine MTEXT attachment points (TL/TC/TR/ML/MC/MR/BL/BC/BR)
 * as buttons. `value === null` represents indeterminate (mixed selection)
 * and renders the grid with `data-state="indeterminate"` so no cell is
 * highlighted — mirrors Figma / Illustrator multi-select UX.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MixedValue, TextJustification } from '../../../text-engine/types';

const POINTS: readonly TextJustification[] = [
  'TL', 'TC', 'TR',
  'ML', 'MC', 'MR',
  'BL', 'BC', 'BR',
] as const;

interface JustificationGridProps {
  readonly value: MixedValue<TextJustification>;
  readonly onChange: (next: TextJustification) => void;
  readonly disabled?: boolean;
}

export function JustificationGrid({ value, onChange, disabled }: JustificationGridProps) {
  const { t } = useTranslation(['textToolbar']);
  const state = value === null ? 'indeterminate' : 'determinate';

  return (
    <fieldset
      className="grid grid-cols-3 gap-0.5 p-1 rounded border"
      data-state={state}
      disabled={disabled}
      aria-label={t('textToolbar:justification.label')}
    >
      {POINTS.map((point) => {
        const isActive = value === point;
        return (
          <button
            key={point}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={t(`textToolbar:justification.${point}`)}
            onClick={() => onChange(point)}
            disabled={disabled}
            className={cn(
              'h-7 w-7 min-h-[28px] min-w-[28px] rounded text-[10px] font-mono',
              'border focus:outline-none focus:ring-2',
              isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted border-transparent',
              disabled && 'opacity-40 cursor-not-allowed',
            )}
            data-justification={point}
          >
            {point}
          </button>
        );
      })}
    </fieldset>
  );
}
