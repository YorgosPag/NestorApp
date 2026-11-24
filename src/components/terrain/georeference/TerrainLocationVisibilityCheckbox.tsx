'use client';

/**
 * @fileoverview 📍 **«Να φαίνεται το οικόπεδο στον χάρτη της αγγελίας»** — το ΕΝΑ κουτάκι της συγκατάθεσης θέσης (ADR-920 §14.12 φάση Α).
 * @related ../ListingVisibilityConsent (το κοινό σχήμα) · ../plot-outline/PlotOutlineVisibilityCheckbox (Π9 — ΑΛΛΗ ερώτηση) ·
 *   ./TerrainGeoreferenceCard
 * @module components/terrain/georeference/TerrainLocationVisibilityCheckbox
 *
 * ⚠️ **Δεν υπόσχεται ιδιωτικότητα**: μετρήθηκε (2026-11-24) ότι η δημόσια αγγελία δείχνει ήδη το σημείο που δήλωσε ο
 *    ιδιοκτήτης, αυτούσιο. Το κείμενο λέει μόνο **τι προσθέτει** το τσεκάρισμα — τη μετρημένη θέση του οικοπέδου.
 * 🔑 **Χωρίς δηλωμένο ΕΓΣΑ '87 δεν υπάρχει θέση να φανεί** — και το κουτάκι το **λέει** (`systemDeclared === false`), δεν
 *    μένει απλώς γκρι. Όσο τρέχει μια πράξη είναι ανενεργό **χωρίς** αυτόν τον λόγο: τότε ο λόγος θα ήταν ψέμα.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';

import { ListingVisibilityConsent } from '../ListingVisibilityConsent';

const NS = 'terrain-survey:georeference.showLocationInListing';

export interface TerrainLocationVisibilityCheckboxProps {
  readonly checked: boolean;
  /** Έχει δηλωθεί ΕΓΣΑ '87; Αλλιώς η συγκατάθεση δεν δίνεται, και εξηγείται γιατί. */
  readonly systemDeclared: boolean;
  /** Τρέχει άλλη πράξη της κάρτας. */
  readonly busy: boolean;
  readonly onChange: (showInListing: boolean) => void;
}

export function TerrainLocationVisibilityCheckbox({ checked, systemDeclared, busy, onChange }: TerrainLocationVisibilityCheckboxProps) {
  const { t } = useTranslation(['terrain-survey']);
  return (
    <ListingVisibilityConsent label={t(`${NS}.label`)} hint={t(`${NS}.hint`)} checked={checked}
      disabled={busy || !systemDeclared} disabledReason={systemDeclared ? undefined : t(`${NS}.needsGreekGrid`)}
      onChange={onChange} />
  );
}
