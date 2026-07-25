'use client';
/**
 * Numeric branch of {@link UnifiedFormField}, extracted so the numeric-field
 * hook can be called unconditionally (Rules of Hooks) while the parent keeps
 * switching on `type`.
 *
 * Before ADR-706 this branch rendered `<Input type="number">` bound to a number
 * state and parsed with `parseFloat`, which meant BOTH decimal separators were
 * broken: `2.` came back from the browser as the empty string (→ value reset),
 * and `parseFloat('2,4')` silently returns 2. Delegating to the SSoT fixes both.
 *
 * @module components/core/FormFields/FormFieldNumericInput
 * @see ADR-706 — Numeric field SSoT
 */

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { useNumericField } from '@/components/ui/numeric-field';
import { cn } from '@/lib/utils';

export interface FormFieldNumericInputProps {
  id?: string;
  name?: string;
  value: number | undefined;
  onValueChange: (value: number) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'data-testid'?: string;
}

export const FormFieldNumericInput = React.forwardRef<HTMLInputElement, FormFieldNumericInputProps>(
  function FormFieldNumericInput(
    { value, onValueChange, min, max, step, disabled, readOnly, className, onBlur, onFocus, ...rest },
    ref,
  ) {
    const { inputProps } = useNumericField({
      value: value ?? 0,
      onValueChange,
      min,
      max,
      step,
      disabled: disabled || readOnly,
    });

    return (
      <Input
        {...rest}
        {...inputProps}
        onBlur={(event) => {
          inputProps.onBlur?.(event);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          inputProps.onFocus?.(event);
          onFocus?.(event);
        }}
        readOnly={readOnly}
        ref={ref}
        className={cn(className)}
      />
    );
  },
);
