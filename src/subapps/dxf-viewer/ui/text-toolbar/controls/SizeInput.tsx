'use client';

/**
 * ADR-344 Phase 5.C — Numeric size input with drag-scrubbing.
 *
 * Touch + mouse drag on the label scrubs the value by ±0.1 per pixel.
 * Pointer events used uniformly (Q10) so mobile + desktop share one path.
 * `value === null` (mixed) renders empty placeholder.
 */

import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { MixedValue } from '../../../text-engine/types';

interface SizeInputProps {
  readonly value: MixedValue<number>;
  readonly onChange: (next: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unitLabelKey: string;
  readonly disabled?: boolean;
}

export function SizeInput({
  value,
  onChange,
  min = 0,
  max = 1000,
  step = 0.1,
  unitLabelKey,
  disabled,
}: SizeInputProps) {
  const { t } = useTranslation(['textToolbar']);
  const dragOriginX = useRef<number | null>(null);
  const dragOriginValue = useRef<number>(0);

  const clamp = useCallback((n: number) => Math.min(max, Math.max(min, n)), [min, max]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLLabelElement>) => {
      if (disabled || value === null) return;
      dragOriginX.current = e.clientX;
      dragOriginValue.current = value;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [disabled, value],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLLabelElement>) => {
      if (dragOriginX.current === null) return;
      const dx = e.clientX - dragOriginX.current;
      onChange(clamp(dragOriginValue.current + dx * step));
    },
    [clamp, onChange, step],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLLabelElement>) => {
    dragOriginX.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const display = value === null ? '' : String(value);

  return (
    <label
      className={cn(
        'inline-flex items-center gap-1 select-none',
        !disabled && 'cursor-ew-resize',
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {t(unitLabelKey)}
      </span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={display}
        disabled={disabled}
        placeholder={value === null ? '—' : undefined}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(clamp(v));
        }}
        className={cn(
          'h-9 w-16 min-h-[44px] sm:min-h-[36px] rounded border px-2 text-sm',
          'bg-background focus:outline-none focus:ring-2',
          disabled && 'opacity-40',
        )}
        data-state={value === null ? 'indeterminate' : 'determinate'}
        aria-label={t(unitLabelKey)}
      />
    </label>
  );
}
