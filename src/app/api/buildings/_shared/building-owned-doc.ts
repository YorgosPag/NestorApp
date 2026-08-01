/**
 * «Το κτίριο — αν είναι δικό μου»: ο φορτωτής του πόρου `building`
 *
 * Λεπτό δέσιμο πάνω στη **γενική** αλυσίδα ({@link loadOwnedDoc}). Εδώ ζει
 * **μόνο** ό,τι κάνει τα κτίρια διαφορετικά: η συλλογή, το εργοστάσιο «δεν
 * βρέθηκε» και ο φύλακας.
 *
 * ⚠️ **Μην ξαναγράψεις εδώ τη σειρά φόρτωσε→υπάρχει;→δικό μου;** — ζει στο
 * `lib/auth/owned-doc-loader.ts` ώστε να μην έχει ο κάθε πόρος δικό του
 * αντίγραφο (N.18· μάθημα #7 των Ομάδων 1–3).
 *
 * 🔴 **Γιατί προστέθηκε τελευταίο** (N.18 · CHECK 3.28): το `DELETE` της
 * διαδρομής και το `PATCH` του χειριστή έγραφαν **αυτολεξεί** την ίδια τετράδα
 * («απαίτησε id → φόρτωσε → 404 αν λείπει → ρώτησε τον φύλακα»), και το `jscpd`
 * τη μετρούσε ως κλώνο 12 γραμμών **ανάμεσα σε δύο αρχεία**. Τα κτίρια είχαν
 * πάρει την **ερώτηση** (`building-ownership.ts`) αλλά όχι την **αλυσίδα** —
 * ακριβώς το μισό βήμα που ο N.18 προειδοποιεί ότι αφήνει δίδυμα πίσω του.
 *
 * @module app/api/buildings/_shared/building-owned-doc
 * @see @/lib/auth/owned-doc-loader — η αλυσίδα
 * @see ./building-ownership — η ερώτηση + το εργοστάσιο «δεν βρέθηκε»
 */

import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { loadOwnedDoc, type OwnedDoc } from '@/lib/auth/owned-doc-loader';
import {
  buildingNotFound,
  requireBuildingAccess,
  type BuildingAccessCaller,
} from './building-ownership';

export interface LoadOwnedBuildingSpec {
  readonly buildingId: string;
  readonly caller: BuildingAccessCaller;
  /** Ποιο μονοπάτι ρώτησε — μπαίνει στα logs ασφαλείας του φύλακα. */
  readonly action: string;
  readonly db?: Firestore;
}

/**
 * Διαβάζει το κτίριο και **αμέσως** το κρίνει.
 *
 * Και τα δύο «όχι» βγαίνουν από το **ίδιο** {@link buildingNotFound}: ο γνήσιος
 * κλάδος μέσω `notFound`, η άρνηση ιδιοκτησίας μέσω του
 * {@link requireBuildingAccess}. Δεν υπάρχει όρισμα που να τα διαφοροποιεί.
 */
export function loadOwnedBuilding(spec: LoadOwnedBuildingSpec): Promise<OwnedDoc> {
  const { buildingId, caller, action } = spec;

  return loadOwnedDoc({
    collection: COLLECTIONS.BUILDINGS,
    docId: buildingId,
    action,
    resourceLabel: 'Building',
    notFound: buildingNotFound,
    assertOwned: (buildingData) =>
      requireBuildingAccess({ buildingData, caller, buildingId, action }),
    ...(spec.db === undefined ? {} : { db: spec.db }),
  });
}
