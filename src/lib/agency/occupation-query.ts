/**
 * @fileoverview **ΤΙ ΖΗΤΑ Η ΤΙΜΗ `?occupation=`** — ακριβής ειδικότητα ή οικογένεια.
 * @related ADR-896 §8 · config/occupation-families.ts · lib/agency/showcase-filter.ts
 * @module lib/agency/occupation-query
 *
 * 🔑 **ΕΝΑ ΦΙΛΤΡΟ, ΔΥΟ ΕΙΣΟΔΟΙ.** Τα τσιπ και το dropdown γράφουν στο **ίδιο**
 * `ShowcaseFilters.occupation` (και στο ίδιο `?occupation=`). Η τιμή είναι είτε URI ESCO
 * *(ακριβής ειδικότητα — όπως πάντα)* είτε `family:<id>` *(επιμελημένη οικογένεια)* —
 * το ίδιο ιδίωμα προθέματος με το `?area=municipality:4905`. Καμία δεύτερη κατάσταση.
 *
 * ⚠️ **Άγνωστη οικογένεια ⇒ `null`, όχι «κανείς δεν ταιριάζει».** Ένας παλιός σύνδεσμος
 * με οικογένεια που αποσύρθηκε θα έδειχνε αλλιώς κενό κατάλογο χωρίς λόγο.
 */

import {
  OCCUPATION_FAMILIES,
  type OccupationFamily,
  type OccupationFamilyId,
} from '@/config/occupation-families';
import type { PublicShowcase } from '@/types/agency-profile';

export const OCCUPATION_FAMILY_PREFIX = 'family:';

export type OccupationQuery =
  | { readonly kind: 'esco'; readonly uri: string }
  | { readonly kind: 'family'; readonly family: OccupationFamily };

const FAMILY_BY_ID: ReadonlyMap<string, OccupationFamily> = new Map(
  OCCUPATION_FAMILIES.map((family) => [family.id, family]),
);

/** Η τιμή URL/φίλτρου μιας οικογένειας — η **μία** γραφή του προθέματος. */
export function familyToken(id: OccupationFamilyId): string {
  return `${OCCUPATION_FAMILY_PREFIX}${id}`;
}

/** Η τιμή του φίλτρου ως ερώτημα· `null` για κενό ή για οικογένεια που δεν υπάρχει. */
export function readOccupationQuery(value: string): OccupationQuery | null {
  const raw = value.trim();
  if (raw === '') return null;
  if (!raw.startsWith(OCCUPATION_FAMILY_PREFIX)) return { kind: 'esco', uri: raw };

  const family = FAMILY_BY_ID.get(raw.slice(OCCUPATION_FAMILY_PREFIX.length));
  return family === undefined ? null : { kind: 'family', family };
}

/** Προσφέρει η βιτρίνα αυτό που ζητείται; — **μία** απάντηση για φίλτρο και πλήθη. */
export function showcaseOffersOccupation(
  showcase: PublicShowcase,
  query: OccupationQuery,
): boolean {
  return showcase.credentials.some(({ occupation }) =>
    query.kind === 'esco'
      ? occupation.escoUri === query.uri
      : query.family.escoUris.includes(occupation.escoUri),
  );
}
