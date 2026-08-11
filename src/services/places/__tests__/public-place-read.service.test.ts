/**
 * @fileoverview **Η ΕΠΑΛΗΘΕΥΣΗ ΤΟΥ ΔΕΣΜΟΥ** — «δείχνει αυτό κάπου;», με πέντε ρητές απαντήσεις.
 * @related ADR-777 · SPEC-777A §13.7.3 (Β3) · §14.3 · services/places/public-place-read.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΠΑΛΗΘΕΥΕΤΑΙ ΚΑΘΟΛΟΥ — Η ΒΛΑΒΗ ΕΙΝΑΙ **ΑΟΡΑΤΗ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένας δεσμός προς ανύπαρκτη ταυτότητα **δεν σπάει τίποτα**: ταξιδεύει στη δημόσια
 * αγγελία, **φαίνεται** λυμένος, και απλώς δεν ταιριάζει ποτέ με καμία ζήτηση. Η μηχανή
 * θα έλεγε «καμία αντιστοιχία» και θα είχε δίκιο — **κανείς δεν θα ρωτούσε γιατί**.
 *
 * ⚠️ Και η επαλήθευση σταματά **ακριβώς εκεί**: το §14.3 λέει ότι ο χρήστης *«δεν
 * αλλάζει το κοινό — **προτείνει**»*. Το αν το κτίριό του **είναι** εκείνο το κτίριο
 * είναι ισχυρισμός, και κανένα ερώτημα βάσης δεν μπορεί να τον κρίνει.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { placeKindOf, verifyPlaceRef } from '../public-place-read.service';
import { FakeFirestore } from './fake-firestore';

const LAND_ID = 'land_0cb5cbb6-bb31-4954-a7f9-8e8f9ac00a00';
const BUILDING_ID = 'pbld_24b3a8d7-2e56-40e6-8053-9c1628b425bf';

function seededDb(options: { land?: boolean; building?: boolean } = {}): FakeFirestore {
  const fake = new FakeFirestore();
  if (options.land !== false) fake.seed(COLLECTIONS.PUBLIC_LANDS, LAND_ID, { id: LAND_ID });
  if (options.building === true) {
    fake.seed(COLLECTIONS.PUBLIC_BUILDINGS, BUILDING_ID, { id: BUILDING_ID });
  }
  return fake;
}

const asAdmin = (fake: FakeFirestore): AdminFirestore => fake as unknown as AdminFirestore;

// =============================================================================
// Τ — ΤΟ ΠΡΟΘΕΜΑ ΕΙΝΑΙ Ο ΔΙΑΧΩΡΙΣΤΗΣ ΤΥΠΟΥ
// =============================================================================

describe('Τ — η ταυτότητα λέει μόνη της τι είδους τόπος είναι (N.6)', () => {
  it('Τ1 — τα δύο προθέματα αναγνωρίζονται από το ΜΗΤΡΩΟ, όχι από regex εδώ', () => {
    expect(placeKindOf(LAND_ID)).toBe('land');
    expect(placeKindOf(BUILDING_ID)).toBe('building');
  });

  it('Τ2 — οτιδήποτε άλλο δεν είναι τόπος', () => {
    expect(placeKindOf('bldg_8acc7e34-59bd-4dfb-8a56-e2568686250f')).toBeNull();
    expect(placeKindOf('27931128')).toBeNull();
  });
});

// =============================================================================
// Ε — ΟΙ ΠΕΝΤΕ ΕΤΥΜΗΓΟΡΙΕΣ
// =============================================================================

describe('Ε — κάθε ετυμηγορία απαντιέται, και καμία δεν καλύπτει δεύτερη', () => {
  it('Ε1 — γη + κτίριο υπάρχουν ⇒ `exists`', async () => {
    const verdict = await verifyPlaceRef(asAdmin(seededDb({ building: true })), {
      landId: LAND_ID,
      buildingId: BUILDING_ID,
    });
    expect(verdict).toBe('exists');
  });

  it('Ε2 — δεσμός μόνο προς γη ⇒ `exists`, χωρίς να ζητηθεί κτίριο', async () => {
    const verdict = await verifyPlaceRef(asAdmin(seededDb()), {
      landId: LAND_ID,
      buildingId: null,
    });
    expect(verdict).toBe('exists');
  });

  it('Ε3 — η γη δεν υπάρχει ⇒ `land-absent`', async () => {
    const verdict = await verifyPlaceRef(asAdmin(seededDb({ land: false })), {
      landId: LAND_ID,
      buildingId: null,
    });
    expect(verdict).toBe('land-absent');
  });

  it('Ε4 — η γη υπάρχει, το κτίριο όχι ⇒ `building-absent` (ΟΧΙ `exists`)', async () => {
    const verdict = await verifyPlaceRef(asAdmin(seededDb()), {
      landId: LAND_ID,
      buildingId: BUILDING_ID,
    });
    expect(verdict).toBe('building-absent');
  });

  it('Ε5 — ταυτότητα λάθος είδους ⇒ `not-a-place-id`, ΧΩΡΙΣ να αγγιχτεί η βάση', async () => {
    const fake = seededDb({ building: true });

    expect(await verifyPlaceRef(asAdmin(fake), { landId: BUILDING_ID, buildingId: null })).toBe(
      'not-a-place-id',
    );
    expect(await verifyPlaceRef(asAdmin(fake), { landId: LAND_ID, buildingId: LAND_ID })).toBe(
      'not-a-place-id',
    );
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ «ΔΕΝ ΜΑΘΑΜΕ»** — ο κλάδος που η Β2 απέδειξε ότι ξεχνιέται.
   *
   * Χωρίς αυτήν, ο κλάδος `unavailable` θα ήταν φρουρός χωρίς απόδειξη ζωής (ADR-749
   * §5). Και η συνέπεια αν συγχωνευόταν με το `land-absent` είναι ονομάσιμη: η
   * διαδρομή θα απαντούσε **422** («*αυτός ο τόπος δεν υπάρχει*»), ο επαγγελματίας θα
   * πήγαινε να **φτιάξει δεύτερη ταυτότητα** για κτίριο που έχει ήδη μία, και το
   * επίπεδο Α θα παρήγαγε ακριβώς το διπλότυπο που υπάρχει για να αποτρέψει (§14.5).
   */
  it('🔴 Ε6 — η βάση δεν απάντησε ⇒ `unavailable`, ΠΟΤΕ «δεν υπάρχει»', async () => {
    const fake = seededDb({ building: true });
    fake.failReads = true;

    const verdict = await verifyPlaceRef(asAdmin(fake), {
      landId: LAND_ID,
      buildingId: BUILDING_ID,
    });

    expect(verdict).toBe('unavailable');
    expect(verdict).not.toBe('land-absent');
  });
});
