/**
 * @fileoverview **Η τοποθεσία μιας συσκευής, στη γλώσσα του αναγνώστη** (ADR-894).
 * @related `lib/geo/ip-place.types.ts` (το σχήμα) · `lib/intl-formatting.ts` (`getDisplayNames`)
 * @module components/account/session-location-label
 *
 * 🔑 Αποθηκεύεται ο **κωδικός** χώρας· το όνομα βγαίνει εδώ με `Intl.DisplayNames` ⇒ «Ελλάδα» για τον
 * Έλληνα, «Greece» για τον Άγγλο, από την **ίδια** εγγραφή. Η πόλη μένει όπως τη δίνει η πηγή (η DB-IP Lite
 * δεν έχει ελληνικά ονόματα πόλεων — δηλωμένο όριο, ADR-894 §6).
 *
 * ⛔ Ό,τι δεν ξέρουμε **λέγεται** «Άγνωστη τοποθεσία» — ποτέ εφεδρική χώρα.
 */

import type { IpPlace } from '@/lib/geo/ip-place.types';

/** Ό,τι χρειάζεται από το `Intl.DisplayNames` — για να δοκιμάζεται χωρίς τοπικές ρυθμίσεις. */
export interface RegionNames {
  of(code: string): string | undefined;
}

function countryName(code: string, regionNames: RegionNames): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** «Thessaloniki, Ελλάδα» · «Κύπρος» · `unknownLabel`. */
export function sessionLocationLabel(place: IpPlace, regionNames: RegionNames, unknownLabel: string): string {
  if (place.precision === 'none' || !place.countryCode) return unknownLabel;
  const country = countryName(place.countryCode, regionNames);
  return place.precision === 'city' && place.city ? `${place.city}, ${country}` : country;
}
