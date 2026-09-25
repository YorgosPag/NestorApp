/**
 * **Οι υποσυλλογές της χωρικής περιήγησης** — κοινές άγκυρες για τα δύο διαμερίσματα (ADR-884 Φ0.9).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ**: ο parser του CHECK 3.16 κρατά μόνο το **πρώτο** τμήμα διαδρομής, άρα τα μπλοκ
 * `spatial_tours/{id}/tour_captures/{c}` κ.λπ. μετρούν ως ο **γονέας** — καμία μήτρα δεν τα εκτελεί. Χωρίς
 * αυτές τις άγκυρες, ένα `allow read: if true` σε αιτήματα θέασης (ταυτότητες αιτούντων) θα περνούσε **πράσινο**.
 *
 * Κάθε διαμέρισμα δηλώνει **ποιος** είναι ο αναγνώστης της περιήγησης· οι άγκυρες ελέγχουν ότι:
 *  (α) οι λήψεις διαβάζονται από **τον ίδιο** αναγνώστη με τον γονέα, και από κανέναν άλλον·
 *  (β) αιτήματα θέασης, άδειες λήψης και προσκλήσεις φωτογράφου δεν διαβάζονται από **κανέναν** — ούτε από τον κάτοχο·
 *  (γ) καμία υποσυλλογή δεν γράφεται από τον πελάτη.
 */

import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';

import type { Persona } from '../_registry/personas';
import { getContext, withSeedContext } from './auth-contexts';
import type { EnvAccessor } from './deny-all-suite';

export interface SpatialTourPartitionSpec {
  readonly collection: 'spatial_tours' | 'spatial_tours_personal';
  /** Το έγγραφο της περιήγησης — κουβαλά το πεδίο κατόχου του διαμερίσματος. */
  readonly tourDoc: Record<string, unknown>;
  /** Ο αναγνώστης της περιήγησης — διαβάζει και τις λήψεις. */
  readonly reader: Persona;
  /** Όποιος **δεν** διαβάζει την περιήγηση — δεν διαβάζει ούτε τις λήψεις. */
  readonly outsiders: readonly Persona[];
}

const TOUR_ID = 'stour-seeded-1';
const SEALED = ['tour_access_requests', 'tour_capture_grants', 'tour_capture_invitations'] as const;
/** Το σπαρμένο έγγραφο ανά υποσυλλογή — η άδεια λήψης έχει id τον δικαιούχο (Φ0.5). */
const SEEDED_ID = {
  tour_captures: 'tcap-1',
  tour_access_requests: 'tacr-1',
  tour_capture_grants: 'photo',
  tour_capture_invitations: 'tcin-1',
} as const;

function seedTree(env: RulesTestEnvironment, spec: SpatialTourPartitionSpec): Promise<void> {
  return withSeedContext(env, async (ctx) => {
    const tour = ctx.firestore().collection(spec.collection).doc(TOUR_ID);
    await tour.set(spec.tourDoc);
    await tour.collection('tour_captures').doc(SEEDED_ID.tour_captures).set({ tourId: TOUR_ID, nodeId: 'tnod-1' });
    await tour.collection('tour_access_requests').doc(SEEDED_ID.tour_access_requests).set({ tourId: TOUR_ID, requesterUid: 'buyer' });
    await tour.collection('tour_capture_grants').doc(SEEDED_ID.tour_capture_grants).set({ tourId: TOUR_ID, scopes: ['tour:capture:upload'] });
    await tour.collection('tour_capture_invitations').doc(SEEDED_ID.tour_capture_invitations).set({ tourId: TOUR_ID, inviteeEmail: 'photo@example.com', state: 'pending' });
  });
}

const tourOf = (env: EnvAccessor, spec: SpatialTourPartitionSpec, persona: Persona) =>
  getContext(env(), persona).firestore().collection(spec.collection).doc(TOUR_ID);

/** Οι άγκυρες των υποσυλλογών ενός διαμερίσματος — καλείται **μέσα** στο `describe` της σουίτας. */
export function defineSpatialTourSubcollectionAnchors(env: EnvAccessor, spec: SpatialTourPartitionSpec): void {
  describe('🔴 υποσυλλογές — ο parser του 3.16 δεν τις βλέπει, άρα τις βλέπουμε εδώ', () => {
    it('(α) τις λήψεις τις διαβάζει ο αναγνώστης της περιήγησης', async () => {
      await seedTree(env(), spec);
      await assertSucceeds(tourOf(env, spec, spec.reader).collection('tour_captures').doc(SEEDED_ID.tour_captures).get());
    });

    it('(α) 🔴 όποιος δεν διαβάζει την περιήγηση δεν διαβάζει ούτε τις λήψεις', async () => {
      await seedTree(env(), spec);
      for (const persona of spec.outsiders) {
        await assertFails(tourOf(env, spec, persona).collection('tour_captures').doc(SEEDED_ID.tour_captures).get());
      }
    });

    it.each(SEALED)('(β) 🔴 %s — ούτε ο κάτοχος διαβάζει (ταυτότητες αιτούντων · άδειες τρίτων)', async (sub) => {
      await seedTree(env(), spec);
      for (const persona of [spec.reader, 'super_admin', 'same_tenant_admin'] as const) {
        const col = tourOf(env, spec, persona).collection(sub);
        await assertFails(col.doc(SEEDED_ID[sub]).get());
        await assertFails(col.get());
      }
    });

    it.each(['tour_captures', ...SEALED] as const)('(γ) 🔴 %s — καμία εγγραφή από τον πελάτη, ούτε από τον κάτοχο', async (sub) => {
      await seedTree(env(), spec);
      const col = tourOf(env, spec, spec.reader).collection(sub);
      await assertFails(col.doc('client-made').set({ tourId: TOUR_ID }));
      await assertFails(col.doc(SEEDED_ID[sub]).delete());
    });
  });
}
