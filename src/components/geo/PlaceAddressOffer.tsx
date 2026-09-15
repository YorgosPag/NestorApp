'use client';

/**
 * @fileoverview **«ΒΡΕΘΗΚΕ Η ΔΙΕΥΘΥΝΣΗ — ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΗΝ»** — το σκαλοπάτι 1 του §21.4 ως ρητό κλικ.
 * @related ADR-332 D28 Δ · lib/places/place-claim (`addressClaimAdmissible`) · components/geo/PlaceChooser
 * @module components/geo/PlaceAddressOffer
 *
 * 🔴 **Το περιστατικό (2026-09-15)**: ο «Εντοπισμός στον χάρτη» **κεντράριζε** τον χάρτη και η οθόνη δεν έλεγε το
 * επόμενο βήμα — ο άνθρωπος πατούσε «Αποθήκευση» χωρίς τόπο και έπαιρνε άρνηση. Airbnb / Google Business Profile: η
 * διεύθυνση που βρέθηκε είναι **πρόταση που ο άνθρωπος επιβεβαιώνει**, με διόρθωση πάνω στον χάρτη ως εναλλακτική.
 *
 * 🔑 **Ρητό κλικ, όχι σιωπηλή επιλογή — και η χειρονομία είναι `typed-address`**: ο **διακομιστής** ξαναγεωκωδικοποιεί
 * και η προέλευση λέγεται `geocoded`. Μια `dropped-pin` από το σημείο του χάρτη θα έγραφε `manual` για θέση που
 * **δεν έβαλε άνθρωπος**, και θα έστελνε συντεταγμένες από τον πελάτη (§14.4 κανόνας 2).
 *
 * ⚠️ **Αδρή ακρίβεια ⇒ κανένα κουμπί, αλλά πρόταση που λέει τι να κάνει** — όχι σιωπή: ο άνθρωπος πρέπει να μάθει
 * γιατί δεν του προσφέρεται η εύκολη διαδρομή.
 *
 * 🔒 **Namespace `property-market:offer.form`, όχι `search-results`** (CHECK 3.34): το `search-results` ανήκει στο
 * εγγυημένο κέλυφος και η προσθήκη το έβγαζε **15.916 > 15.200** bytes. Η προσφορά υπάρχει μόνο **μετά** τον
 * εντοπισμό, δίπλα στο `ResolvedPlaceConfirmation` — ίδια οικογένεια κειμένων, ίδιο namespace, ίδιο `next/dynamic`.
 */

import React from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { addressClaimAdmissible, type PlaceTarget } from '@/lib/places/place-claim';
import type { GeocodingAccuracy } from '@/lib/geocoding/geocoding-types';

const NS = 'property-market';
const K = `${NS}:offer.form.placeAddressOffer`;

interface PlaceAddressOfferProps {
  /** Η ακρίβεια της απάντησης που **είδε** ο άνθρωπος (το `focus`). Ο διακομιστής την ξανακρίνει. */
  readonly accuracy: GeocodingAccuracy;
  readonly target: PlaceTarget;
  /**
   * Ο **διακομιστής** αρνήθηκε (`address-too-coarse`) — η ακρίβεια που βρήκε ο ίδιος δεν αρκεί, όποια κι αν είδε η
   * οθόνη. Η άρνηση λέγεται **εδώ**, με την ίδια πρόταση, ώστε το κουμπί να μη ξαναπροσφέρει ό,τι μόλις απορρίφθηκε.
   */
  readonly refused?: boolean;
  readonly busy: boolean;
  readonly onUse: () => void;
}

export function PlaceAddressOffer({ accuracy, target, refused = false, busy, onUse }: PlaceAddressOfferProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const titleId = React.useId();
  const admissible = !refused && addressClaimAdmissible(accuracy, target);

  return (
    <aside aria-labelledby={titleId} className="space-y-2 rounded-lg border border-border bg-card p-3">
      <p id={titleId} className="text-sm font-medium text-foreground">
        {t(`${K}.title`)}
      </p>
      <p className="text-sm text-muted-foreground">
        {admissible ? t(`${K}.body`) : t(`${K}.coarse`)}
      </p>
      {admissible ? (
        <Button type="button" size="sm" onClick={onUse} disabled={busy}>
          {t(`${K}.use`)}
        </Button>
      ) : null}
    </aside>
  );
}
