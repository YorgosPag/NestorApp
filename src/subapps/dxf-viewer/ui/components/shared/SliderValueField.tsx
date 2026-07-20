/**
 * =============================================================================
 * SLIDER VALUE FIELD — inline-editable numeric field for SliderInput (ADR-682)
 * =============================================================================
 *
 * Figma / Cinema 4D / Revit grade scalar affordance: the number is the PRIMARY
 * input, the slider is the secondary one. Blurred → shows the formatted value
 * (e.g. "20%"). Focused → becomes a raw numeric text field (no unit symbol)
 * with the whole text auto-selected.
 *
 * Commit semantics:
 *   - Enter / blur → parse, clamp to [min,max], quantize to the nearest step,
 *                    then onChange (skipped when the value did not change).
 *   - Invalid / empty input → revert to the previous value, NO onChange.
 *   - Escape → revert without commit + blur.
 *   - ArrowUp / ArrowDown → ±1 step, Shift+Arrow → ±10 steps (C4D/Figma).
 *
 * Zero inline styles. Fixed width so the layout never jumps while typing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { clamp } from '../../../utils/scalar-math';
import { quantizeToStep } from '../../../rendering/entities/shared/geometry-utils';
import { handleInlineRenameKey } from '../../utils/inline-rename-keyboard';

// =============================================================================
// PURE HELPERS
// =============================================================================

/** Decimal places carried by `step` — used to kill float noise after quantization. */
function decimalsOfStep(step: number): number {
  const text = String(step);
  const exponent = text.indexOf('e-');
  if (exponent >= 0) return Number(text.slice(exponent + 2));
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * Clamp to [min,max] and quantize to the step grid anchored at `min`
 * (same grid Radix Slider uses), then strip float noise.
 */
export function normalizeSliderValue(
  raw: number,
  min: number,
  max: number,
  step: number
): number {
  const clamped = clamp(raw, min, max);
  const quantized = step > 0 ? min + quantizeToStep(clamped - min, step) : clamped;
  const bounded = clamp(quantized, min, max);
  const factor = 10 ** decimalsOfStep(step);
  return Math.round(bounded * factor) / factor;
}

// =============================================================================
// PROPS
// =============================================================================

interface SliderValueFieldProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Default 1. Fractional steps supported (e.g. 0.1) */
  step?: number;
  /** Formatter used ONLY while blurred (editing always shows the raw number) */
  formatValue?: (v: number) => string;
  /** Already-translated accessible name (no i18n happens in this component) */
  label?: string;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SliderValueField({
  value,
  min,
  max,
  onChange,
  step = 1,
  formatValue,
  label,
  disabled = false,
  className = '',
}: SliderValueFieldProps) {
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  const inputRef = useRef<HTMLInputElement>(null);
  /** `null` = not editing; string = in-flight draft text */
  const [draft, setDraft] = useState<string | null>(null);
  /** Set right before a programmatic blur() so blur does not commit twice */
  const skipBlurCommitRef = useRef(false);

  const isEditing = draft !== null;

  useEffect(() => {
    if (isEditing) inputRef.current?.select();
  }, [isEditing]);

  const commitText = useCallback(
    (text: string) => {
      setDraft(null);
      const trimmed = text.trim();
      if (trimmed === '') return;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return;
      const next = normalizeSliderValue(parsed, min, max, step);
      if (next !== value) onChange(next);
    },
    [min, max, step, value, onChange]
  );

  const nudge = useCallback(
    (direction: 1 | -1, coarse: boolean) => {
      const base = draft !== null ? Number(draft) : value;
      const start = Number.isFinite(base) ? base : value;
      const next = normalizeSliderValue(
        start + direction * step * (coarse ? 10 : 1),
        min,
        max,
        step
      );
      setDraft(String(next));
      if (next !== value) onChange(next);
    },
    [draft, value, min, max, step, onChange]
  );

  const handleFocus = useCallback(() => setDraft(String(value)), [value]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    []
  );

  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false;
        return;
      }
      commitText(event.target.value);
    },
    [commitText]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        nudge(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey);
        return;
      }
      // Local <input> Enter/Escape via the SSoT helper (ADR-364 allowlist):
      // the Escape Command Bus intentionally skips editable focus.
      const target = event.currentTarget;
      handleInlineRenameKey(event, {
        onConfirm: () => {
          skipBlurCommitRef.current = true;
          commitText(target.value);
          target.blur();
        },
        onCancel: () => {
          skipBlurCommitRef.current = true;
          setDraft(null);
          target.blur();
        },
      });
    },
    [commitText, nudge]
  );

  const formatted = formatValue ? formatValue(value) : String(value);
  const fieldClassName = [
    PANEL_LAYOUT.WIDTH.MD,
    PANEL_LAYOUT.TEXT_ALIGN.RIGHT,
    PANEL_LAYOUT.TYPOGRAPHY.XS,
    PANEL_LAYOUT.PADDING.HORIZONTAL_HALF,
    PANEL_LAYOUT.INPUT.FOCUS,
    PANEL_LAYOUT.INTERACTIVE.DISABLED,
    isEditing ? `${quick.input} ${colors.bg.hover} ${colors.text.primary}` : colors.text.muted,
    className,
  ].join(' ');

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={draft ?? formatted}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      aria-label={label || undefined}
      className={fieldClassName}
    />
  );
}
