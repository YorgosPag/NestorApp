'use client';

/**
 * @fileoverview **ΕΠΙΛΟΓΗ ΜΕ ΕΤΙΚΕΤΑ** — Radix Select (ADR-001) με `<Label>`, τυπωμένο στις δοσμένες τιμές.
 * @related `TourCaptureUploadForm.tsx` · `editor/TourPlacementForm.tsx` (ADR-884 Φ2δ — εξήχθη από τη φόρμα ανεβάσματος
 *   αντί για δεύτερο αντίγραφο, §4.10)
 * @module components/spatial-tour/LabeledSelect
 *
 * 🔑 **Γενικό στο `T`**: η τιμή που επιστρέφει είναι **μία από τις δοσμένες** — ποτέ ανεπαλήθευτο string (κανένα `as`).
 * ⚠️ Καμία επιλογή `value=""` (το Radix το δεσμεύει — CHECK 3.48).
 */

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface SelectOption<T extends string> { readonly value: T; readonly label: string }

export function LabeledSelect<T extends string>(props: {
  readonly id: string; readonly label: string; readonly value: T;
  readonly options: readonly SelectOption<T>[]; readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
}) {
  const choose = (raw: string) => {
    const option = props.options.find((candidate) => candidate.value === raw);
    if (option) props.onChange(option.value);
  };
  return (
    <section className="space-y-1">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Select value={props.value} onValueChange={choose} disabled={props.disabled}>
        <SelectTrigger id={props.id}><SelectValue /></SelectTrigger>
        <SelectContent>
          {props.options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </section>
  );
}
