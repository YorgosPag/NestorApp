/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΕΝΟΣ ΓΡΑΦΕΑ** — η αποδεδειγμένη παρουσία γράφεται όταν
 *   αλλάζει η προσφορά, και **επιβιώνει** της δημοσίευσης βιτρίνας *(ADR-846 §8.8.15)*.
 * @related services/mandate/showcase-presence.service · services/mandate/agency-profile.service
 * @module services/mandate/__tests__/showcase-presence-writer
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ: Η ΙΔΙΑ ΒΛΑΒΗ ΜΕ ΤΟ ΣΗΜΑ, ΕΝΑ ΠΕΔΙΟ ΠΙΟ ΠΕΡΑ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Το `publishShowcase` κάνει **`set` ΧΩΡΙΣ `merge`** *(η δήλωση είναι ολόκληρη η
 * βιτρίνα)*. Το `presence` όμως **δεν ανήκει στη δήλωση**: το γράφει **άλλη πράξη, σε
 * άλλο χρόνο** — ακριβώς όπως το `mark`, και με **ακριβώς** τις ίδιες συνέπειες αν
 * ξεχαστεί: **μια αλλαγή επωνυμίας θα έσβηνε σιωπηλά την απόδειξη**, και το γραφείο θα
 * εξαφανιζόταν από τον κατάλογο εκεί όπου δουλεύει — μέχρι την επόμενη δημοσίευση
 * αγγελίας, δηλαδή **επ' αόριστον**.
 *
 * ⚠️ **Το `showcase-mark-survival.test.ts` υπάρχει επειδή αυτή η βλάβη ΣΥΝΕΒΗ.** Αυτό
 * εδώ είναι η ίδια άγκυρα, γραμμένη **πριν** ξανασυμβεί.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🏆 ΤΙ ΕΚΤΕΛΕΙ — ΡΩΤΑΕΙ ΤΟΝ ΔΙΣΚΟ, ΠΟΤΕ ΤΗΝ ΕΠΙΣΤΡΕΦΟΜΕΝΗ ΤΙΜΗ
 * ════════════════════════════════════════════════════════════════════════════
 *
 * **Αληθινό** `FakeFirestore` με CAS. Μετά από κάθε κλήση οι ισχυρισμοί διαβάζουν το
 * **έγγραφο**. Ένα test που έπλαθε το `update()` θα απεδείκνυε ότι ο κώδικας **καλεί**
 * ό,τι νομίζουμε — όχι ότι **γράφεται** ό,τι θέλουμε.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { storedShowcaseDoc } from '@/lib/agency/__fixtures__/showcase-fixture';
import { listing } from '@/lib/demand/__tests__/demand-fixtures';
import { refreshShowcasePresence } from '../showcase-presence.service';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { GeoCircle } from '@/types/geo/coordinates';

const COMPANY = 'comp_presence_writer';
const AT = '2026-09-09T00:00:00.000Z';

const HOME = { lat: 40.64, lng: 22.94 };
const FAR = { lat: 40.06, lng: 23.36 };

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  return { fake, admin: fake as unknown as AdminFirestore };
}

/** Έγγραφο αγγελίας **όπως ζει στο `public_listings`**, με ταυτότητα γραφείου. */
function listingDoc(
  id: string,
  point: { lat: number; lng: number } | null,
): Record<string, unknown> {
  const position =
    point === null
      ? { kind: 'unknown', reason: 'never-asked' }
      : { kind: 'known', provenance: 'manual', point, locatedAt: AT };

  return { ...listing({ id, position, agencyId: COMPANY }) } as unknown as Record<string, unknown>;
}

function presenceOf(fake: FakeFirestore): readonly GeoCircle[] | undefined {
  const rows = fake.all<{ companyId?: string; presence?: readonly GeoCircle[] }>(
    COLLECTIONS.AGENCY_PROFILES,
  );
  return rows[0]?.presence;
}

