'use client';

/**
 * @fileoverview **ΔΕΙΞΕ ΤΟΝ ΤΟΠΟ, ΚΡΑΤΑ ΤΗΝ ΤΑΥΤΟΤΗΤΑ** — ένα χειριστήριο, δύο τομείς.
 * @related ADR-777 · SPEC-777A §14.5 · components/geo/PlaceChooser.tsx
 * @module components/geo/PlaceIdentityField
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΖΕΙ ΣΤΟ `geo/` ΚΑΙ ΟΧΙ ΣΕ ΕΝΑΝ ΑΠΟ ΤΟΥΣ ΔΥΟ ΤΟΜΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το χρησιμοποιούν **δύο** ερωτήσεις που δεν έχουν καμία άλλη σχέση:
 *
 * - **Ζ3/Ζ5** (ζήτηση): *«ψάχνω **αυτό** το κτίριο»*
 * - **Α14** (προσφορά): *«το ακίνητό μου είναι σε **αυτό** το κτίριο»*
 *
 * 🔑 **Και είναι ακριβώς αυτό που κάνει το §14.5 να δουλεύει**: δύο διαφορετικοί
 * άνθρωποι, δύο διαφορετικές φόρμες, **η ίδια** ταυτότητα στο τέλος. Ένα αντίγραφο
 * ανά τομέα θα ήταν το σχήμα του ADR-749 στην πιο επικίνδυνη θέση του — γιατί η
 * **σύγκριση** αυτών των δύο τιμών **είναι** η μηχανή ταιριάσματος.
 *
 * *(Γεννήθηκε ως `DemandPlaceIdentity` και μετακόμισε μόλις ο δεύτερος καταναλωτής
 * εμφανίστηκε — μέσα στο ίδιο commit, πριν προλάβει να γίνει κλώνος.)*
 *
 * ⚠️ **Ο επιλογέας κλείνει μόλις υπάρχει ταυτότητα.** Δεν μένει ανοιχτός «για
 * σιγουριά»: ένας χάρτης που ζητά κλικ ενώ η επιλογή έχει γίνει προσκαλεί τον άνθρωπο
 * να την αλλάξει κατά λάθος. Η αλλαγή είναι **ρητή πράξη**.
 */

import React, { useState } from 'react';

import { PlaceChooser } from '@/components/geo/PlaceChooser';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PlaceTarget } from '@/lib/places/place-claim';
import type { PlaceRef } from '@/types/geo/public-place';

const NS = 'search-results';

export interface PlaceIdentityFieldProps {
  readonly chosen: PlaceRef | null;
  readonly onChosen: (ref: PlaceRef) => void;
  /**
   * Τι δείχνει ο άνθρωπος. Προεπιλογή `building`, γιατί και οι δύο σημερινοί
   * καταναλωτές ρωτούν για **κτίριο** — η γη έρχεται μαζί, γιατί **αυτή** κρατά τη
   * θέση (Α1).
   */
  readonly target?: PlaceTarget;
}

export function PlaceIdentityField({
  chosen,
  onChosen,
  target = 'building',
}: PlaceIdentityFieldProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [editing, setEditing] = useState(chosen === null);

  if (chosen !== null && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-foreground">
          {t(`${NS}:demand.form.place.identityChosen`, {
            // Η ταυτότητα **είναι** η ετικέτα μέχρι να διαβαστεί η καρτέλα του τόπου:
            // ένα `pbld_*` δεν είναι φιλικό, αλλά είναι **αληθές** — και δεν
            // επινοείται όνομα που κανείς δεν έδωσε.
            label: chosen.buildingId ?? chosen.landId,
          })}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          {t(`${NS}:demand.form.place.identityChange`)}
        </Button>
      </div>
    );
  }

  return (
    <PlaceChooser
      target={target}
      onChosen={(ref) => {
        onChosen(ref);
        setEditing(false);
      }}
    />
  );
}
