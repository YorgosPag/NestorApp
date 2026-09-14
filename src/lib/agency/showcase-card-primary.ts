/**
 * @fileoverview **Ποιο κατάστημα απαντά «πώς τους μιλάω;»** — μία απάντηση για δύο σημεία της σελίδας (ADR-841 §7 Α21.17).
 * @related components/mandate/AgencyContactFacts.tsx (η σύνοψη ψηλά) · components/mandate/ShowcaseContactCard.tsx (οι κάρτες)
 * @module lib/agency/showcase-card-primary
 *
 * 🔴 **ΓΙΑΤΙ ΕΙΝΑΙ ΚΟΙΝΗ, ΜΕΤΡΗΜΕΝΟ**: η σύνοψη «Επικοινωνία» ανέβασε τα κουμπιά της έδρας στην κορυφή, ενώ η κάρτα
 * από κάτω τα έδειχνε **ξανά** — δύο «Εμφάνιση τηλεφώνου» για το ίδιο κατάστημα (η άγκυρα
 * `agency-showcase-listings` Ε2 το έπιασε: *«Found multiple elements»*), δηλαδή και δύο εισιτήρια ορίου. Η κάρτα
 * πρέπει να ξέρει **ποιο** ανέβηκε — και αν το υπολόγιζαν χωριστά, θα μπορούσαν να διαφωνήσουν.
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import type { ShowcaseLocation } from '@/types/showcase-card';

/** Η έδρα αν έχει κανάλι· αλλιώς το πρώτο κατάστημα που έχει· αλλιώς `null`. */
export function primaryChannelLocation(locations: readonly ShowcaseLocation[]): ShowcaseLocation | null {
  const withChannels = locations.filter(({ channelKinds }) => channelKinds.length > 0);
  return withChannels.find(({ role }) => role === 'headquarters') ?? withChannels[0] ?? null;
}
