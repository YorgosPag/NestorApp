'use client';

/**
 * @fileoverview **«Τι θα δει ο κόσμος»** — η προεπισκόπηση της νομικής ταυτότητας της βιτρίνας (ADR-841 §7 Α23.14).
 * @related app/api/agency-profile/legal-identity-preview/route.ts · lib/agency/showcase-legal-identity.ts
 * @module hooks/mandate/useShowcaseLegalPreview
 *
 * ⚠️ **Τέσσερις καταστάσεις, ποτέ `null`** (πρότυπο `useCompanyRegistryIdentity`): `forbidden` (δεν είσαι
 * διαχειριστής — η απάντηση περιέχει την πλήρη έδρα) ≠ `unavailable` (δεν απάντησε) ≠ `loading`. Σε `forbidden` /
 * `unavailable` η επιλογή **μένει δυνατή**· λείπει μόνο το ακριβές κείμενο — ο γραφέας κρίνει ούτως ή άλλως.
 */

import { useEffect, useState } from 'react';

import { ApiClientError, apiClient } from '@/lib/api/enterprise-api-client';
import { createModuleLogger } from '@/lib/telemetry';
import type { LegalIdentityPreview } from '@/lib/agency/showcase-legal-identity';

const logger = createModuleLogger('useShowcaseLegalPreview');

/**
 * 🔴 **Μέσω `apiClient`, ποτέ ωμό `fetch`** (ADR-787 §5.3 ζ): μόνο ο client δηλώνει **σε ποιον χώρο** ενεργείς.
 * Χωρίς τη δήλωση ο server κρίνει την εταιρεία **του λογαριασμού** — μετρημένο ζωντανά 2026-11-21: στον χώρο
 * `dokimastiko-mixaniko-pea` η προεπισκόπηση έδειξε άλλη εταιρεία.
 */
export const SHOWCASE_LEGAL_PREVIEW_ENDPOINT = '/api/agency-profile/legal-identity-preview' as const;

export type ShowcaseLegalPreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly preview: LegalIdentityPreview }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'unavailable' };

const FORBIDDEN: ShowcaseLegalPreviewState = { kind: 'forbidden' };
const UNAVAILABLE: ShowcaseLegalPreviewState = { kind: 'unavailable' };

/** Η άρνηση → κατάσταση. 401/403 = δεν είσαι διαχειριστής (ή δεν ανήκεις στον χώρο)· όλα τα άλλα = δεν απάντησε. */
function refusedStateOf(error: unknown): ShowcaseLegalPreviewState {
  if (ApiClientError.isApiClientError(error) && (error.statusCode === 401 || error.statusCode === 403)) return FORBIDDEN;
  logger.error('Η προεπισκόπηση της νομικής ταυτότητας δεν διαβάστηκε', {
    error: error instanceof Error ? error.message : String(error),
  });
  return UNAVAILABLE;
}

async function requestPreview(): Promise<ShowcaseLegalPreviewState> {
  try {
    // `retry: false`: το 503 `PREVIEW_UNAVAILABLE` είναι **απάντηση**, όχι σφάλμα δικτύου — δεν ξαναρωτάμε.
    // Ο client ξετυλίγει το `{ success, data }` ⇒ εδώ φτάνει κατευθείαν το ωφέλιμο.
    const preview = await apiClient.get<LegalIdentityPreview>(SHOWCASE_LEGAL_PREVIEW_ENDPOINT, { retry: false });
    return preview ? { kind: 'ready', preview } : UNAVAILABLE;
  } catch (error) {
    return refusedStateOf(error);
  }
}

/**
 * Μία ανάγνωση ανά άνοιγμα της οθόνης. 🔑 Η επιστροφή από «Κάρτα» / «Στοιχεία ΓΕΜΗ» **ξαναστήνει** τη σελίδα, άρα
 * η προεπισκόπηση βλέπει την έδρα ή τον τίτλο που μόλις συμπληρώθηκε — χωρίς δεύτερο μηχανισμό ανανέωσης.
 */
export function useShowcaseLegalPreview(): ShowcaseLegalPreviewState {
  const [state, setState] = useState<ShowcaseLegalPreviewState>({ kind: 'loading' });
  useEffect(() => {
    let active = true;
    void requestPreview().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}
