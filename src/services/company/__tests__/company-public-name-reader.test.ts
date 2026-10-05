/**
 * @jest-environment node
 *
 * @fileoverview **ΠΟΙΑ ΤΑΥΤΟΤΗΤΑ ΕΤΑΙΡΕΙΑΣ ΑΞΙΖΕΙ ΑΝΑΓΝΩΣΗ** — άγκυρα του `usableCompanyIdOf`.
 * @related services/company/company-public-name.reader.ts · services/mandate/private-marketing-panel.service.ts
 *
 * 🔴 **Το περιστατικό (2026-10-05, ζωντανά)**: `GET /api/owner-properties/ownp_bc548607…/private-marketing` ⇒ **500**
 * `Cannot read properties of undefined (reading 'trim')`. Η εντολή εκείνου του εγγράφου γράφτηκε πριν το ADR-832 και
 * **δεν έχει** `agencyCompanyId`· ο τύπος λέει `string`, η βάση κρατά `undefined`.
 *
 * | # | Άγκυρα | Μετάλλαξη που τη ρίχνει |
 * |---|---|---|
 * | Τ1 | απούσα / κενή ταυτότητα ⇒ `null`, **χωρίς εξαίρεση και χωρίς ανάγνωση** | `typeof … === 'string'` → `!== null` |
 * | Τ2 | έγκυρη ταυτότητα ⇒ η επωνυμία του `companies/{id}` | `usableCompanyIdOf` → πάντα `null` |
 * | Τ3 | ο αναγνώστης πάνελ **δεν πέφτει** σε εντολή χωρίς `agencyCompanyId` | ίδια με Τ1 |
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { validOwnerProperty, brokeredMandate } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readCompanyPublicName } from '@/services/company/company-public-name.reader';
import { readPrivateMarketingPanels } from '@/services/mandate/private-marketing-panel.service';

const COMPANY = 'comp_grafeio_a';
const NAME = 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ';

function db(): { fake: FakeFirestore; admin: AdminFirestore } {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.COMPANIES, COMPANY, { name: NAME });
  return { fake, admin: fake as unknown as AdminFirestore };
}

describe('Τ1 — ταυτότητα που ΔΕΝ αξίζει ανάγνωση', () => {
  it.each([[undefined], [null], [''], ['   ']])('🔴 %p ⇒ null, χωρίς εξαίρεση και χωρίς ανάγνωση', async (companyId) => {
    const { fake, admin } = db();
    const collection = jest.spyOn(fake, 'collection');

    await expect(readCompanyPublicName(admin, companyId)).resolves.toBeNull();
    expect(collection).not.toHaveBeenCalled();
  });
});

describe('Τ2 — παρονομαστής: έγκυρη ταυτότητα', () => {
  it('🔑 επιστρέφει την επωνυμία του `companies/{id}`', async () => {
    await expect(readCompanyPublicName(db().admin, COMPANY)).resolves.toBe(NAME);
  });
});

describe('Τ3 — ο αναγνώστης πάνελ με εντολή ΠΡΙΝ το ADR-832', () => {
  it('🔴 εντολή χωρίς `agencyCompanyId` ⇒ πάνελ με κενή επωνυμία, ποτέ εξαίρεση', async () => {
    const { fake, admin } = db();
    const { agencyCompanyId: _absent, ...legacy } = brokeredMandate({ confirmation: 'confirmed', agreement: 'open' });
    // Ό,τι κρατά η βάση, όχι ό,τι υπόσχεται ο τύπος: το έγγραφο σπέρνεται ωμό, χωρίς το πεδίο.
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, 'ownp_legacy', { ...validOwnerProperty({ authorCompanyId: null }), mandates: [legacy] });

    const read = await readPrivateMarketingPanels(admin, 'ownp_legacy', { uid: 'user-1', companyId: null }, '2026-09-16T10:00:00.000Z');

    expect(read.kind).toBe('found');
    expect(read.kind === 'found' && read.panels.map((panel) => panel.agencyName)).toEqual(['']);
  });
});
