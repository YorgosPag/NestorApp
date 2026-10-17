/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §27 — **η πράξη** «ανάθεση έκδοσης» πάνω στο fake Firestore, χωρίς mocks βάσης: ο κριτής είναι ο
 *   ΙΔΙΟΣ αναγνώστης με την οθόνη, η απόφαση δένεται στον ΥΠΕΥΘΥΝΟ ιδιοκτήτη, η CAS κόβει τις παλιές οθόνες, και ο
 *   κατάλογος γυρίζει ως υποψήφιοι «ξανά». Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { IssuanceAssignmentBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { actOnIssuanceAssignment } from '@/services/document-registry/issuance-assignment.service';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') },
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { EntityAuditService } = require('@/services/entity-audit.service') as { EntityAuditService: { recordChange: jest.Mock } };

const COMPANY = 'comp_alfa';
const OTHER = 'comp_beta';
const NOW = new Date('2026-10-17T09:00:00.000Z');
const ACTOR = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
const KEY = 'prop_1:energy-certificate';
const TARGET = { propertyId: 'prop_1', documentKind: 'energy-certificate' } as const;

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const act = (body: IssuanceAssignmentBody, propertyTarget = TARGET) => actOnIssuanceAssignment(db(), ACTOR, { ...body, ...propertyTarget }, NOW);
const stored = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS)[issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate')];

const PROPOSE = {
  action: 'propose', ...TARGET, expectedStage: null, professionalContactId: 'cont_pro',
  qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7',
} as const satisfies IssuanceAssignmentBody;
const DECIDE = {
  action: 'decide', ...TARGET, expectedStage: 'proposed', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
} as const satisfies IssuanceAssignmentBody;

/** Ακίνητο με ΠΕΑ που λήγει 2026-11-01 (⇒ `expiring` ⇒ «Ανάθεση») και αγοραστές με μερίδια μετά το οριστικό. */
function seedProperty(id: string, shares: readonly (readonly [string, number])[], companyId = COMPANY): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, {
    companyId, name: `Διαμέρισμα ${id}`, energy: { class: 'B', issuedOn: '2016-11-01', sourceFileId: null },
    commercial: { legalPhase: 'final_signed', owners: shares.map(([contactId, ownershipPct]) => ({ contactId, ownershipPct })) },
  });
}

function seedContact(id: string, firstName: string, companyId = COMPANY): void {
  fake.seed(COLLECTIONS.CONTACTS, id, { companyId, type: 'individual', firstName, lastName: 'Συνθετικός' });
}

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
  seedProperty('prop_1', [['cont_a', 60], ['cont_b', 40]]);
  seedContact('cont_a', 'Άλφα');
  seedContact('cont_b', 'Βήτα');
  seedContact('cont_pro', 'Επιθεωρητής');
});

