/**
 * Ο γραφέας του προφίλ παρόχου (ADR-923 §22 Υ8): CAS, έλεγχος μέσων και εγγραφή του χώρου στη σάρωση.
 */

import type { Firestore } from 'firebase-admin/firestore';

import type { AuthContext } from '@/lib/auth';
import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import type { CatalogSupplierProfileDefinition } from '@/subapps/catalog/types/supplier-profile';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { saveQuoteIntake, saveSupplierProfile } from '../supplier-profile-writer.server';
import { readPublicProfileSnapshot, supplierAcceptsQuotesInTx } from '../public/public-model-snapshot.server';
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

describe('saveQuoteIntake (ADR-923 §5.13 Ε6β)', () => {
  const ACCEPTING = { enabled: true, recipientEmail: 'quotes@aries.example' };

  it('πρώτη αποθήκευση χωρίς προφίλ: κενό περιεχόμενο, η ρύθμιση, και σημείωση `profile` για τη βιτρίνα', async () => {
    const stored = await saveQuoteIntake(CTX, 0, ACCEPTING);
    expect(stored).toMatchObject({ revision: 1, description: {}, projects: [], quoteIntake: ACCEPTING });
    expect((await publicOutboxRef(db, COMPANY, PUBLIC_PROFILE_SCOPE).get()).data()).toMatchObject({ revision: 1, dirty: true });
  });

  it('🔑 οι δύο πράξεις κρατούν η μία το κομμάτι της άλλης', async () => {
    await saveSupplierProfile(CTX, 0, definition());
    const withIntake = await saveQuoteIntake(CTX, 1, ACCEPTING);
    expect(withIntake).toMatchObject({ revision: 2, description: { el: 'Κείμενο' }, quoteIntake: ACCEPTING });
    expect(withIntake.projects).toHaveLength(1);
    const withProfile = await saveSupplierProfile(CTX, 2, { ...definition(), description: { el: 'Νέο' } });
    expect(withProfile).toMatchObject({ revision: 3, description: { el: 'Νέο' }, quoteIntake: ACCEPTING });
  });

  it('🔑 προφίλ πριν από το Ε6β (χωρίς `quoteIntake`) αποθηκεύεται με «δεν δέχεται», όχι με `undefined`', async () => {
    const id = generateDeterministicCatalogSupplierProfileId(COMPANY);
    await saveSupplierProfile(CTX, 0, definition());
    const legacy = { ...fake.getData('catalog_supplier_profiles', id) };
    delete legacy.quoteIntake;
    fake.seed('catalog_supplier_profiles', id, legacy);
    await expect(saveSupplierProfile(CTX, 1, definition())).resolves.toMatchObject({ quoteIntake: { enabled: false, recipientEmail: null } });
  });

  it('🔒 ένα CAS: παλιά αναθεώρηση απορρίπτεται και στις δύο κατευθύνσεις', async () => {
    await saveSupplierProfile(CTX, 0, definition());
    await saveQuoteIntake(CTX, 1, ACCEPTING);
    expect(await code(saveSupplierProfile(CTX, 1, definition()))).not.toBe('ok');
    expect(await code(saveQuoteIntake(CTX, 1, ACCEPTING))).not.toBe('ok');
  });

  it('🔒 ενεργό χωρίς παραλήπτη ή με άκυρο email σταματά πριν από κάθε ανάγνωση', async () => {
    expect(await code(saveQuoteIntake(CTX, 0, { enabled: true, recipientEmail: null }))).toBe('quoteRecipientEmailRequired');
    expect(await code(saveQuoteIntake(CTX, 0, { enabled: true, recipientEmail: 'aries' }))).toBe('emailInvalid');
    expect(fake.getAllDocs('catalog_supplier_profiles')).toEqual({});
  });

  it('🔑 το στιγμιότυπο της δημόσιας προβολής διαβάζει την αποθηκευμένη ρύθμιση (αληθινός γραφέας → αληθινός αναγνώστης)', async () => {
    await saveQuoteIntake(CTX, 0, ACCEPTING);
    await expect(readPublicProfileSnapshot(COMPANY, Date.now())).resolves.toMatchObject({ quoteIntake: ACCEPTING });
  });

  it('πεδίο εκτός ρύθμισης δεν αποθηκεύεται', async () => {
    const stored = await saveQuoteIntake(CTX, 0, { ...ACCEPTING, cc: 'boss@aries.example' } as typeof ACCEPTING);
    expect(JSON.stringify(stored)).not.toContain('boss@');
  });
});

describe('supplierAcceptsQuotesInTx — το «δέχεται;» μέσα στη συναλλαγή του RFQ (ADR-923 §5.13 Τ4)', () => {
  const ACCEPTING = { enabled: true, recipientEmail: 'quotes@aries.example' };
  const accepts = (companyId = COMPANY) => db.runTransaction((tx) => supplierAcceptsQuotesInTx(tx, db, companyId));

  it('ενεργή και έγκυρη ρύθμιση ⇒ ναι · κλειστή ⇒ όχι (ο αληθινός γραφέας, ο αληθινός αναγνώστης)', async () => {
    await saveQuoteIntake(CTX, 0, ACCEPTING);
    await expect(accepts()).resolves.toBe(true);
    await saveQuoteIntake(CTX, 1, { ...ACCEPTING, enabled: false });
    await expect(accepts()).resolves.toBe(false);
  });

  it('🔒 χωρίς προφίλ, με ξένο, διαγραμμένο ή χαλασμένο ⇒ όχι', async () => {
    await expect(accepts()).resolves.toBe(false);
    const id = generateDeterministicCatalogSupplierProfileId(COMPANY);
    fake.seed('catalog_supplier_profiles', id, { id, companyId: 'comp-b', isDeleted: false, quoteIntake: ACCEPTING });
    await expect(accepts()).resolves.toBe(false);
    fake.seed('catalog_supplier_profiles', id, { id, companyId: COMPANY, isDeleted: true, quoteIntake: ACCEPTING });
    await expect(accepts()).resolves.toBe(false);
    fake.seed('catalog_supplier_profiles', id, { id, companyId: COMPANY, isDeleted: false, quoteIntake: { enabled: 'yes' } });
    await expect(accepts()).resolves.toBe(false);
  });
});
