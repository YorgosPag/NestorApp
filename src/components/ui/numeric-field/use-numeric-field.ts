/**
 * =============================================================================
 * 🏢 ENTERPRISE: Headless numeric field hook (view/model separation)
 * =============================================================================
 *
 * The ONE reason this exists: `<input type="number">` is unusable for decimals.
 * While the user types `2.4`, the browser reports the intermediate `2.` as the
 * empty string, so a controlled component parses it to 0, re-renders `"0"`, and
 * the next keystroke yields `"04"` → the field silently commits **4**.
 * (React #11877 / #17609; the same reason Adobe Spectrum, GOV.UK and MDN all
 * recommend `type="text" inputMode="decimal"` instead.)
 *
 * The fix is view/model separation: a STRING draft owns what the user sees
 * while focused, a NUMBER owns what the app stores, and they are reconciled on
 * commit. On top of that baseline this hook implements the interaction set the
 * big players ship — Figma / Revit / Cinema 4D:
 *
 *   • `.` and `,` both accepted as the decimal mark (locale-number SSoT)
 *   • math expressions — `1200/2`, `(18+3)*2`, `2,4*1,1`
 *   • arrow-key nudge — Shift = ×10, Alt = fine, PageUp/Down = ×10
 *   • Home / End jump to min / max, Escape reverts, Enter commits
 *   • pointer scrubbing on the label (Figma / C4D signature gesture)
 *   • clamp-on-commit, so typing an out-of-range prefix is never blocked
 *   • WAI-ARIA `spinbutton` semantics
 *
 * @module components/ui/numeric-field/use-numeric-field
 * @see ADR-706 — Numeric field SSoT
 */
'use client';

import * as React from 'react';

import { getCurrentLocale } from '@/lib/intl-utils';
import { evaluateNumericExpression } from './numeric-expression';
import {
  clampToBounds,
  formatForDisplay,
  formatForEditing,
  NUDGE_MULTIPLIER,
  nudgeValue,
  resolveDecimalSeparator,
  stripFloatNoise,
  type NumericBounds,
} from './numeric-field-core';

/** Pointer travel (px) that advances the value by one step while scrubbing. */
const PIXELS_PER_STEP = 2;

export interface UseNumericFieldOptions extends NumericBounds {
  /** Current model value. */
  value: number;
  /** Called with the committed model value. Never called with NaN. */
  onValueChange: (value: number) => void;
  /** Value committed when the field is cleared. Defaults to 0. */
  emptyValue?: number;
  disabled?: boolean;
}

export interface UseNumericFieldResult {
  /** Props to spread on the `<input>`. */
  readonly inputProps: React.ComponentPropsWithoutRef<'input'>;
  /** Props to spread on a label / handle to enable scrub-to-change. */
  readonly scrubHandleProps: React.HTMLAttributes<HTMLElement>;
  /** True while a scrub gesture is in progress (for cursor styling). */
  readonly isScrubbing: boolean;
}

/** Resolve the nudge multiplier from the modifier keys held down. */
function multiplierFor(event: React.KeyboardEvent | PointerEvent): number {
  if (event.shiftKey) return NUDGE_MULTIPLIER.large;
  if (event.altKey) return NUDGE_MULTIPLIER.fine;
  return NUDGE_MULTIPLIER.normal;
}

