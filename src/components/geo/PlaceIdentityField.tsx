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
import { PlaceSummary } from '@/components/geo/PlaceSummary';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PlaceFocus } from '@/lib/geo/geocoding-focus';
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
  /**
   * **Η ΔΙΕΥΘΥΝΣΗ ΠΟΥ ΗΔΗ ΕΝΤΟΠΙΣΤΗΚΕ**, όταν η φόρμα τη ρώτησε πιο πάνω.
   *
   * 🔑 **Ταξιδεύει, δεν ερμηνεύεται.** Αυτό το component αποφασίζει *«ανοιχτός ή
   * κλειστός επιλογέας;»* και τίποτε άλλο — η προβολή του χάρτη είναι δουλειά του
   * {@link PlaceMap} και ο κανόνας της, του `lib/geo/geocoding-focus`. Ένα ενδιάμεσο
   * που *«βελτιώνει»* την τιμή στο πέρασμα είναι δεύτερη αρχή για την ίδια ερώτηση.
   *
   * ⚠️ **Προαιρετικό**: από τους τρεις καταναλωτές, μόνο η φόρμα του κατόχου ρωτά
   * διεύθυνση πριν από το κτίριο. Ο `BuildingPlaceLinkCard` ξεκινά **από** το κτίριο
   * και ο `DemandAxisFields` ρωτά *«ποιο κτίριο ψάχνεις;»* — κανένας από τους δύο δεν
   * έχει απάντηση γεωκωδικοποιητή να δώσει, και δεν πρέπει να επινοήσει.
   */
  readonly focus?: PlaceFocus | null;
}

export function PlaceIdentityField({
  chosen,
  onChosen,
  target = 'building',
  focus = null,
}: PlaceIdentityFieldProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const [editing, setEditing] = useState(chosen === null);

  if (chosen !== null && !editing) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{t(`${NS}:place.chosen`)}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            {t(`${NS}:place.change`)}
          </Button>
        </div>
        {/*
          🔴 **ΕΔΩ ΕΠΑΨΕ ΝΑ ΦΑΙΝΕΤΑΙ ΩΜΟ `pbld_*`** (Β3, 2026-08-11). Η ταυτότητα
          **δεν κρύβεται** — μεταφέρεται σε δεύτερη γραμμή από το {@link PlaceSummary},
          γιατί είναι το **μόνο** πράγμα που ταιριάζει προσφορά με ζήτηση (§14.5).
          Αυτό που άλλαξε είναι ότι δεν είναι πια **το μόνο** που βλέπει ο άνθρωπος.

          ⚠️ Το περίγραμμα ζωγραφίζεται εδώ επίτηδες: ο επιλογέας του §13.6 μπορεί
          κάλλιστα να πιάσει το **διπλανό** κτίριο, και το σχήμα είναι η μόνη
          επαλήθευση που δεν απαιτεί από τον άνθρωπο να διαβάσει αναγνωριστικό.
        */}
        <PlaceSummary place={chosen} withOutline />
      </div>
    );
  }

  return (
    <PlaceChooser
      target={target}
      focus={focus}
      onChosen={(ref) => {
        onChosen(ref);
        setEditing(false);
      }}
    />
  );
}
