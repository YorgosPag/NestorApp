/**
 * @related ADR-186 §8 Q4 — Frontages count integer with ± buttons
 */
'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PHASE2_VALIDATION_LIMITS } from '@/services/building-code/constants/validation.constants';

interface FrontagesCounterProps {
  value: number;
  onChange(value: number): void;
  disabled?: boolean;
}

export function FrontagesCounter({
  value,
  onChange,
  disabled = false,
}: FrontagesCounterProps) {
  const { t } = useTranslation('buildingCode');
  const { hardMin, hardMax } = PHASE2_VALIDATION_LIMITS.frontagesCount;

  const decrement = () => {
    if (value > hardMin) onChange(value - 1);
  };
  const increment = () => {
    if (value < hardMax) onChange(value + 1);
  };

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || value <= hardMin}
        onClick={decrement}
        aria-label={t('frontagesCount.decrement')}
        className="h-9 w-9 p-0"
      >
        <Minus className="h-4 w-4" aria-hidden />
      </Button>
      <span
        className="min-w-[2.5rem] text-center text-base font-medium tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || value >= hardMax}
        onClick={increment}
        aria-label={t('frontagesCount.increment')}
        className="h-9 w-9 p-0"
      >
        <Plus className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
