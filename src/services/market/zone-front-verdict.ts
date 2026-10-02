/**
 * @fileoverview **Είναι ο δηλωμένος δρόμος υποψήφιο μέτωπο, εδώ και τώρα;** (ADR-898 Φ3β) — ο ΕΝΑΣ έλεγχος του server
 * για τη δήλωση «πρόσοψη σε μέτωπο», κοινός για ιδιώτη και εταιρεία.
 * @related `owner-property-declarations.service.ts` · `app/api/properties/[id]/property-objective-value-patch.ts`
 * @module services/market/zone-front-verdict
 *
 * 🔑 **Ποτέ εμπιστοσύνη στη φόρμα**: ο δρόμος πρέπει να είναι υποψήφιο μέτωπο στη θέση **που θα δημοσιευτεί**.
 * 🔑 **«Δεν μάθαμε» ≠ «άκυρο»**: ζώνες που δεν διαβάστηκαν ⇒ `zone-unverified` (503), **ποτέ** απόρριψη.
 * 🔑 **Η θέση ζητείται τεμπέλικα**: για την εταιρεία κοστίζει αναγνώσεις (κτίριο → έργο)· χωρίς δήλωση δρόμου δεν γίνεται.
 */

import 'server-only';

import type { ObjectiveValueDeclarationsPatch } from '@/lib/objective-value/objective-value-declarations';
import { streetFrontPrices } from '@/lib/objective-value/objective-value-zone';
import { readValueZoneAt } from '@/services/market/value-zones.reader';
import type { PlacePosition } from '@/types/geo/public-place';

export type ZoneFrontVerdict = 'accepted' | 'zone-unverified' | 'not-candidate';

export async function zoneFrontVerdict(
  patch: ObjectiveValueDeclarationsPatch,
  positionOf: () => PlacePosition | Promise<PlacePosition>,
): Promise<ZoneFrontVerdict> {
  const zoneFront = patch.zoneFront;
  if (zoneFront == null || zoneFront.kind !== 'street') return 'accepted';
  const verdict = await readValueZoneAt(await positionOf());
  if (verdict.kind === 'unavailable') return 'zone-unverified';
  return streetFrontPrices(verdict, zoneFront.street).length > 0 ? 'accepted' : 'not-candidate';
}
