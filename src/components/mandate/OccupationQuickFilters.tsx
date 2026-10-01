'use client';

/**
 * @fileoverview **ΓΡΗΓΟΡΕΣ ΕΙΔΙΚΟΤΗΤΕΣ** — τσιπ εικονίδιο + λέξη + πλήθος, πάνω από το dropdown.
 * @related ADR-896 §8 · useOccupationFamilyChoices · OccupationSelect · ui/toggle-button
 * @module components/mandate/OccupationQuickFilters
 *
 * 🔑 **ΜΙΑ ΑΛΗΘΕΙΑ, ΔΥΟ ΕΙΣΟΔΟΙ.** Το τσιπ γράφει στο **ίδιο** `ShowcaseFilters.occupation`
 * με το dropdown (`family:<id>`). Δεν κρατά δική του κατάσταση: «πατημένο» = «η τιμή του
 * φίλτρου είναι αυτή». Ξαναπάτημα = καθαρισμός.
 *
 * 📚 Airbnb (μπάρα κατηγοριών) · Houzz «Find a Pro» · NN/g: **η λέξη πάντα ορατή**, το
 * εικονίδιο βοηθά. «Ηλεκτρολόγος Μηχανικός» ≠ «Ηλεκτρολόγος» — χωρίς λέξη θα ήταν αινίγματα.
 *
 * ♿ **`aria-pressed`, όχι `role="radio"`**: ο radio δεν αποεπιλέγεται, ενώ εδώ το ξαναπάτημα
 * καθαρίζει (WAI-ARIA APG, toggle button). Η μονή επιλογή προκύπτει από τη **μία** τιμή.
 * Το ενεργό τσιπ φέρει και `×` — η κατάσταση λέγεται με **σχήμα**, όχι μόνο με χρώμα (CHECK 3.41).
 *
 * ⚠️ **ΜΗΔΕΝ = ΑΧΝΟ, ΟΧΙ ΚΡΥΦΟ.** `aria-disabled` (μένει εστιάσιμο) + `aria-describedby` προς
 * το υπάρχον «…δεν έχει γραφτεί ακόμη κανείς». Ποτέ τσιπ που οδηγεί σιωπηλά σε κενή λίστα.
 * Εξαίρεση: το **πατημένο** μένει ενεργό, για να μπορεί να καθαριστεί.
 *
 * 📐 **ΜΙΑ ΓΡΑΜΜΗ ΑΝΑ ΟΜΑΔΑ, ΣΕ ΚΑΘΕ ΠΛΑΤΟΣ** (ADR-896 §7Α.5): υπότιτλος πάνω, τσιπ σε `ScrollRail`
 * (κύλιση, σβήσιμο άκρης, ◀ ▶ μόνο με ποντίκι). Καμία αναδίπλωση ⇒ το ύψος δεν αλλάζει όσες
 * ειδικότητες κι αν προστεθούν. Γεωμετρία μόνο σε CSS (ADR-777 §8.84).
 */

import React from 'react';
import { X } from 'lucide-react';

import { ScrollRail } from '@/components/ui/scroll-rail';
import { ToggleButton } from '@/components/ui/toggle-button';
import { OCCUPATION_FAMILY_GROUPS, type OccupationFamilyGroup } from '@/config/occupation-families';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS } from './agency-directory-labels';
import type { OccupationFamilyChoice } from './useOccupationFamilyChoices';

const GROUP_KEYS: Record<OccupationFamilyGroup, string> = {
  engineering: DIRECTORY_KEYS.occupationGroupEngineering,
  trades: DIRECTORY_KEYS.occupationGroupTrades,
};

export interface OccupationQuickFiltersProps {
  /** Η **τρέχουσα** τιμή του `ShowcaseFilters.occupation` — η μόνη κατάσταση. */
  readonly value: string | null;
  readonly choices: readonly OccupationFamilyChoice[];
  /** Το id του κειμένου που εξηγεί το μηδέν («…δεν έχει γραφτεί ακόμη κανείς»). */
  readonly emptyHintId: string;
  readonly onChange: (occupation: string | null) => void;
}

export function OccupationQuickFilters({
  value,
  choices,
  emptyHintId,
  onChange,
}: OccupationQuickFiltersProps): React.ReactElement {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  const groupIdBase = React.useId();

  return (
    <div
      role="group"
      aria-label={t(DIRECTORY_KEYS.occupationQuickLabel)}
      className="flex min-w-0 basis-full flex-col gap-3"
    >
      {OCCUPATION_FAMILY_GROUPS.map((group) => {
        const captionId = `${groupIdBase}-${group}`;
        return (
          <div key={group} role="group" aria-labelledby={captionId} className="flex min-w-0 flex-col gap-1.5">
            <span id={captionId} className="text-xs font-medium text-muted-foreground">
              {t(GROUP_KEYS[group])}
            </span>
            <ScrollRail
              as="ul"
              prevLabel={t(DIRECTORY_KEYS.occupationRailPrev)}
              nextLabel={t(DIRECTORY_KEYS.occupationRailNext)}
              revealSelector='[aria-pressed="true"]'
              revealKey={value}
              className="items-center gap-2"
            >
              {choices
                .filter((choice) => choice.group === group)
                .map((choice) => (
                  <li key={choice.id}>
                    <QuickChip
                      choice={choice}
                      pressed={value === choice.value}
                      emptyHintId={emptyHintId}
                      onChange={onChange}
                    />
                  </li>
                ))}
            </ScrollRail>
          </div>
        );
      })}
    </div>
  );
}

function QuickChip({
  choice,
  pressed,
  emptyHintId,
  onChange,
}: {
  readonly choice: OccupationFamilyChoice;
  readonly pressed: boolean;
  readonly emptyHintId: string;
  readonly onChange: (occupation: string | null) => void;
}): React.ReactElement {
  const { Icon } = choice;
  const unavailable = choice.count === 0 && !pressed;

  return (
    <ToggleButton
      type="button"
      size="sm"
      pressed={pressed}
      aria-disabled={unavailable || undefined}
      aria-describedby={unavailable ? emptyHintId : undefined}
      onClick={() => {
        if (!unavailable) onChange(pressed ? null : choice.value);
      }}
      // Το ανεπίλεκτο περίγραμμα από τον ΡΟΛΟ (WCAG 1.4.11 ≥3:1) — μετρημένο ζωντανά: το προεπιλεγμένο
      // `outline` έδινε 1,41:1 (φωτεινό) / 2,31:1 (σκοτεινό) πάνω στον πίνακα του ήρωα.
      className={cn(
        'gap-1.5 rounded-full',
        !pressed && COLOR_BRIDGE.selectionControl.outline,
        unavailable && 'cursor-not-allowed opacity-50',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{choice.label}</span>
      {choice.count !== null && (
        <>
          <span className="text-xs tabular-nums" aria-hidden="true">
            {choice.count}
          </span>
          {/* Ο ορατός αριθμός σιωπά· το όνομα παίρνει τη φράση: «Υδραυλικός 3 επαγγελματίες». */}
          <span className="sr-only"> {choice.countText}</span>
        </>
      )}
      {pressed && <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
    </ToggleButton>
  );
}
