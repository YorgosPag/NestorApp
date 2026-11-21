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

import { createModuleLogger } from '@/lib/telemetry';
import type { LegalIdentityPreview } from '@/lib/agency/showcase-legal-identity';

const logger = createModuleLogger('useShowcaseLegalPreview');

export const SHOWCASE_LEGAL_PREVIEW_ENDPOINT = '/api/agency-profile/legal-identity-preview' as const;

export type ShowcaseLegalPreviewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly preview: LegalIdentityPreview }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'unavailable' };

const FORBIDDEN: ShowcaseLegalPreviewState = { kind: 'forbidden' };
const UNAVAILABLE: ShowcaseLegalPreviewState = { kind: 'unavailable' };

async function stateOf(response: Response): Promise<ShowcaseLegalPreviewState> {
  if (response.status === 401 || response.status === 403) return FORBIDDEN;
  if (!response.ok) return UNAVAILABLE;
  const body = (await response.json().catch(() => null)) as { data?: LegalIdentityPreview } | null;
  return body?.data ? { kind: 'ready', preview: body.data } : UNAVAILABLE;
}

async function requestPreview(): Promise<ShowcaseLegalPreviewState> {
  try {
    return await stateOf(await fetch(SHOWCASE_LEGAL_PREVIEW_ENDPOINT, { method: 'GET' }));
  } catch (error) {
    logger.error('Η προεπισκόπηση της νομικής ταυτότητας δεν διαβάστηκε', {
      error: error instanceof Error ? error.message : String(error),
    });
    return UNAVAILABLE;
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
