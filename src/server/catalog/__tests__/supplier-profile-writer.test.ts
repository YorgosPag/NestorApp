/**
 * Ο γραφέας του προφίλ παρόχου (ADR-923 §22 Υ8): CAS, έλεγχος μέσων και εγγραφή του χώρου στη σάρωση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import type { CatalogSupplierProfileDefinition } from '@/subapps/catalog/types/supplier-profile';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { saveSupplierProfile } from '../supplier-profile-writer.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef } from '../public/public-outbox.server';
import { PUBLIC_PROFILE_SCOPE } from '@/subapps/catalog/public/public-scopes-of-write';

jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => db, isFirebaseAdminAvailable: () => true }));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'audit-id'), diffFields: () => [] } }));
jest.mock('next/server', () => ({ after: jest.fn() }));

const COMPANY = 'comp-a';
const CTX = { uid: 'user-1', companyId: COMPANY, globalRole: 'company_admin' } as unknown as AuthContext;
const ASSET_ID = 'casst_1';
const definition = (assetIds: readonly string[] = [ASSET_ID]): CatalogSupplierProfileDefinition => ({
  description: { el: 'Κείμενο' },
  projects: [{ id: 'cprjt_1', title: { el: 'Έργο' }, description: {}, year: 2024, assetIds }],
});

let fake: FakeFirestore;
let db: Firestore;

const code = async (promise: Promise<unknown>) => promise.then(() => 'ok', (error: { issues?: readonly { code: string }[]; kind?: string }) => error.issues?.[0]?.code ?? error.kind ?? 'error');

beforeEach(() => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  fake.seed('catalog_assets', ASSET_ID, { id: ASSET_ID, companyId: COMPANY, isDeleted: false });
  fake.seed('catalog_assets', 'casst_foreign', { id: 'casst_foreign', companyId: 'comp-b', isDeleted: false });
});

describe('saveSupplierProfile', () => {
  it('πρώτη αποθήκευση με αναθεώρηση 0: ένα έγγραφο στο ντετερμινιστικό id, με σημείωση `profile`', async () => {
    const stored = await saveSupplierProfile(CTX, 0, definition());
    expect(stored).toMatchObject({ id: generateDeterministicCatalogSupplierProfileId(COMPANY), companyId: COMPANY, revision: 1 });
    expect((await publicOutboxRef(db, COMPANY, PUBLIC_PROFILE_SCOPE).get()).data()).toMatchObject({ revision: 1, dirty: true });
  });

  it('🔑 ο χώρος μπαίνει στην κρίση της σάρωσης χωρίς να ξεκινήσει πέρασμα καταλόγου', async () => {
    await saveSupplierProfile(CTX, 0, definition());
    const record = (await publicOutboxRef(db, COMPANY, PUBLIC_CATALOG_SCOPE).get()).data();
    expect(record).toMatchObject({ companyId: COMPANY, scope: 'catalog' });
    expect(record?.revision).toBeUndefined();
    expect(record?.dirty).toBeUndefined();
  });

  it('🔒 παλιά αναθεώρηση απορρίπτεται', async () => {
    await saveSupplierProfile(CTX, 0, definition());
    expect(await code(saveSupplierProfile(CTX, 0, definition()))).not.toBe('ok');
  });

  it('🔒 ξένο ή ανύπαρκτο μέσο απορρίπτεται με εύρημα', async () => {
    expect(await code(saveSupplierProfile(CTX, 0, definition(['casst_foreign'])))).toBe('unknownReference');
    expect(await code(saveSupplierProfile(CTX, 0, definition(['casst_none'])))).toBe('unknownReference');
  });

  it('εύρημα επικύρωσης σταματά πριν από κάθε ανάγνωση', async () => {
    expect(await code(saveSupplierProfile(CTX, 0, definition([])))).toBe('portfolioProjectImagesRequired');
  });

  it('πεδίο εκτός ορισμού δεν αποθηκεύεται', async () => {
    const stored = await saveSupplierProfile(CTX, 0, { ...definition(), address: 'Οδός 1' } as CatalogSupplierProfileDefinition);
    expect(JSON.stringify(stored)).not.toContain('Οδός 1');
  });
});
