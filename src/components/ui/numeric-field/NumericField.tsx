'use client';
/**
 * =============================================================================
 * 🏢 ENTERPRISE: NumericField — the app's ONE decimal input
 * =============================================================================
 *
 * CANONICAL numeric input for every decimal value in the app (building-code
 * coefficients, prices, areas, heights…). Never hand-roll `<Input type="number">`
 * for a decimal again: it drops the separator mid-typing and silently commits a
 * wrong number (see `use-numeric-field.ts` for the mechanism).
 *
 * Usage — the model stays a plain `number`:
 * ```tsx
 * <NumericField
 *   id="bc-sd"
 *   label={t('sd.label')}      // optional: renders a scrub handle (Figma gesture)
 *   value={draft.sd}
 *   onValueChange={hook.setSd}
 *   step={0.01}
 *   min={0}
 * />
 * ```
 *
 * @module components/ui/numeric-field/NumericField
 * @see ADR-706 — Numeric field SSoT
 */

import * as React from 'react';

import { Input, type InputProps } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useNumericField, type UseNumericFieldOptions } from './use-numeric-field';

type PassthroughInputProps = Omit<
  InputProps,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'onFocus' | 'onKeyDown' | 'type' | 'role' | 'min' | 'max' | 'step'
>;

export interface NumericFieldProps extends PassthroughInputProps, UseNumericFieldOptions {
  /**
   * When provided, a `<Label>` is rendered before the input and doubles as a
   * scrub handle (drag left/right to change the value — Figma / C4D gesture).
   * Emitted as a sibling fragment, so the caller's own spacing wrapper governs
   * the layout and no extra `<div>` is introduced. Omit it when the caller
   * already renders its own label.
   */
  label?: React.ReactNode;
  /** Class applied to the rendered label. */
  labelClassName?: string;
}

export const NumericField = React.forwardRef<HTMLInputElement, NumericFieldProps>(function NumericField(
  {
    value,
    onValueChange,
    min,
    max,
    step,
    emptyValue,
    disabled = false,
    label,
    labelClassName,
    className,
    id,
    ...inputProps
  },
  ref,
) {
  const { inputProps: fieldProps, scrubHandleProps, isScrubbing } = useNumericField({
    value,
    onValueChange,
    min,
    max,
    step,
    emptyValue,
    disabled,
  });

  const input = (
    <Input
      {...inputProps}
      {...fieldProps}
      id={id}
      ref={ref}
      className={cn(isScrubbing && 'select-none', className)}
    />
  );

  if (label === undefined) return input;

  return (
    <>
      <Label htmlFor={id} {...scrubHandleProps} className={cn('select-none', labelClassName)}>
        {label}
      </Label>
      {input}
    </>
  );
});
