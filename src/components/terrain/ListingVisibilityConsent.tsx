'use client';

/**
 * @fileoverview **«Να φαίνεται στη δημόσια αγγελία;»** — το ΕΝΑ σχήμα κάθε συγκατάθεσης ορατότητας του εδάφους (ADR-920 §14.11 Π9 · §14.12 φάση Α).
 * @related ./plot-outline/PlotOutlineVisibilityCheckbox (το περίγραμμα) · ./georeference/TerrainLocationVisibilityCheckbox (η θέση)
 * @module components/terrain/ListingVisibilityConsent
 *
 * 🔑 **Γιατί κοινό**: ως τις 2026-11-24 τα δύο κουτάκια ήταν δίδυμα αρχεία που διέφεραν μόνο στη ρίζα των κλειδιών — κάθε
 *    διόρθωση του ενός (π.χ. ο λόγος της απενεργοποίησης) θα έπρεπε να θυμηθεί το άλλο.
 * 🔑 **Δέχεται κείμενο, όχι κλειδιά**: το `t('…')` μένει στους καταναλωτές με κυριολεκτική ρίζα, ώστε ο ταξινομητής κλειδιών
 *    (ADR-744) να τα διαβάζει στατικά — ένα `t(\`${root}.label\`)` πάνω σε prop θα ήταν ανεπίλυτο.
 * ♿ **Ανενεργό ⇒ λέει γιατί**: ένα γκρι κουτάκι χωρίς λόγο είναι αδιέξοδο. Ο λόγος γράφεται δίπλα του και δένεται με
 *    `aria-describedby`, ώστε να ακούγεται μαζί με την ετικέτα.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';

export interface ListingVisibilityConsentProps {
  /** Τι θα φαίνεται στο κοινό — ήδη μεταφρασμένο. */
  readonly label: string;
  /** Τι σημαίνει το τσεκάρισμα (και το μη τσεκάρισμα) — ήδη μεταφρασμένο. */
  readonly hint: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  /** Γιατί **δεν** μπορεί να δοθεί τώρα η συγκατάθεση — εμφανίζεται μόνο όσο το κουτάκι είναι ανενεργό. */
  readonly disabledReason?: string;
  readonly onChange: (showInListing: boolean) => void;
}

export function ListingVisibilityConsent({ label, hint, checked, disabled, disabledReason, onChange }: ListingVisibilityConsentProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const reasonId = `${id}-reason`;
  const reason = disabled && disabledReason ? disabledReason : null;
  return (
    <label htmlFor={id} className="flex items-start gap-2 text-sm text-foreground">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(value === true)}
        aria-describedby={reason === null ? hintId : `${hintId} ${reasonId}`} />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        <span id={hintId} className="text-xs text-muted-foreground">{hint}</span>
        {reason !== null && <span id={reasonId} className="text-xs text-foreground" data-consent-unavailable="">{reason}</span>}
      </span>
    </label>
  );
}
