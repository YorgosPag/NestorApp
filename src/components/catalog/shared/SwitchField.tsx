'use client';

/**
 * @fileoverview **Διακόπτης με ετικέτα και υπόδειξη** — το ένα πεδίο on/off των φορμών του καταλόγου (ADR-923 Φάση 1γ).
 * @module components/catalog/shared/SwitchField
 *
 * ⚠️ **Ουδέτερο αρχείο** (ADR-923 §5.5.2 Β5.2): ζούσε στο `CatalogFormFields`, που εισάγει το `useCatalogText` ⇒ όποιος ήθελε μόνο τον
 *    διακόπτη έσερνε όλο το namespace `catalog` στην κλειστότητά του (CHECK 3.34 · ADR-744 §27). Το `CatalogFormFields` το
 *    ξαναεξάγει, άρα οι υπάρχοντες καταναλωτές δεν αλλάζουν.
 */

import React, { useId } from 'react';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface SwitchFieldProps {
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly disabled?: boolean;
}

export function SwitchField({ label, hint, checked, onChange, disabled }: SwitchFieldProps) {
  const id = useId();
  return (
    <p className="m-0 flex items-start gap-2">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={hint ? `${id}-hint` : undefined} />
      <span className="flex flex-col">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </p>
  );
}
