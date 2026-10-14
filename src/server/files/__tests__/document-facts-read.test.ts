/**
 * @jest-environment node
 *
 * ⚓ ADR-915 Φ3β-2 — ο αναγνώστης γεγονότων ΜΕΣΑ ΑΠΟ ΤΟ ΔΟΧΕΙΟ: ό,τι δεν είναι δικό σου, αυτού του ακινήτου, έτοιμο και
 * PDF ⇒ `null` (καμία διαρροή, καμία διάκριση). Μαζί: το ΕΝΑ δοχείο του ΠΕΑ (εισαγωγή + γραφείς).
 * Τιμές **συνθετικές**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { UNDECLARED_ENERGY_CERTIFICATE } from '@/lib/energy-certificate/energy-certificate';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import {
  companyPeaFileScope,
  ownerPeaFileScope,
  peaSourceFacts,
} from '@/server/energy-certificate/energy-certificate-file-scope';

import { readContainerDocumentFacts } from '../document-facts-read';

const FACTS = {
  kind: 'energy-certificate',
  issuedOn: '2024-03-12',
  printedValidUntil: '2034-03-12',
  source: { kind: 'document-text', reader: 'pea-text' },
  recordedBy: 'u1',
  recordedAt: '2026-10-14T10:00:00.000Z',
};

const COMPANY_FILE = {
  companyId: 'comp_a',
  entityType: 'property',
  entityId: 'prop_1',
  status: 'ready',
  contentType: 'application/pdf',
  storagePath: 'companies/comp_a/x.pdf',
  documentFacts: FACTS,
};

function dbWith(collection: string, id: string, data: Record<string, unknown>): AdminFirestore {
  const db = new FakeFirestore();
  db.seed(collection, id, data);
  return db as unknown as AdminFirestore;
}

const read = (data: Record<string, unknown>, scope = companyPeaFileScope('comp_a', 'prop_1')) =>
  readContainerDocumentFacts(dbWith(COLLECTIONS.FILES, 'file_1', data), scope, 'file_1');

describe('Δ1 — γραφείο: μόνο το δικό σου ΠΕΑ αυτού του ακινήτου', () => {
  it('δικό σου, έτοιμο PDF ⇒ τα γεγονότα', async () => {
    expect(await read(COMPANY_FILE)).toEqual(FACTS);
  });

  it.each([
    ['ξένη εταιρεία', { companyId: 'comp_b' }],
    ['άλλο ακίνητο', { entityId: 'prop_2' }],
    ['στον κάδο', { isDeleted: true }],
    ['όχι έτοιμο', { status: 'uploading' }],
    ['όχι PDF', { contentType: 'image/jpeg' }],
  ])('🔒 %s ⇒ null', async (_label, over) => {
    expect(await read({ ...COMPANY_FILE, ...over })).toBeNull();
  });

  it('ανύπαρκτο αρχείο ⇒ null', async () => {
    const db = dbWith(COLLECTIONS.FILES, 'file_1', COMPANY_FILE);
    expect(await readContainerDocumentFacts(db, companyPeaFileScope('comp_a', 'prop_1'), 'file_missing')).toBeNull();
  });

  it('αρχείο πριν τη Φ3 (χωρίς γεγονότα) / αλλοιωμένα ⇒ null — καμία μετάπτωση', async () => {
    const { documentFacts: _omitted, ...before } = COMPANY_FILE;
    expect(await read(before)).toBeNull();
    expect(await read({ ...COMPANY_FILE, documentFacts: { kind: 'άγνωστο' } })).toBeNull();
  });
});

describe('Δ2 — ιδιώτης: ο φάκελος του ακινήτου, ΜΟΝΟ σε προσωπική θεματοφυλακή', () => {
  const PERSONAL_FILE = { ...COMPANY_FILE, companyId: undefined, userId: 'user-1', entityType: 'property_dossier', entityId: 'pdos_1' };
  const readPersonal = (property = validOwnerProperty({ dossierId: 'pdos_1' }), uid = 'user-1') =>
    readContainerDocumentFacts(dbWith(COLLECTIONS.FILES_PERSONAL, 'file_1', PERSONAL_FILE), ownerPeaFileScope(uid, property), 'file_1');

  it('ο κάτοχος, στον φάκελο ⇒ τα γεγονότα', async () => {
    expect(await readPersonal()).toEqual(FACTS);
  });

  it('🔒 άλλος χρήστης · αγγελία χωρίς φάκελο · αγγελία γραφείου ⇒ null', async () => {
    expect(await readPersonal(undefined, 'user-2')).toBeNull();
    expect(await readPersonal(validOwnerProperty())).toBeNull();
    expect(await readPersonal(validOwnerProperty({ dossierId: 'pdos_1', authorCompanyId: 'comp_a' }))).toBeNull();
  });
});

describe('Δ3 — `peaSourceFacts`: ανάγνωση ΜΟΝΟ όταν το μπλοκ δηλώνει πηγή', () => {
  it('χωρίς `sourceFileId` ⇒ null χωρίς καμία ανάγνωση', async () => {
    const get = jest.fn();
    const db = { collection: () => ({ doc: () => ({ get }) }) } as unknown as AdminFirestore;
    expect(await peaSourceFacts(db, companyPeaFileScope('comp_a', 'prop_1'), UNDECLARED_ENERGY_CERTIFICATE)).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('με πηγή ⇒ τα γεγονότα της, μέσα από το ίδιο δοχείο', async () => {
    const db = dbWith(COLLECTIONS.FILES, 'file_1', COMPANY_FILE);
    const certificate = { ...UNDECLARED_ENERGY_CERTIFICATE, class: 'B' as const, sourceFileId: 'file_1' };
    expect(await peaSourceFacts(db, companyPeaFileScope('comp_a', 'prop_1'), certificate)).toEqual(FACTS);
  });
});
