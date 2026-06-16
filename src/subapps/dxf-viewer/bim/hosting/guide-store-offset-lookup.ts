/**
 * Guide-store → axis offset lookup — SSoT bridge (ADR-441 / ADR-467).
 *
 * Γεφυρώνει τον global guide store (impure, runtime) με το pure `GuideOffsetLookup`
 * contract των hosting helpers (`derive-slots`). Ένας X/Y άξονας επιστρέφει το
 * `offset` του· διαγώνιος (XZ) ή διαγραμμένος → `undefined` (το slot αγνοείται).
 *
 * Πριν ζούσε private μέσα στον `useHostingReconciler` (`makeOffsetLookup`)· εξήχθη εδώ
 * ώστε να το μοιράζονται ΚΑΙ ο reconciler ΚΑΙ το load-path takedown (grid-anchored
 * tributary, ADR-467) — μηδέν διπλότυπο (N.0.2).
 *
 * @see ./derive-slots.ts — GuideOffsetLookup + derivePointSlots
 * @see ../../systems/guides/guide-store.ts — getGuideById
 */

import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import type { GuideOffsetLookup } from './derive-slots';

/** Τρέχον offset ενός X/Y άξονα από τον global guide store (XZ/διαγραμμένος → undefined). */
export function makeGuideOffsetLookup(): GuideOffsetLookup {
  const store = getGlobalGuideStore();
  return (id) => {
    const g = store.getGuideById(id);
    return g && g.axis !== 'XZ' ? g.offset : undefined;
  };
}
