'use client';

/**
 * **Ένα κουτάκι με την ετικέτα του** — μία γραμμή επιλογής σε φόρμα δήλωσης.
 *
 * @related `components/shared/common-charges/CommonChargesFields.tsx` ·
 *   `components/shared/energy-certificate/EnergyCertificateFields.tsx`
 *
 * 🔑 Το `label` τυλίγει το κουτάκι ⇒ το όνομα προσβασιμότητας **είναι** το κείμενο, χωρίς `id`/`htmlFor` που θα
 * έπρεπε να μείνουν μοναδικά ανά στιγμιότυπο. Εξήχθη στον δεύτερο καταναλωτή (ADR-777 §8.94).
 */

import React from 'react';

import { Checkbox } from '@/components/ui/checkbox';

export interface CheckLineProps {
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onToggle: (checked: boolean) => void;
}

export function CheckLine({ label, checked, disabled, onToggle }: CheckLineProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <Checkbox checked={checked} disabled={disabled} onCheckedChange={(state) => onToggle(state === true)} />
      {label}
    </label>
  );
}