describe('actOnIssuanceAssignment — πρόταση', () => {
  it('γράφει την πρόταση, το μητρώο τη διαβάζει πίσω, και το ιστορικό λέει «— → προτάθηκε» + «— → Επιθεωρητής»', async () => {
    expect(await act(PROPOSE)).toMatchObject({ ok: true, outcome: 'changed', stage: 'proposed' });
    expect(stored()).toMatchObject({
      companyId: COMPANY, propertyId: 'prop_1', scope: 'property', documentKind: 'energy-certificate',
      professionalContactId: 'cont_pro', credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7' },
      proposedByUid: 'user_1', decision: null,
    });
    const registry = await readDocumentRegistry(db(), COMPANY, NOW);
    expect(registry.issuanceKnown).toBe(true);
    expect(registry.issuance[KEY].record?.professionalContactId).toBe('cont_pro');
    expect(registry.people.cont_pro).toEqual({ name: 'Επιθεωρητής Συνθετικός' });
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'property', entityId: 'prop_1', companyId: COMPANY,
      changes: [
        { field: 'energyCertificateIssuanceStage', oldValue: null, newValue: 'proposed' },
        expect.objectContaining({ field: 'energyCertificateIssuer', oldValue: null, newValue: 'cont_pro', newValueLabel: 'Επιθεωρητής Συνθετικός' }),
      ],
    }));
  });

  it('η ΙΔΙΑ πρόταση ξανά ⇒ `unchanged`, κανένα δεύτερο ίχνος', async () => {
    await act(PROPOSE);
    EntityAuditService.recordChange.mockClear();
    expect(await act({ ...PROPOSE, expectedStage: 'proposed' })).toMatchObject({ ok: true, outcome: 'unchanged', stage: 'proposed' });
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('🔴 CAS: οθόνη που δεν είδε την πρόταση (`expectedStage: null`) ⇒ `stale`, τίποτα δεν αλλάζει', async () => {
    await act(PROPOSE);
    expect(await act({ ...PROPOSE, professionalContactId: 'cont_b' })).toEqual({ ok: false, refusal: 'stale' });
    expect(stored()).toMatchObject({ professionalContactId: 'cont_pro' });
  });

  it('επαφή ΑΛΛΟΥ γραφείου ⇒ `contact-unavailable` · προσόν που δεν υπογράφει ΠΕΑ ⇒ `unqualified`', async () => {
    seedContact('cont_foreign', 'Ξένος', OTHER);
    expect(await act({ ...PROPOSE, professionalContactId: 'cont_foreign' })).toEqual({ ok: false, refusal: 'contact-unavailable' });
    expect(await act({ ...PROPOSE, qualification: 'civil-engineer' })).toEqual({ ok: false, refusal: 'unqualified' });
    expect(stored()).toBeUndefined();
  });

  it('ακίνητο ΑΛΛΟΥ γραφείου ή ανύπαρκτο ⇒ `absent`', async () => {
    seedProperty('prop_x', [['cont_a', 100]], OTHER);
    expect(await act(PROPOSE, { propertyId: 'prop_x', documentKind: 'energy-certificate' })).toEqual({ ok: false, refusal: 'absent' });
    expect(await act(PROPOSE, { propertyId: 'prop_missing', documentKind: 'energy-certificate' })).toEqual({ ok: false, refusal: 'absent' });
  });
});

describe('actOnIssuanceAssignment — απόφαση του ΥΠΕΥΘΥΝΟΥ', () => {
  it('πλειοψηφία 60% ⇒ ο Άλφα αποφασίζει· η απόφαση γράφει ΑΥΤΟΝ (από τον κριτή), κανάλι, ώρα', async () => {
    await act(PROPOSE);
    expect(await act(DECIDE)).toMatchObject({ ok: true, outcome: 'changed', stage: 'ownerApproved' });
    expect(stored()).toMatchObject({
      decision: { outcome: 'approved', ownerContactId: 'cont_a', basis: 'recorded-instruction', channel: 'phone', recordedByUid: 'user_1' },
    });
  });

  it('🔴 ο υπεύθυνος άλλαξε στο μεταξύ (η οθόνη είδε τον Βήτα) ⇒ `lead-changed`, ποτέ απόφαση στο όνομα άλλου', async () => {
    await act(PROPOSE);
    expect(await act({ ...DECIDE, expectedOwnerContactId: 'cont_b' })).toEqual({ ok: false, refusal: 'lead-changed' });
    expect(stored()).toMatchObject({ decision: null });
  });

  it('🔴 50/50 ⇒ κανείς υπεύθυνος ⇒ `lead-undesignated` (ένας δεν αποφασίζει για όλους χωρίς βάση)', async () => {
    seedProperty('prop_1', [['cont_a', 50], ['cont_b', 50]]);
    await act(PROPOSE);
    expect(await act(DECIDE)).toEqual({ ok: false, refusal: 'lead-undesignated' });
  });

  it('🔴 «ποτέ δύο»: μετά την έγκριση, πρόταση άλλου ⇒ `transition-refused`', async () => {
    await act(PROPOSE);
    await act(DECIDE);
    expect(await act({ ...PROPOSE, expectedStage: 'ownerApproved', professionalContactId: 'cont_b' }))
      .toEqual({ ok: false, refusal: 'transition-refused' });
  });
});

describe('ο κατάλογος του γραφείου γυρίζει ως «ξανά»', () => {
  it('εγκεκριμένη ανάθεση στο prop_1 ⇒ ο επιθεωρητής προτείνεται για το ΠΕΑ του prop_2, με το προσόν του', async () => {
    seedProperty('prop_2', [['cont_b', 100]]);
    await act(PROPOSE);
    await act(DECIDE);
    const registry = await readDocumentRegistry(db(), COMPANY, NOW);
    expect(registry.issuance['prop_2:energy-certificate'].candidates).toEqual([{
      contactId: 'cont_pro',
      reasons: [{ kind: 'previously-assigned', count: 1, lastAt: NOW.toISOString() }],
      credential: { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7' },
    }]);
  });
});
