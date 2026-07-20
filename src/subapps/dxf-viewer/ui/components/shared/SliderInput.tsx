/**
 * =============================================================================
 * SLIDER INPUT — SSoT for every DXF Viewer slider (ADR-682)
 * =============================================================================
 *
 * Wrapper around @/components/ui/slider (Radix UI Slider primitive).
 * Zero inline styles. Filled track cross-browser via bg-primary on SliderRange.
 *
 * The value shown next to the label becomes TYPE-ABLE (ADR-682) as soon as the
 * call site declares a `unit` — click it and type an exact number (Enter/blur
 * commits, Escape reverts, Arrow keys nudge by step). The slider is then the
 * SECONDARY affordance, matching Revit / ArchiCAD / Cinema 4D / Figma.
 *
 * Without a `unit` — or without a `label`/`tooltip` to name the field — the
 * value degrades to the read-only span it has always been. See
 * SliderValueField for why that rule exists.
 *
 * Variants:
 *   - Slider only (default)
 *   - Slider + paired number input (showNumberInput)
 *   - Value beside the label (showValue), editable when `unit` is given
 */

import React, { useId, useMemo } from 'react';
import { Slider } from '@/components/ui/slider';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { SliderValueField } from './SliderValueField';
import type { SliderValueUnit } from './slider-value-units';

// =============================================================================
// PROPS
// =============================================================================

interface SliderInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Default 1. Use fractional step for float values (e.g. 0.1) */
  step?: number;
  /** Label shown above the slider */
  label?: string;
  /** Show formatted value to the right of the label */
  showValue?: boolean;
  /** Custom value formatter. Default: String(value). DISPLAY ONLY — never editable. */
  formatValue?: (v: number) => string;
  /**
   * Format+parse pair for the value beside the label. Supplying it (together
   * with a `label` or `tooltip` to name the field) makes that value editable.
   */
  unit?: SliderValueUnit;
  /** Show paired <input type="number"> to the right of the slider */
  showNumberInput?: boolean;
  disabled?: boolean;
  /**
   * ACCESSIBLE NAME ONLY — never rendered as a native `title` tooltip.
   *
   * Used when there is no visible `label` (or to name the value field beside
   * one): it becomes the slider thumb's `aria-label` and the value field's
   * accessible name. It does NOT produce a hover bubble; see the note on the
   * component for why.
   */
  tooltip?: string;
  className?: string;
}

// =============================================================================
// A11Y WIRING
// =============================================================================

interface SliderFieldIds {
  readonly valueFieldId: string;
  readonly numberInputId: string;
  /** Name handed to the value field; `undefined` forces the read-only path. */
  readonly accessibleName: string | undefined;
  /** Label target — only ever a control that exists AND can take focus. */
  readonly labelTargetId: string | undefined;
}

/**
 * Accessible name for the value field: the visible label, else the tooltip.
 * With neither, SliderValueField degrades to a read-only span rather than
 * shipping a focusable control without a name (WCAG 4.1.2).
 */
function useSliderFieldIds(props: SliderInputProps): SliderFieldIds {
  const { label, tooltip, unit, showValue, showNumberInput } = props;
  const baseId = useId();

  return useMemo(() => {
    const valueFieldId = `${baseId}-value`;
    const numberInputId = `${baseId}-number`;
    const accessibleName = label ?? tooltip;
    const isValueEditable =
      Boolean(showValue) && Boolean(unit) && Boolean(accessibleName?.trim());

    return {
      valueFieldId,
      numberInputId,
      accessibleName,
      labelTargetId: isValueEditable
        ? valueFieldId
        : showNumberInput
          ? numberInputId
          : undefined,
    };
  }, [baseId, label, tooltip, unit, showValue, showNumberInput]);
}

// =============================================================================
// HEADER ROW — label + value
// =============================================================================

interface SliderHeaderRowProps {
  readonly props: SliderInputProps;
  readonly ids: SliderFieldIds;
}

function SliderHeaderRow({ props, ids }: SliderHeaderRowProps) {
  const { label, showValue, value, min, max, step = 1, onChange } = props;
  const { formatValue, unit, disabled = false } = props;
  const colors = useSemanticColors();

  return (
    <div className="flex justify-between items-center">
      {label && (
        <label
          htmlFor={ids.labelTargetId}
          className={`block ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.secondary}`}
        >
          {label}
        </label>
      )}
      {showValue && (
        <SliderValueField
          id={ids.valueFieldId}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={onChange}
          formatValue={formatValue}
          unit={unit}
          ariaLabel={ids.accessibleName}
          disabled={disabled}
        />
      )}
    </div>
  );
}

// =============================================================================
// PAIRED NUMBER INPUT
// =============================================================================

function SliderNumberInput({ props, ids }: SliderHeaderRowProps) {
  const { value, min, max, step = 1, onChange, disabled = false, label, tooltip } = props;
  const colors = useSemanticColors();
  const { quick } = useBorderTokens();

  /**
   * Guard: clearing an `<input type="number">` yields '' → parseFloat → NaN,
   * which used to be written straight into the setting.
   */
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(e.target.value);
    if (!Number.isFinite(parsed)) return;
    onChange(parsed);
  };

  return (
    <input
      id={ids.numberInputId}
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={handleNumberChange}
      disabled={disabled}
      aria-label={label ? undefined : tooltip}
      className={`${PANEL_LAYOUT.WIDTH.MD} ${PANEL_LAYOUT.INPUT.PADDING_COMPACT} ${colors.bg.hover} ${quick.input} ${colors.text.primary} ${PANEL_LAYOUT.INPUT.TEXT_SIZE}`}
    />
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

/*
 * WHY THE WRAPPER CARRIES NO `title` (ADR-682 round 3).
 *
 * `tooltip` used to be handed to the wrapper as a native `title`, so 18 sliders
 * grew a browser hover bubble that merely REPEATED the heading already rendered
 * right above them — noise, not information. Worse, a native `title` is
 * unreachable by keyboard, invisible to touch, and uncontrollable in styling and
 * timing (hence the CHECK 3.23 ratchet).
 *
 * The prop's real job is to NAME the control, and it already does that where
 * naming actually lands: `thumbAriaLabel` on the Radix thumb (which is what
 * carries role="slider") and the value field's accessible name. Dropping the
 * attribute loses no information for any user — it only stops duplicating the
 * visible label — and ratchets 3.23 downward.
 *
 * `tooltip` is therefore NOT destructured below: it is consumed only through
 * `useSliderFieldIds`, never rendered as an attribute.
 */
export function SliderInput(props: SliderInputProps) {
  const { value, min, max, onChange, step = 1 } = props;
  const { label, showValue = false, showNumberInput = false } = props;
  const { disabled = false, className = '' } = props;

  const ids = useSliderFieldIds(props);

  // Stable array ref — Radix Slider's internal useMemo has this as a dep
  const sliderValues = useMemo(() => [value], [value]);

  const handleSliderChange = (values: number[]) => onChange(values[0]);

  return (
    <div className={`${PANEL_LAYOUT.SPACING.GAP_SM} ${className}`}>
      {(label || showValue) && <SliderHeaderRow props={props} ids={ids} />}

      <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
        <Slider
          value={sliderValues}
          min={min}
          max={max}
          step={step}
          onValueChange={handleSliderChange}
          disabled={disabled}
          thumbAriaLabel={ids.accessibleName}
          className="flex-1"
        />
        {showNumberInput && <SliderNumberInput props={props} ids={ids} />}
      </div>
    </div>
  );
}
