/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §26 — **η πράξη** «ορισμός υπευθύνου» πάνω στο fake Firestore: ο κριτής «είναι ιδιοκτήτης;»
 *   είναι ο ΙΔΙΟΣ αναγνώστης με την οθόνη, ο γραφέας ιδεμποτής, το ιστορικό γράφει «από → σε» με ονόματα.
 *   Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { readDocumentRegistry } from '@/services/document-registry/document-registry.service';
import { obligorDesignationIdOf } from '@/services/document-registry/obligor-designation-schema';
import { designateRegistryObligor } from '@/services/document-registry/obligor-designation.service';

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

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const designate = (contactId: string | null, propertyId = 'prop_1') =>
  designateRegistryObligor(db(), ACTOR, { propertyId, contactId }, NOW);
const stored = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_OBLIGOR_DESIGNATIONS)[obligorDesignationIdOf(COMPANY, 'prop_1')];

/** Ακίνητο με ΠΕΑ (⇒ γραμμή στο μητρώο ⇒ οι ιδιοκτήτες ρωτιούνται) και δύο αγοραστές μετά το οριστικό. */
function seedProperty(id: string, companyId = COMPANY): void {
  fake.seed(COLLECTIONS.PROPERTIES, id, {
    companyId, name: 'Διαμέρισμα Α1', energy: { class: 'B', issuedOn: '2016-11-01', sourceFileId: null },
    commercial: { legalPhase: 'final_signed', owners: [{ contactId: 'cont_a', ownershipPct: 50 }, { contactId: 'cont_b', ownershipPct: 50 }] },
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  EntityAuditService.recordChange.mockClear();
  seedProperty('prop_1');
  fake.seed(COLLECTIONS.CONTACTS, 'cont_a', { companyId: COMPANY, type: 'individual', firstName: 'Άλφα', lastName: 'Συνθετικός' });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_b', { companyId: COMPANY, type: 'individual', firstName: 'Βήτα', lastName: 'Συνθετικός' });
});

describe('designateRegistryObligor', () => {
  it('50/50 ⇒ κανείς· ο ορισμός του Βήτα γράφεται, φαίνεται στο μητρώο ως `explicit`, και αφήνει ιστορικό «— → Βήτα»', async () => {
    expect((await readDocumentRegistry(db(), COMPANY, NOW)).properties.prop_1.obligorLead).toMatchObject({ kind: 'undesignated', reason: 'no-majority' });
    expect(await designate('cont_b')).toEqual({ ok: true, outcome: 'changed' });
    expect(stored()).toMatchObject({ companyId: COMPANY, propertyId: 'prop_1', scope: 'property', contactId: 'cont_b', designatedByUid: 'user_1' });
    expect((await readDocumentRegistry(db(), COMPANY, NOW)).properties.prop_1.obligorLead).toMatchObject({ contactId: 'cont_b', basis: 'explicit' });
    expect(EntityAuditService.recordChange).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'property', entityId: 'prop_1', action: 'updated', companyId: COMPANY,
      changes: [expect.objectContaining({ field: 'documentObligorLead', oldValue: null, newValue: 'cont_b', newValueLabel: 'Βήτα Συνθετικός' })],
    }));
  });

  it('η ΙΔΙΑ επιλογή ξανά ⇒ `unchanged`: καμία εγγραφή, κανένα δεύτερο ίχνος (ιδεμποτές)', async () => {
    await designate('cont_b');
    EntityAuditService.recordChange.mockClear();
    expect(await designate('cont_b')).toEqual({ ok: true, outcome: 'unchanged' });
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('επαναφορά (`null`) ⇒ το έγγραφο σβήνεται και το ιστορικό λέει «Βήτα → —»', async () => {
    await designate('cont_b');
    expect(await designate(null)).toEqual({ ok: true, outcome: 'changed' });
    expect(stored()).toBeUndefined();
    expect(EntityAuditService.recordChange).toHaveBeenLastCalledWith(expect.objectContaining({
      changes: [expect.objectContaining({ oldValue: 'cont_b', newValue: null, oldValueLabel: 'Βήτα Συνθετικός' })],
    }));
  });

  it('🔴 επαφή που ΔΕΝ είναι ιδιοκτήτης ⇒ `not-an-owner`, τίποτα δεν γράφεται (ο πελάτης δεν κρίνει)', async () => {
    expect(await designate('cont_stranger')).toEqual({ ok: false, refusal: 'not-an-owner' });
    expect(stored()).toBeUndefined();
    expect(EntityAuditService.recordChange).not.toHaveBeenCalled();
  });

  it('ακίνητο ΑΛΛΟΥ γραφείου ή ανύπαρκτο ⇒ `absent` (ποτέ «υπάρχει αλλά όχι δικό σου»)', async () => {
    seedProperty('prop_x', OTHER);
    expect(await designate('cont_a', 'prop_x')).toEqual({ ok: false, refusal: 'absent' });
    expect(await designate('cont_a', 'prop_missing')).toEqual({ ok: false, refusal: 'absent' });
  });
});
