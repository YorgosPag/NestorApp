/**
 * =============================================================================
 * SLIDER VALUE FIELD — the value beside a slider label (ADR-682)
 * =============================================================================
 *
 * Two renderings, chosen by a single rule:
 *
 *   EDITABLE   — a `unit` (format+parse pair) AND an accessible name are given.
 *   READ-ONLY  — anything missing. A plain, non-focusable `<span>`.
 *
 * WHY the rule: making the field editable is a promise that whatever the user
 * types can come back out. Only a `SliderValueUnit` can keep that promise — a
 * display-only `formatValue` renders "60%" but reads a raw number, so "80"
 * lands as 8000% → clamped to the max, with no keystroke that reaches 80%.
 * And a focusable control with no accessible name fails WCAG 4.1.2.
 *
 * So the degradation is deliberate: a call site that passes neither keeps the
 * exact read-only span it had before this component existed — zero a11y debt,
 * zero regression. Adopting a unit is an upgrade, never a prerequisite.
 *
 * FOCUSED TEXT is DISPLAY space without the symbol (`unit.formatEdit`), the
 * same space `unit.parse` reads. Showing the raw model number instead would
 * make an edit of 0.6 → 0.7 mean 0.7% for a percent unit.
 *
 * Zero inline styles. Fixed width so the layout never jumps while typing.
 */

import React from 'react';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import type { SliderValueUnit } from './slider-value-units';
import {
  useSliderValueEditing,
  type SliderValueStatus,
} from './useSliderValueEditing';

export { normalizeSliderValue } from './useSliderValueEditing';

// =============================================================================
// PROPS
// =============================================================================

interface SliderValueFieldProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Default 1. Fractional steps supported (e.g. 0.1). */
  step?: number;
  /**
   * Format+parse pair. Supplying it is what makes the field editable —
   * see the degradation rule above.
   */
  unit?: SliderValueUnit;
  /** Already-translated accessible name (no i18n happens in this component). */
  ariaLabel?: string;
  /** Ties the field to an external `<label htmlFor>`. */
  id?: string;
  /** Legacy DISPLAY-ONLY formatter. Never makes the field editable. */
  formatValue?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

// =============================================================================
// SHARED PRESENTATION
// =============================================================================

/** Geometry/typography shared by both renderings so they never drift apart. */
const FIELD_SHAPE = [
  PANEL_LAYOUT.WIDTH.MD,
  PANEL_LAYOUT.TEXT_ALIGN.RIGHT,
  PANEL_LAYOUT.TYPOGRAPHY.XS,
  PANEL_LAYOUT.PADDING.HORIZONTAL_HALF,
].join(' ');

// =============================================================================
// ENTRY — picks the rendering, then delegates. No hooks before the branch.
// =============================================================================

export function SliderValueField(props: SliderValueFieldProps) {
  const { unit, ariaLabel } = props;

  if (!unit || !ariaLabel?.trim()) {
    return <SliderValueReadout {...props} />;
  }
  return <SliderValueInput {...props} unit={unit} ariaLabel={ariaLabel} />;
}

// =============================================================================
// READ-ONLY RENDERING — the safe path
// =============================================================================

function SliderValueReadout({
  value,
  formatValue,
  className = '',
}: SliderValueFieldProps) {
  const colors = useSemanticColors();
  const text = formatValue ? formatValue(value) : String(value);

  return (
    <span className={`${FIELD_SHAPE} ${colors.text.muted} ${className}`}>{text}</span>
  );
}

// =============================================================================
// EDITABLE RENDERING — only reachable with a unit + an accessible name
// =============================================================================

interface SliderValueInputProps extends SliderValueFieldProps {
  unit: SliderValueUnit;
  ariaLabel: string;
}

function SliderValueInput(props: SliderValueInputProps) {
  const { value, min, max, onChange, unit, ariaLabel, id } = props;
  const { step = 1, disabled = false, className = '' } = props;

  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  const editing = useSliderValueEditing({ value, min, max, step, unit, disabled, onChange });
  const stateClassName = resolveStateClassName(editing.status, editing.isEditing, { quick, colors });

  return (
    <input
      ref={editing.inputRef}
      id={id}
      type="text"
      inputMode="decimal"
      value={editing.text}
      onFocus={editing.handleFocus}
      onChange={editing.handleTextChange}
      onBlur={editing.handleBlur}
      onKeyDown={editing.handleKeyDown}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-invalid={editing.status !== 'ok'}
      className={[
        FIELD_SHAPE,
        PANEL_LAYOUT.INPUT.FOCUS,
        PANEL_LAYOUT.INTERACTIVE.DISABLED,
        stateClassName,
        className,
      ].join(' ')}
    />
  );
}

// =============================================================================
// STATE STYLING — rejection and clamping must both be SEEN, not just announced
// =============================================================================

interface StateTokens {
  quick: ReturnType<typeof useBorderTokens>['quick'];
  colors: ReturnType<typeof useSemanticColors>;
}

function resolveStateClassName(
  status: SliderValueStatus,
  isEditing: boolean,
  { quick, colors }: StateTokens
): string {
  if (status === 'rejected') return `${quick.error} ${colors.text.error}`;
  if (status === 'clamped') return `${quick.warning} ${colors.text.warning}`;
  if (isEditing) return `${quick.input} ${colors.bg.hover} ${colors.text.primary}`;
  return colors.text.muted;
}
