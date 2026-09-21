'use client';

/**
 * @fileoverview **ΟΙ ΠΡΟΕΠΙΛΟΓΕΣ ΚΛΙΜΑΚΑΣ ΠΡΟΒΟΛΗΣ ΩΣ ΕΠΙΛΟΓΗ ΜΙΑΣ ΑΠΟ ΣΥΝΟΛΟ** — μία φορά,
 * για κάθε μενού ζουμ.
 * @related ADR-418 (view scale SSoT) · ADR-598 G11 · WAI-ARIA APG Menu (`menuitemradio`)
 *
 * 🔴 **Γιατί υπάρχει**: τα δύο μενού ζουμ (`RulerCornerBox`, `ZoomControls`) έδειχναν την
 * ενεργή κλίμακα **μόνο οπτικά**: το ένα με `aria-pressed` σε κουμπιά μέσα σε `nav`, το
 * άλλο με ένα ✓ σε `menuitem`. Ο αναγνώστης οθόνης δεν μάθαινε **ποια** κλίμακα ισχύει.
 * Η ενεργή κλίμακα είναι **μία** τιμή από κλειστό σύνολο, δηλαδή ακριβώς `menuitemradio` +
 * `aria-checked` (APG). Το ✓ το αποδίδει πλέον το `DropdownMenuRadioItem` του SSoT.
 *
 * ⚠️ **Καθαρό component, χωρίς συνδρομή**: η τρέχουσα κλίμακα έρχεται ως prop. Ο καλών
 * αποφασίζει **πού** ζει η συνδρομή (ADR-040: μόνο σε leaf), και το ίδιο component
 * δουλεύει και όταν ο γονέας έχει ήδη την τιμή (`ZoomControls`).
 */

import React from 'react';
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { VIEW_SCALE_MENU_PRESETS, isViewRatioActive } from '../../utils/view-scale';

interface ViewScalePresetRadioItemsProps {
  /** Ο τρέχων παρονομαστής `N` της κλίμακας `1:N` (μη πεπερασμένος ⇒ καμία επιλεγμένη). */
  readonly currentRatioN: number;
  /** Επιλογή προεπιλογής — το μενού κλείνει μόνο του (Radix `onSelect`). */
  readonly onSelectPreset: (ratioN: number) => void;
  readonly itemClassName?: string;
  /** Ορατή λεζάντα της ομάδας (`DropdownMenuLabel`), όταν το μενού έχει. */
  readonly 'aria-labelledby'?: string;
}

/** `'1:N'` ⇒ τιμή της ομάδας· `''` όταν η τρέχουσα κλίμακα δεν είναι προεπιλογή. */
function activePresetValue(currentRatioN: number): string {
  const active = VIEW_SCALE_MENU_PRESETS.find((presetN) => isViewRatioActive(currentRatioN, presetN));
  return active === undefined ? '' : String(active);
}

export function ViewScalePresetRadioItems({
  currentRatioN,
  onSelectPreset,
  itemClassName,
  'aria-labelledby': ariaLabelledBy,
}: ViewScalePresetRadioItemsProps): React.ReactElement {
  return (
    <DropdownMenuRadioGroup
      aria-labelledby={ariaLabelledBy}
      value={activePresetValue(currentRatioN)}
      onValueChange={(value) => onSelectPreset(Number(value))}
    >
      {VIEW_SCALE_MENU_PRESETS.map((presetN) => (
        <DropdownMenuRadioItem key={presetN} value={String(presetN)} className={itemClassName}>
          {`1:${presetN}`}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}
