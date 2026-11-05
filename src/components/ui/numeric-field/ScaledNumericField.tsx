'use client';

/**
 * @fileoverview **Πεδία ακέραιου μοντέλου**: ποσό (λεπτά) · ποσοστό (μονάδες βάσης) · ποσότητα (χιλιοστά) — λεπτά
 *   περιτυλίγματα του `NumericField` (ADR-706 · ADR-928 Φ3γ-2 απόφαση 3).
 * @module components/ui/numeric-field/ScaledNumericField
 *
 * 🔑 Η μετατροπή ζει **μία** φορά (`scaled-value.ts`). Καμία φόρμα δεν ξαναγράφει `* 100`.
 * 🔑 `nullable`: το κενό πεδίο σημαίνει «δεν ορίστηκε» (`null`), όχι μηδέν. Π.χ. γραμμή τιμής μονάδας χωρίς εκτίμηση
 *    ποσότητας, ή τιμή πελάτη που δεν υπάρχει. Ο φρουρός `BLANK` είναι αρνητικός και δεν είναι ποτέ τιμή, γιατί το
 *    `min={0}` κόβει κάθε αρνητική πληκτρολόγηση.
 */

import { NumericField, type NumericFieldProps } from './NumericField';
import { COUNT_SCALE, MILLI_QUANTITY_SCALE, modelOfDisplay, MONEY_SCALE, PERCENT_SCALE, type ValueScale } from './scaled-value';

type PassthroughProps = Omit<NumericFieldProps, 'value' | 'onValueChange' | 'blankValue' | 'emptyValue' | 'min' | 'max'>;

interface RequiredValueProps extends PassthroughProps {
  readonly value: number;
  readonly onValueChange: (model: number) => void;
  readonly nullable?: false;
}

interface NullableValueProps extends PassthroughProps {
  readonly value: number | null;
  readonly onValueChange: (model: number | null) => void;
  readonly nullable: true;
}

export type ScaledFieldProps = RequiredValueProps | NullableValueProps;

/** Η τιμή που ζωγραφίζεται κενή — ποτέ τιμή του μοντέλου (`min={0}`). */
const BLANK = -1;

function commitOf(props: ScaledFieldProps, scale: ValueScale): (display: number) => void {
  if (props.nullable) {
    const { onValueChange } = props;
    return (display) => onValueChange(display === BLANK ? null : modelOfDisplay(display, scale));
  }
  const { onValueChange } = props;
  return (display) => onValueChange(modelOfDisplay(display, scale));
}

function ScaledNumericField({ scale, max, ...props }: ScaledFieldProps & { readonly scale: ValueScale; readonly max?: number }) {
  const commit = commitOf(props, scale);
  const { value, nullable, onValueChange: _ignored, ...rest } = props;
  const shown = value === null ? BLANK : scale.toDisplay(value);
  return (
    <NumericField
      {...rest}
      value={shown}
      onValueChange={commit}
      min={0}
      max={max}
      blankValue={nullable ? BLANK : undefined}
      emptyValue={nullable ? BLANK : 0}
    />
  );
}

/** Ποσό σε ευρώ στην οθόνη, **λεπτά** στο μοντέλο. */
export function MoneyField(props: ScaledFieldProps) {
  return <ScaledNumericField {...props} scale={MONEY_SCALE} />;
}

/** Ποσοστό 0–100 στην οθόνη, **μονάδες βάσης** στο μοντέλο. */
export function PercentField(props: ScaledFieldProps) {
  return <ScaledNumericField {...props} scale={PERCENT_SCALE} max={100} />;
}

/** Ποσότητα στην οθόνη, **χιλιοστά της μονάδας** στο μοντέλο. */
export function MilliQuantityField(props: ScaledFieldProps) {
  return <ScaledNumericField {...props} scale={MILLI_QUANTITY_SCALE} />;
}

/** Ακέραιο πλήθος (π.χ. ημέρες) — όπου χρειάζεται το `nullable` («χωρίς όριο»), που το γυμνό `NumericField` δεν έχει. */
export function CountField(props: ScaledFieldProps) {
  return <ScaledNumericField {...props} scale={COUNT_SCALE} />;
}
