'use client';

/**
 * @fileoverview **Π9 — «να φαίνεται το περίγραμμα στη δημόσια αγγελία»**: το ΕΝΑ κουτάκι, με την εξήγησή του (ADR-920 §14.11 Π9 · Ζ4).
 * @related ./PlotDrawingImport (πριν την επιβεβαίωση) · ./PlotOutlineStatusCard (αλλαγή χωρίς νέο σχέδιο, `PATCH`) ·
 *   ../ListingVisibilityConsent (το κοινό σχήμα — εδώ μένει μόνο **ποια** ερώτηση είναι)
 * @module components/terrain/plot-outline/PlotOutlineVisibilityCheckbox
 *
 * 🔑 Ίδια ερώτηση σε δύο στιγμές ⇒ ίδια διατύπωση και ίδια προειδοποίηση (το σχήμα εντοπίζει το οικόπεδο στο Κτηματολόγιο).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

import { ListingVisibilityConsent } from '../ListingVisibilityConsent';

const NS = 'terrain-survey:plotOutline.showInListing';

export interface PlotOutlineVisibilityCheckboxProps {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (showInListing: boolean) => void;
}

export function PlotOutlineVisibilityCheckbox({ checked, disabled, onChange }: PlotOutlineVisibilityCheckboxProps) {
  const { t } = useTranslation(['terrain-survey']);
  return (
    <ListingVisibilityConsent label={t(`${NS}.label`)} hint={t(`${NS}.hint`)} checked={checked} disabled={disabled}
      onChange={onChange} />
  );
}
