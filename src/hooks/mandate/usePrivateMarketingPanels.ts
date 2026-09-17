'use client';

/**
 * @fileoverview **Η ΚΑΤΑΣΤΑΣΗ ΚΛΕΙΣΤΗΣ ΔΙΑΘΕΣΗΣ ΜΙΑΣ ΚΑΤΑΧΩΡΗΣΗΣ** — για το γραφείο και για τον ιδιοκτήτη (ADR-864 §18.4 Δ2).
 * @related services/owner-property/private-marketing.client.ts · hooks/useIdentityGatedResource.ts
 * @module hooks/mandate/usePrivateMarketingPanels
 *
 * 🔑 **«Μην ρωτάς πριν ξέρεις ποιος ρωτά»** — ζητείται από το {@link useIdentityGatedResource}, δεν ξαναγράφεται.
 *
 * ⚠️ `revision`: η καταχώρηση του ιδιοκτήτη φτάνει **ζωντανά**· όταν αλλάξει (π.χ. `updatedAt` μετά από πράξη
 * ή από το γραφείο), το πάνελ ξαναδιαβάζεται — αλλιώς η οθόνη θα έδειχνε «εκκρεμεί αίτημα» για αίτημα που μόλις εκτελέστηκε.
 */

import { useCallback } from 'react';

import { useIdentityGatedResource } from '@/hooks/useIdentityGatedResource';
import {
  fetchPrivateMarketingPanels,
  type PrivateMarketingPanelsLoad,
} from '@/services/owner-property/private-marketing.client';

/** Σταθερά σε εμβέλεια module — ο hook τη κρατά, και νέο αντικείμενο ανά απόδοση θα άλλαζε αναφορά σιωπηλά. */
const UNAUTHENTICATED: PrivateMarketingPanelsLoad = { kind: 'failed' };

interface PrivateMarketingPanelsApi {
  /** `null` = φορτώνει. */
  readonly load: PrivateMarketingPanelsLoad | null;
  readonly reload: () => void;
}

export function usePrivateMarketingPanels(ownerPropertyId: string, revision: string | null = null): PrivateMarketingPanelsApi {
  const fetcher = useCallback(() => {
    // Η αναθεώρηση **δεν** μπαίνει στο αίτημα — είναι το έναυσμα της επανανάγνωσης.
    void revision;
    return fetchPrivateMarketingPanels(ownerPropertyId);
  }, [ownerPropertyId, revision]);

  const { value, reload } = useIdentityGatedResource<PrivateMarketingPanelsLoad>(fetcher, UNAUTHENTICATED);
  return { load: value, reload };
}