describe('Γ — ο ΕΝΑΣ γραφέας της αποδεδειγμένης παρουσίας', () => {
  it('🔴 Γ1 — οι ζωντανές αγγελίες γίνονται ΠΕΡΙΟΧΕΣ στο έγγραφο βιτρίνας', async () => {
    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, storedShowcaseDoc({ companyId: COMPANY }));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_a', listingDoc('prop_a', HOME));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_b', listingDoc('prop_b', FAR));

    await refreshShowcasePresence(admin, COMPANY);

    expect(presenceOf(fake)).toEqual([
      { center: FAR, radiusKm: 0 },
      { center: HOME, radiusKm: 0 },
    ]);
  });

  it('🔴 Γ2 — ΡΩΤΑΕΙ ΜΕ ΤΗΝ ΤΑΥΤΟΤΗΤΑ: ξένη αγγελία ΔΕΝ μετράει', () => {
    // 🔴 Η άγκυρα που δεν αντικαθίσταται από καμία άλλη: ένας γραφέας που διάβαζε
    //    **όλες** τις αγγελίες θα άφηνε το Γ1 πράσινο και θα απέδιδε σε κάθε γραφείο τα
    //    ακίνητα **όλης της αγοράς** — δηλαδή θα το εμφάνιζε παντού.
    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, storedShowcaseDoc({ companyId: COMPANY }));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_mine', listingDoc('prop_mine', HOME));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_theirs', {
      ...listingDoc('prop_theirs', FAR),
      agencyId: 'comp_allos',
    });

    return refreshShowcasePresence(admin, COMPANY).then(() => {
      expect(presenceOf(fake)).toEqual([{ center: HOME, radiusKm: 0 }]);
    });
  });

  it('Γ3 — ΑΠΟΣΥΡΣΗ: χωρίς ζωντανές αγγελίες η απόδειξη ΑΔΕΙΑΖΕΙ', async () => {
    // ⚠️ Ένα `presence` που κρατά την παλιά περιοχή είναι **ψευδής ισχυρισμός με
    //    ημερομηνία λήξης**: το γραφείο ξεπούλησε και εξακολουθεί να «είναι εκεί».
    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, {
      ...storedShowcaseDoc({ companyId: COMPANY }),
      presence: [{ center: HOME, radiusKm: 0 }],
    });

    await refreshShowcasePresence(admin, COMPANY);

    expect(presenceOf(fake)).toEqual([]);
  });

  it('Γ4 — αγγελία ΧΩΡΙΣ θέση δεν αποδεικνύει τίποτα (η σημερινή πλειοψηφία)', async () => {
    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, storedShowcaseDoc({ companyId: COMPANY }));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_x', listingDoc('prop_x', null));

    await refreshShowcasePresence(admin, COMPANY);

    expect(presenceOf(fake)).toEqual([]);
  });

  it('🔑 Γ5 — ΒΙΤΡΙΝΑ ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ⇒ ΣΙΩΠΗ, ποτέ εξαίρεση', async () => {
    // Ο επαγγελματίας μπορεί να έχει αγγελίες **χωρίς** δημοσιευμένη βιτρίνα — η βιτρίνα
    // είναι opt-in (§4.2). Μια εξαίρεση εδώ θα **ακύρωνε τη δημοσίευση της αγγελίας**,
    // δηλαδή το μάρκετινγκ θα έριχνε τη **δέσμευση προς τον ιδιοκτήτη** (CHECK 3.56).
    const { fake, admin } = db();
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_a', listingDoc('prop_a', HOME));

    await expect(refreshShowcasePresence(admin, COMPANY)).resolves.toBeUndefined();
  });

  it('Γ6 — κενή ταυτότητα ⇒ ΤΕΛΟΣ, καμία ανάγνωση', async () => {
    const { fake, admin } = db();
    const before = fake.writes;

    await refreshShowcasePresence(admin, '   ');

    expect(fake.writes).toBe(before);
  });

  it('Γ7 — ιδεμποτής: δεύτερη κλήση δεν αλλάζει τίποτα', async () => {
    const { fake, admin } = db();
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, storedShowcaseDoc({ companyId: COMPANY }));
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_a', listingDoc('prop_a', HOME));

    await refreshShowcasePresence(admin, COMPANY);
    const once = presenceOf(fake);
    await refreshShowcasePresence(admin, COMPANY);

    expect(presenceOf(fake)).toEqual(once);
  });

  it('🔴 Γ8 — ΤΟ `update` ΔΕΝ ΔΙΕΚΔΙΚΕΙ ΤΟ ΕΓΓΡΑΦΟ: η βιτρίνα μένει άθικτη', async () => {
    // Ένα `set` εδώ θα έκανε αυτή την πράξη **δεύτερο γραφέα της βιτρίνας** — και η
    // επόμενη ανανέωση παρουσίας θα έσβηνε επωνυμία, ΓΕΜΗ και σήμα.
    const { fake, admin } = db();
    const seeded = storedShowcaseDoc({ companyId: COMPANY, displayName: 'ΑΛΦΑ Α.Ε.' });
    fake.seed(COLLECTIONS.AGENCY_PROFILES, COMPANY, seeded);
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, 'prop_a', listingDoc('prop_a', HOME));

    await refreshShowcasePresence(admin, COMPANY);

    const [doc] = fake.all<{ displayName?: string; alias?: string }>(COLLECTIONS.AGENCY_PROFILES);
    expect(doc?.displayName).toBe('ΑΛΦΑ Α.Ε.');
    expect(doc?.alias).toBe(seeded.alias);
  });
});
