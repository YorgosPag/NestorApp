/**
 * @fileoverview **ΠΟΣΟΙ ΘΑ ΜΕΙΝΟΥΝ ΑΝ ΠΑΤΗΣΩ ΑΥΤΟ ΤΟ ΤΣΙΠ;** — τα πλήθη των οικογενειών.
 * @related ADR-896 §8 · lib/criteria/criterion-option-counts.ts (το ίδιο ιδίωμα στο `/search/results`)
 * @module lib/agency/occupation-family-tallies
 *
 * 🔑 **ΜΕΤΡΑ ΜΕ ΤΟΥΣ ΑΛΛΟΥΣ ΑΞΟΝΕΣ ΕΝΕΡΓΟΥΣ, ΧΩΡΙΣ ΤΟΝ ΔΙΚΟ ΤΟΥ** — όπως το
 * `criterionOptionTallies`: με περιοχή «Θεσσαλονίκη» το τσιπ λέει πόσοι υδραυλικοί
 * **εκεί**, και το πλήθος δεν μηδενίζεται επειδή είναι ήδη επιλεγμένη άλλη ειδικότητα.
 *
 * ⚠️ **Μετρά ΓΡΑΦΕΙΑ, όχι πιστοποιήσεις** — όσα θα εμφανίσει ο κατάλογος. Ο κριτής είναι ο
 * **ίδιος** με το φίλτρο (`applyShowcaseFilters` + `showcaseOffersOccupation`): ένα τσιπ
 * που λέει «3» οδηγεί σε **3** κάρτες, ποτέ σε άλλο αριθμό.
 */

import { OCCUPATION_FAMILIES, type OccupationFamilyId } from '@/config/occupation-families';
import type { CoverageResolvers } from '@/lib/agency/coverage-match';
import { showcaseOffersOccupation } from '@/lib/agency/occupation-query';
import { applyShowcaseFilters, type ShowcaseFilters } from '@/lib/agency/showcase-filter';
import type { PublicShowcase } from '@/types/agency-profile';

export type OccupationFamilyTallies = ReadonlyMap<OccupationFamilyId, number>;

export function occupationFamilyTallies(
  ordered: readonly PublicShowcase[],
  filters: ShowcaseFilters,
  resolvers: CoverageResolvers,
): OccupationFamilyTallies {
  const others = applyShowcaseFilters(ordered, { ...filters, occupation: null }, resolvers);
  return new Map(
    OCCUPATION_FAMILIES.map((family) => [
      family.id,
      others.filter((showcase) => showcaseOffersOccupation(showcase, { kind: 'family', family }))
        .length,
    ]),
  );
}
