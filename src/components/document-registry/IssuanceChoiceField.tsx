'use client';

/**
 * @fileoverview ADR-915 §27 · §42 — **μία επιλογή από λίγες**, όλες ορατές, μέσα σε `<fieldset>/<legend>` (δόγμα
 *   `BrokeredMandateFields`: Radio, όχι Select, για 2–4 επιλογές). Κοινό για τις φόρμες του γραφείου και τη φόρμα
 *   προσφοράς της σελίδας-συνδέσμου.
 * @module components/document-registry/IssuanceChoiceField
 */

import React, { useId } from 'react';

import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { isOneOf } from '@/lib/type-guards';

export interface ChoiceFieldProps<V extends string> {
  readonly legend: string;
  readonly options: readonly V[];
  readonly value: V | null;
  readonly onChange: (value: V) => void;
  readonly labelOf: (value: V) => string;
  readonly disabled?: boolean;
}

export function ChoiceField<V extends string>({ legend, options, value, onChange, labelOf, disabled = false }: ChoiceFieldProps<V>): React.ReactElement {
  const legendId = useId();
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" aria-labelledby={legendId} disabled={disabled}>
      <legend id={legendId} className="mb-1 text-sm font-medium text-foreground">{legend}</legend>
      <RadioGroup value={value ?? ''} onValueChange={(next) => { if (isOneOf(options, next)) onChange(next); }}>
        {options.map((option) => (
          <Label key={option} className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value={option} />
            <span>{labelOf(option)}</span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  );
}
