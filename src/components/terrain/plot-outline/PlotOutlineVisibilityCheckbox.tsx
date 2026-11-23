'use client';

/**
 * @fileoverview **Π9 — «να φαίνεται το περίγραμμα στη δημόσια αγγελία»**: το ΕΝΑ κουτάκι, με την εξήγησή του (ADR-920 §14.11 Π9 · Ζ4).
 * @related ./PlotDrawingImport (πριν την επιβεβαίωση) · ./PlotOutlineStatusCard (αλλαγή χωρίς νέο σχέδιο, `PATCH`)
 * @module components/terrain/plot-outline/PlotOutlineVisibilityCheckbox
 *
 * 🔑 Ίδια ερώτηση σε δύο στιγμές ⇒ ίδια διατύπωση και ίδια προειδοποίηση (το σχήμα εντοπίζει το οικόπεδο στο Κτηματολόγιο).
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const NS = 'terrain-survey:plotOutline.showInListing';

export interface PlotOutlineVisibilityCheckboxProps {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (showInListing: boolean) => void;
}

export function PlotOutlineVisibilityCheckbox({ checked, disabled, onChange }: PlotOutlineVisibilityCheckboxProps) {
  const { t } = useTranslation(['terrain-survey']);
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-foreground">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)} />
      <span className="flex flex-col gap-0.5">
        <span>{t(`${NS}.label`)}</span>
        <span className="text-xs text-muted-foreground">{t(`${NS}.hint`)}</span>
      </span>
    </label>
  );
}
