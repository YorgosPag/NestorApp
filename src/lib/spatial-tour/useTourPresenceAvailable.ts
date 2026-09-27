'use client';

/**
 * @fileoverview **Έχει η αγγελία περιήγηση που φαίνεται;** — μόνο το boolean, για την καρτέλα μέσων (ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related `server/spatial-tour/tour-presence.ts` (`readTourPresence`, η αυθεντία) · `useTourAccessCard.ts` (πλήρης κύκλος πρόσβασης+αίτημα)
 * @module lib/spatial-tour/useTourPresenceAvailable
 *
 * 🔑 Οι σελίδες φωτογραφιών/κάτοψης χρειάζονται **μόνο** «δείξε την καρτέλα 3D ή όχι» — δεν ανοίγουν δικό τους
 * αίτημα πρόσβασης, άρα δεν χρειάζονται όλη τη μηχανή κατάστασης του `useTourAccessCard` (που ρωτά **και** το
 * δικό μου αίτημα, με λογαριασμό). `undefined` = ακόμη φορτώνει· `true`/`false` = απάντηση.
 */

import { useEffect, useState } from 'react';

import { readTourPresenceFromScreen } from '@/services/spatial-tour/spatial-tour-viewing.client';

export function useTourPresenceAvailable(listingId: string): boolean | undefined {
  const [available, setAvailable] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setAvailable(undefined);
    void readTourPresenceFromScreen(listingId).then((result) => {
      if (live) setAvailable(result.kind === 'ok' && result.value !== null);
    });
    return () => {
      live = false;
    };
  }, [listingId]);

  return available;
}
