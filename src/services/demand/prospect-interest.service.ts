import 'server-only';

/**
 * @fileoverview **Ο ΤΟΠΟΣ ΤΟΥ ΕΠΙΣΚΕΠΤΗ → ΤΑ ΓΕΓΟΝΟΤΑ ΠΟΥ ΚΡΙΝΕΙ Η ΜΗΧΑΝΗ** (ADR-900).
 * @related ADR-900 · lib/demand/prospect-interest.ts · services/demand/place-interest.service.ts
 * @module services/demand/prospect-interest.service
 *
 * 🔑 **Καμία νέα μετάφραση.** Ο τόπος ελέγχεται από τον **έναν** κριτή ({@link verifyPlaceRef}), η
 * θέση διαβάζεται από τον **έναν** αναγνώστη ({@link readLandPosition}), και τα γεγονότα βγαίνουν από
 * την **ίδια** συνάρτηση με το πάνελ του κατόχου ({@link factsOfProjection}). Αν το πάνελ και αυτή η
 * σελίδα κρίνονταν από δύο μεταφράσεις, θα μπορούσαν να δώσουν **διαφορετικό** αριθμό για το **ίδιο**
 * ακίνητο — και θα φαίνονταν και οι δύο σωστές.
 *
 * ⚠️ **Κανένα γράψιμο, καμία κατοχή.** Ο επισκέπτης δεν αποδεικνύει τίποτα — γι' αυτό το ακροατήριο
 * είναι `prospective-owner` (κατώφλι 5, βήμα 5), ποτέ `place-owner`.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { prospectProjectable, type ProspectQuery } from '@/lib/demand/prospect-interest';
import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import { readLandPosition } from '@/services/places/place-position.reader';
import { verifyPlaceRef } from '@/services/places/public-place-read.service';
import { addressToPositionCandidate } from '@/services/listings/public-listing-position';
import { factsOfProjection } from './place-interest.service';

/**
 * Τι βρέθηκε. **Τρεις** καταστάσεις γιατί υπάρχουν τρεις **διαφορετικές** θεραπείες:
 * `invalid` = ο αιτών έδειξε κάτι που δεν είναι τόπος (422) · `unavailable` = **εμείς** δεν μάθαμε (503).
 */
export type ProspectFactsLookup =
  | { readonly kind: 'found'; readonly facts: ListingMatchFacts }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'unavailable' };

/** **Ερώτημα → γεγονότα**, με **μία** στιγμή (`at`) για όλη την κρίση. */
export async function prospectFactsOf(
  db: AdminFirestore,
  query: ProspectQuery,
  at: string,
): Promise<ProspectFactsLookup> {
  const verdict = await verifyPlaceRef(db, query.ref);
  if (verdict === 'unavailable') return { kind: 'unavailable' };
  if (verdict !== 'exists') return { kind: 'invalid' };

  // `null` θέση = ρητή άγνοια του επιπέδου Α· η μηχανή τη λέει ονομαστικά, δεν μαντεύουμε σημείο.
  const point = await readLandPosition(db, query.ref.landId);
  const candidate = point === null ? null : addressToPositionCandidate({ coordinates: point }, at);

  return {
    kind: 'found',
    facts: factsOfProjection({
      property: prospectProjectable(query.description),
      place: { candidates: candidate === null ? [] : [candidate], ref: query.ref },
      at,
    }),
  };
}
