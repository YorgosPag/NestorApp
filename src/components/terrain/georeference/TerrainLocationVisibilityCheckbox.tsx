'use client';

/**
 * @fileoverview 📍 **«Να φαίνεται το οικόπεδο στον χάρτη της αγγελίας»** — το ΕΝΑ κουτάκι της συγκατάθεσης θέσης (ADR-920 §14.12 φάση Α).
 * @related ../plot-outline/PlotOutlineVisibilityCheckbox (Π9 — ίδιο σχήμα, ΑΛΛΗ ερώτηση) · ./TerrainGeoreferenceCard
 * @module components/terrain/georeference/TerrainLocationVisibilityCheckbox
 *
 * ⚠️ **Δεν υπόσχεται ιδιωτικότητα**: μετρήθηκε (2026-11-24) ότι η δημόσια αγγελία δείχνει ήδη το σημείο που δήλωσε ο
 *    ιδιοκτήτης, αυτούσιο. Το κείμενο λέει μόνο **τι προσθέτει** το τσεκάρισμα — τη μετρημένη θέση του οικοπέδου.
 */

import React, { useId } from 'react';

import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from '@/i18n/hooks/useTranslation';

const NS = 'terrain-survey:georeference.showLocationInListing';

export interface TerrainLocationVisibilityCheckboxProps {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly onChange: (showInListing: boolean) => void;
}

export function TerrainLocationVisibilityCheckbox({ checked, disabled, onChange }: TerrainLocationVisibilityCheckboxProps) {
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
