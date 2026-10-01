'use client';

/**
 * @fileoverview **ΟΙ ΟΙΚΟΓΕΝΕΙΕΣ ΩΣ ΕΠΙΛΟΓΕΣ** — μία κατασκευή, δύο χειριστήρια (τσιπ + dropdown).
 * @related ADR-896 §8 · config/occupation-families.ts · OccupationQuickFilters · OccupationSelect
 * @module components/mandate/useOccupationFamilyChoices
 *
 * 🔑 Τα τσιπ και το dropdown δείχνουν την **ίδια** λέξη, την **ίδια** τιμή και το **ίδιο**
 * πλήθος για κάθε οικογένεια. Δύο κατασκευές θα ήταν δύο απαντήσεις στο «πόσοι υδραυλικοί;».
 *
 * ⚠️ **`count: null` = ΑΓΝΩΣΤΟ, όχι μηδέν** — όσο η περιοχή δεν μπορεί ακόμη να κριθεί
 * (`areaPending`). Τότε κανένας αριθμός και κανένα αχνό τσιπ: «άγνωστο ≠ κενό» (N.12).
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

import {
  OCCUPATION_FAMILIES,
  type OccupationFamilyGroup,
  type OccupationFamilyId,
} from '@/config/occupation-families';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { OccupationFamilyTallies } from '@/lib/agency/occupation-family-tallies';
import { familyToken } from '@/lib/agency/occupation-query';
import { AGENCY_PUBLIC_NS, DIRECTORY_KEYS, OCCUPATION_FAMILY_KEYS } from './agency-directory-labels';

export interface OccupationFamilyChoice {
  readonly id: OccupationFamilyId;
  readonly group: OccupationFamilyGroup;
  readonly Icon: LucideIcon;
  /** Η τιμή του φίλτρου (`family:<id>`) — η ίδια για τσιπ, dropdown και URL. */
  readonly value: string;
  readonly label: string;
  /** Πόσα γραφεία θα μείνουν· `null` = δεν ξέρουμε ακόμη. */
  readonly count: number | null;
  /** Το πλήθος με λέξεις («3 επαγγελματίες» / «κανείς ακόμη»)· `null` μαζί με το `count`. */
  readonly countText: string | null;
}

export function useOccupationFamilyChoices(
  tallies: OccupationFamilyTallies | null,
): readonly OccupationFamilyChoice[] {
  const { t } = useTranslation([AGENCY_PUBLIC_NS]);
  return React.useMemo(
    () =>
      OCCUPATION_FAMILIES.map((family) => {
        const count = tallies === null ? null : (tallies.get(family.id) ?? 0);
        return {
          id: family.id,
          group: family.group,
          Icon: family.Icon,
          value: familyToken(family.id),
          label: t(OCCUPATION_FAMILY_KEYS[family.id]),
          count,
          countText:
            count === null
              ? null
              : count === 0
                ? t(DIRECTORY_KEYS.occupationFamilyNone)
                : t(DIRECTORY_KEYS.occupationFamilyCount, { count }),
        };
      }),
    [tallies, t],
  );
}