export function useNumericField({
  value,
  onValueChange,
  min,
  max,
  step,
  emptyValue = 0,
  disabled = false,
}: UseNumericFieldOptions): UseNumericFieldResult {
  const bounds = React.useMemo<NumericBounds>(() => ({ min, max, step }), [min, max, step]);
  const decimalSeparator = React.useMemo(() => resolveDecimalSeparator(getCurrentLocale()), []);

  /** Non-null only while the user is actively editing the text. */
  const [draft, setDraft] = React.useState<string | null>(null);
  const [isScrubbing, setIsScrubbing] = React.useState(false);
  /** Value to restore when the user presses Escape. */
  const valueOnFocus = React.useRef(value);

  const commit = React.useCallback(
    (next: number) => {
      const clamped = clampToBounds(stripFloatNoise(next), bounds);
      if (clamped !== value) onValueChange(clamped);
      return clamped;
    },
    [bounds, onValueChange, value],
  );

  const handleFocus = React.useCallback(() => {
    valueOnFocus.current = value;
    setDraft(formatForEditing(value, decimalSeparator));
  }, [value, decimalSeparator]);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      setDraft(raw);
      // Live model sync so validation/preview stay reactive while typing.
      // Deliberately NOT clamped — clamping mid-typing would fight the user.
      const parsed = evaluateNumericExpression(raw);
      if (raw.trim() === '') onValueChange(emptyValue);
      else if (parsed !== null) onValueChange(stripFloatNoise(parsed));
    },
    [onValueChange, emptyValue],
  );

  const handleBlur = React.useCallback(() => {
    const raw = draft;
    setDraft(null);
    if (raw === null) return;
    const parsed = raw.trim() === '' ? emptyValue : evaluateNumericExpression(raw);
    // Unparseable input (e.g. a half-typed formula) reverts to the model value.
    commit(parsed ?? value);
  }, [draft, emptyValue, commit, value]);

  const applyNudge = React.useCallback(
    (direction: 1 | -1, multiplier: number) => {
      const next = nudgeValue(value, direction, bounds, multiplier);
      commit(next);
      setDraft(formatForEditing(next, decimalSeparator));
    },
    [value, bounds, commit, decimalSeparator],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const { key } = event;

      if (key === 'ArrowUp' || key === 'ArrowDown') {
        event.preventDefault();
        applyNudge(key === 'ArrowUp' ? 1 : -1, multiplierFor(event));
        return;
      }
      if (key === 'PageUp' || key === 'PageDown') {
        event.preventDefault();
        applyNudge(key === 'PageUp' ? 1 : -1, NUDGE_MULTIPLIER.large);
        return;
      }
      if (key === 'Home' && min !== undefined) {
        event.preventDefault();
        commit(min);
        setDraft(formatForEditing(min, decimalSeparator));
        return;
      }
      if (key === 'End' && max !== undefined) {
        event.preventDefault();
        commit(max);
        setDraft(formatForEditing(max, decimalSeparator));
        return;
      }
      if (key === 'Enter') {
        event.preventDefault();
        const parsed = evaluateNumericExpression(draft ?? '');
        const committed = commit(parsed ?? value);
        setDraft(formatForEditing(committed, decimalSeparator));
        return;
      }
      if (key === 'Escape') {
        // ADR-364 T2 — «υπάρχει ανταγωνιστής;». The Escape Command Bus listens on
        // `window` capture but deliberately SKIPS editable focus, so it is not a
        // competitor here. The ambient dismiss layer of the host dialog (Radix
        // `DismissableLayer`, on `document`) is: without the guard below a single
        // press would revert the draft AND close the dialog underneath it.
        // Semantics (Figma / VS Code / Revit): the first press undoes the pending
        // edit, the second — with nothing left to undo — reaches the dialog.
        const pristine = formatForEditing(valueOnFocus.current, decimalSeparator);
        if (draft === null || draft === pristine) return;
        event.preventDefault();
        event.stopPropagation();
        commit(valueOnFocus.current);
        setDraft(pristine);
      }
    },
    [applyNudge, commit, decimalSeparator, draft, max, min, value],
  );

  const handleScrubDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (disabled || event.button !== 0) return;
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setIsScrubbing(true);

      const startX = event.clientX;
      const startValue = value;
      let committed = value;

      const onMove = (moveEvent: PointerEvent) => {
        const steps = Math.trunc((moveEvent.clientX - startX) / PIXELS_PER_STEP);
        if (steps === 0) return;
        const target = nudgeValue(startValue, steps > 0 ? 1 : -1, bounds, Math.abs(steps) * multiplierFor(moveEvent));
        if (target !== committed) {
          committed = target;
          onValueChange(target);
        }
      };
      const onUp = () => {
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        setIsScrubbing(false);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
    },
    [bounds, disabled, onValueChange, value],
  );

  const displayValue = draft ?? formatForDisplay(value);

  return {
    inputProps: {
      // NOT type="number" — see the module header. This is the whole fix.
      type: 'text',
      inputMode: 'decimal',
      autoComplete: 'off',
      role: 'spinbutton',
      'aria-valuenow': Number.isFinite(value) ? value : undefined,
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuetext': formatForDisplay(value),
      value: displayValue,
      disabled,
      onFocus: handleFocus,
      onChange: handleChange,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
    },
    scrubHandleProps: {
      onPointerDown: handleScrubDown,
      style: { cursor: disabled ? undefined : 'ew-resize', touchAction: 'none' },
    },
    isScrubbing,
  };
}
