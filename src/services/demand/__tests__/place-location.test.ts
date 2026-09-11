/**
 * @jest-environment node
 *
 * Άγκυρα — **ΠΟΥ ΖΕΙ ΜΙΑ ΤΑΥΤΟΤΗΤΑ ΑΚΙΝΗΤΟΥ** (`locatePlace`, ADR-849 §6δ Β2)
 *
 * 🔑 Ο κάτοχος του χώρου βγαίνει από τη **συλλογή**, ποτέ από το πρόθεμα `ownp_`/`prop_`:
 * η άγκυρα Ζ3 δίνει σε ακίνητο γραφείου ταυτότητα με πρόθεμα ιδιώτη, και η απάντηση
 * οφείλει να μείνει **σωστή**.
 *
 * | # | ισχυρισμός | η μετάλλαξη που το σπάει |
 * |---|---|---|
 * | Ζ1 | ιδιώτης πρώτα, και ο κάτοχος είναι ο συγγραφέας | ανεστραμμένη σειρά |
 * | Ζ2 | γραφείο ⇒ η εταιρεία του ακινήτου | `createdBy` / `tenantId` ως κάτοχος |
 * | Ζ3 | η συλλογή αποφασίζει, όχι το πρόθεμα | `id.startsWith('prop_')` |
 * | Ζ4 | γραφείο χωρίς εταιρεία ⇒ `unscoped`, όχι «κάπου» | κενό ως κάτοχος |
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { locatePlace } from '@/services/demand/place-interest.service';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

const OWNER_LISTING = {
  authorUserId: 'u_owner',
  authorCompanyId: null,
  type: 'apartment',
  title: 'Δοκιμαστικό',
  areaSqm: 80,
  bedrooms: 2,
  floor: 1,
  offers: null,
  mandate: { kind: 'owner' },
  place: { kind: 'declined' },
};

function db(seed: (fake: FakeFirestore) => void): AdminFirestore {
  const fake = new FakeFirestore();
  seed(fake);
  return fake as unknown as AdminFirestore;
}

describe('locatePlace — η συλλογή, ποτέ το πρόθεμα', () => {
  it('Ζ1 — ακίνητο ιδιώτη ⇒ κάτοχος χώρου ο συγγραφέας του', async () => {
    const world = db((fake) => fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_1', OWNER_LISTING));
    expect(await locatePlace(world, 'ownp_1')).toEqual({
      kind: 'found',
      source: 'owner-property',
      holderId: 'u_owner',
    });
  });

  it('Ζ2 — ακίνητο γραφείου ⇒ κάτοχος χώρου η ΕΤΑΙΡΕΙΑ του, όχι αυτός που το καταχώρησε', async () => {
    const world = db((fake) =>
      fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', { companyId: 'comp_9c7c', createdBy: 'u_staff' }),
    );
    expect(await locatePlace(world, 'prop_1')).toEqual({
      kind: 'found',
      source: 'company-property',
      holderId: 'comp_9c7c',
    });
  });

  it('Ζ3 🔴 — η συλλογή αποφασίζει: ταυτότητα με πρόθεμα ιδιώτη, ζει στα ακίνητα γραφείου', async () => {
    const world = db((fake) => fake.seed(COLLECTIONS.PROPERTIES, 'ownp_looks_private', { companyId: 'comp_1' }));
    expect(await locatePlace(world, 'ownp_looks_private')).toMatchObject({
      source: 'company-property',
      holderId: 'comp_1',
    });
  });

  it.each([{}, { companyId: '' }, { companyId: null }])(
    'Ζ4 🔴 — ακίνητο γραφείου χωρίς εταιρεία (%p) ⇒ unscoped',
    async (data) => {
      const world = db((fake) => fake.seed(COLLECTIONS.PROPERTIES, 'prop_x', data));
      expect(await locatePlace(world, 'prop_x')).toEqual({ kind: 'unscoped' });
    },
  );

  it('Ζ5 — πουθενά ⇒ absent', async () => {
    expect(await locatePlace(db(() => undefined), 'prop_gone')).toEqual({ kind: 'absent' });
  });
});
