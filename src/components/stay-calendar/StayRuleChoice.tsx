'use client';

/**
 * **Μία επιλογή από κλειστό σύνολο αριθμών** — πάνω στο κανονικό `Select` (ADR-001).
 *
 * ⚠️ Το Radix Select **δεσμεύει** το `''` (CHECK 3.48): η τιμή «καμία» ταξιδεύει ως `none`.
 *
 * @related ADR-835 §21 · components/stay-calendar/StayRulesSettings.tsx
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NONE = 'none';

type ChoiceProps<T extends number> =
  | {
      readonly nullable?: false;
      readonly value: T;
      readonly labelOf: (value: T) => string;
      readonly onChange: (value: T) => void;
    }
  | {
      readonly nullable: true;
      readonly value: T | null;
      readonly labelOf: (value: T | null) => string;
      readonly onChange: (value: T | null) => void;
    };

type StayRuleChoiceProps<T extends number> = ChoiceProps<T> & {
  readonly label: string;
  readonly options: readonly T[];
  readonly hint?: string;
};

export function StayRuleChoice<T extends number>(props: StayRuleChoiceProps<T>): React.ReactElement {
  const id = React.useId();
  const { label, options, hint } = props;
  const select = (raw: string): void => {
    const option = options.find((candidate) => String(candidate) === raw);
    if (props.nullable === true) props.onChange(option ?? null);
    else if (option !== undefined) props.onChange(option);
  };
  const current = props.value === null ? NONE : String(props.value);

  return (
    <span className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Select value={current} onValueChange={select}>
        <SelectTrigger id={id} className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.nullable === true && <SelectItem value={NONE}>{props.labelOf(null)}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option} value={String(option)}>{props.labelOf(option)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hint !== undefined && <span className="text-xs text-muted-foreground">{hint}</span>}
    </span>
  );
}
