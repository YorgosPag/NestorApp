'use client';

/**
 * **Μία επιλογή από κλειστό σύνολο, με «καμία»** — το κοινό σώμα των επιλογών του ενεργειακού μπλοκ: κλάση και
 * εμβέλεια του ΠΕΑ (ADR-777 §8.94 · §8.96), αναμενόμενη κλάση · εμβέλεια · αρχείο της ΜΕΑ (§8.102).
 *
 * @related `./EnergyCertificateFields.tsx` · `./EnergyProjectionFields.tsx`
 *
 * 🔑 Ζούσε μέσα στο `EnergyCertificateFields`· βγήκε όταν απέκτησε δεύτερο καταναλωτή, ώστε να μην αντιγραφεί.
 */

import React from 'react';

import { ClearableSelect } from '@/components/ui/clearable-select';
import { Label } from '@/components/ui/label';
import { SelectItem } from '@/components/ui/select';

export interface BlockSelectProps<T extends string> {
  readonly selectId: string;
  readonly label: string;
  readonly placeholder: string;
  readonly hint?: string;
  readonly value: T | null;
  readonly options: readonly T[];
  readonly optionLabel: (option: T) => string;
  readonly onPick: (next: string) => void;
  readonly disabled: boolean;
}

export function BlockSelect<T extends string>(props: BlockSelectProps<T>) {
  const { selectId, label, placeholder, hint, value, options, optionLabel, onPick, disabled } = props;
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={selectId} className="text-xs text-muted-foreground">{label}</Label>
      <ClearableSelect id={selectId} value={value ?? ''} disabled={disabled} onValueChange={onPick} placeholder={placeholder} clearLabel={placeholder}>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="text-xs">{optionLabel(option)}</SelectItem>
        ))}
      </ClearableSelect>
      {hint !== undefined && <p className="m-0 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
