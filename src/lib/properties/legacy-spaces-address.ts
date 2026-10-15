/**
 * @fileoverview **Η παλιά διεύθυνση `/spaces/properties` → η ενιαία οθόνη** — τι σήμαινε κάθε κλειδί, στη νέα γλώσσα.
 * @module lib/properties/legacy-spaces-address
 * @see ADR-840 Σ3 (§7.8) · `app/(app)/o/[workspace]/spaces/properties/page.tsx` · lib/workspace/arrival-address
 *
 * Οι διευθύνσεις που έχουν ήδη φύγει (σελιδοδείκτες, email, ιστορικό, ειδοποιήσεις) **δεν διορθώνονται αναδρομικά**
 * (ADR-840 Α1, ίδιο σκεπτικό με ADR-777 §8.30) — άρα η ανακατεύθυνση πρέπει να **μεταφράζει**, όχι απλώς να αλλάζει
 * διαδρομή:
 *
 * | Παλιό | Νέο | Γιατί |
 * |---|---|---|
 * | (καμία όψη) | `view=list` | η παλιά σελίδα **ήταν** η λίστα με τον επιθεωρητή |
 * | `propertyId` / `unitId` | `selected` | εκεί σήμαιναν «επιλεγμένη γραμμή»· στο `/properties` το `propertyId` σημαίνει «καρτέλα» |
 * | κάθε άλλο (`tab`, `new`, …) | αυτούσιο | η ενιαία οθόνη τα διαβάζει με το ίδιο όνομα |
 *
 * ⚠️ Το `#…` δεν φτάνει ποτέ στον server — το προσθέτει ο πελάτης (`ArrivalRedirect`).
 *
 * **Layering**: leaf — καθαρή συνάρτηση.
 */

import {
  LEGACY_SPACES_SELECTED_PARAMS,
  PROPERTIES_SELECTED_PARAM,
  PROPERTIES_VIEW,
} from '@/lib/properties/property-filters-url';
import { arrivalQuery, type ArrivalSearchParams } from '@/lib/workspace/arrival-address';

/** Η διαδρομή της ενιαίας οθόνης, **χωρίς** πρόθεμα χώρου (το βάζει ο καλών). */
export const PROPERTIES_SCREEN_PATH = '/properties';

/** Το ερώτημα της ενιαίας οθόνης για ένα αίτημα στο παλιό `/spaces/properties` (με `?` ή κενό). */
export function legacySpacesPropertiesQuery(searchParams: ArrivalSearchParams): string {
  const params = new URLSearchParams(arrivalQuery(searchParams));

  for (const legacy of LEGACY_SPACES_SELECTED_PARAMS) {
    const id = params.get(legacy);
    params.delete(legacy);
    if (id && !params.has(PROPERTIES_SELECTED_PARAM)) params.set(PROPERTIES_SELECTED_PARAM, id);
  }
  if (!params.has(PROPERTIES_VIEW.param)) PROPERTIES_VIEW.write('list', params);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}
