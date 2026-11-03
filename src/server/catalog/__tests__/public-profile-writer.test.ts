/**
 * Ο γραφέας του δημόσιου προφίλ (ADR-923 §22 Υ8), πάνω στο ψεύτικο Firestore: ίδιος δρόμος CAS με το μοντέλο.
 */

import type { Firestore } from 'firebase-admin/firestore';

import { generateDeterministicCatalogSupplierProfileId } from '@/services/enterprise-id.service';
import type { PublicCatalogMedia } from '@/subapps/catalog/public/public-catalog-schema';
import type { SupplierStandingRead } from '@/subapps/catalog/public/public-publication-condition';
import { PUBLIC_PROFILE_SCOPE, publicScopeKey } from '@/subapps/catalog/public/public-scopes-of-write';
import { PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION } from '@/subapps/catalog/public/public-supplier-profile';
import { QUOTE_INTAKE_OFF } from '@/subapps/catalog/types/supplier-profile';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { PublicAssetFacts, PublicProfileSnapshot } from '../public/public-model-snapshot.server';
import { PUBLIC_CATALOG_SCOPE, publicOutboxRef } from '../public/public-outbox.server';
import { drainPublicProfile, type PublicProfileDrainDeps } from '../public/public-profile-writer.server';

const COMPANY = 'comp-a';
const AT = 1_800_000_000_000;
const OPEN: SupplierStandingRead = { kind: 'known', standing: { kind: 'verified', basis: 'manual-review' } };
const CLOSED: SupplierStandingRead = { kind: 'known', standing: { kind: 'unverified' } };
const ASSET: PublicAssetFacts = { assetId: 'cast_1', labels: { el: 'Φωτό' }, storagePath: 'c/1.jpg' };
const PROJECT = { id: 'cprjt_1', title: { el: 'Κατοικία' }, description: {}, year: 2024, assetIds: ['cast_1', 'cast_gone'] };
const SNAPSHOT: PublicProfileSnapshot = { definition: { description: { el: 'Περιγραφή' }, projects: [PROJECT] }, quoteIntake: QUOTE_INTAKE_OFF, assets: new Map([['cast_1', ASSET]]) };
const ACCEPTING = { enabled: true, recipientEmail: 'quotes@aries.example' };

let fake: FakeFirestore;
let db: Firestore;

const publicDoc = () => fake.getAllDocs('public_supplier_profiles')[COMPANY];
const outbox = () => publicOutboxRef(db, COMPANY, PUBLIC_PROFILE_SCOPE);

function depsWith(overrides: Partial<PublicProfileDrainDeps> = {}) {
  const reconcileMedia = jest.fn(async (_id: string, assets: readonly PublicAssetFacts[]) =>
    new Map<string, PublicCatalogMedia>(assets.map((asset) => [asset.assetId, { assetId: asset.assetId, url: `https://cdn/${asset.assetId}`, labels: asset.labels }])));
  const revalidate = jest.fn();
  return { readStanding: async () => OPEN, readSnapshot: async () => SNAPSHOT, reconcileMedia, revalidate, ...overrides } as PublicProfileDrainDeps & { readonly reconcileMedia: jest.Mock; readonly revalidate: jest.Mock };
}

beforeEach(async () => {
  fake = new FakeFirestore();
  db = fake as unknown as Firestore;
  await outbox().set({ companyId: COMPANY, scope: publicScopeKey(PUBLIC_PROFILE_SCOPE), revision: 1, drainedRevision: 0, dirty: true });
});

describe('drainPublicProfile', () => {
  it('ανοιχτή συνθήκη: έγγραφο με URL του ραφιού, άδειο outbox, ακύρωση μνήμης', async () => {
    const deps = depsWith();
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('published');
    expect(publicDoc()).toMatchObject({
      schemaVersion: PUBLIC_SUPPLIER_PROFILE_SCHEMA_VERSION,
      companyId: COMPANY,
      projects: [{ projectId: 'cprjt_1', year: 2024, images: [{ assetId: 'cast_1', url: 'https://cdn/cast_1' }] }],
    });
    expect((await outbox().get()).data()).toMatchObject({ drainedRevision: 1, dirty: false });
    expect(deps.revalidate).toHaveBeenCalledWith(COMPANY);
  });

  it('🔒 υποκείμενο του ραφιού το id του προφίλ, όχι ο `companyId`', async () => {
    const deps = depsWith();
    await drainPublicProfile(db, COMPANY, AT, deps);
    const [subject] = deps.reconcileMedia.mock.calls[0] as [string];
    expect(subject).toBe(generateDeterministicCatalogSupplierProfileId(COMPANY));
    expect(subject).not.toContain(COMPANY);
  });

  it('κλειστή συνθήκη: σβήνει έγγραφο, αδειάζει ράφι, δεν διαβάζει τον κατάλογο', async () => {
    await drainPublicProfile(db, COMPANY, AT, depsWith());
    await outbox().set({ revision: 2 }, { merge: true });
    const readSnapshot = jest.fn();
    const deps = depsWith({ readStanding: async () => CLOSED, readSnapshot });
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('withdrawn');
    expect(publicDoc()).toBeUndefined();
    expect(readSnapshot).not.toHaveBeenCalled();
    expect(deps.reconcileMedia).toHaveBeenCalledWith(expect.any(String), []);
  });

  it('🔒 άγνωστη συνθήκη: τίποτα δεν αλλάζει και το outbox μένει βρώμικο', async () => {
    const deps = depsWith({ readStanding: async () => ({ kind: 'unknown' }) });
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('deferred');
    expect((await outbox().get()).data()).toMatchObject({ dirty: true });
  });

  it('χωρίς προφίλ ⇒ απόσυρση · δεύτερη κλήση ⇒ `clean`', async () => {
    const deps = depsWith({ readSnapshot: async () => null });
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('unchanged');
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('clean');
  });

  it('όλα τα μέσα έπεσαν και δεν υπάρχει περιγραφή ⇒ καμία κενή κάρτα, κανένα έγγραφο', async () => {
    const definition = { description: {}, projects: [PROJECT] };
    await expect(drainPublicProfile(db, COMPANY, AT, depsWith({ readSnapshot: async () => ({ definition, quoteIntake: QUOTE_INTAKE_OFF, assets: new Map() }) }))).resolves.toBe('unchanged');
    expect(publicDoc()).toBeUndefined();
  });

  it('🔒 Ε6β: κενό προφίλ που δέχεται αιτήματα δημοσιεύεται με το «δέχεται» και **χωρίς** το email', async () => {
    const definition = { description: {}, projects: [] };
    await expect(drainPublicProfile(db, COMPANY, AT, depsWith({ readSnapshot: async () => ({ definition, quoteIntake: ACCEPTING, assets: new Map() }) }))).resolves.toBe('published');
    expect(publicDoc()).toMatchObject({ acceptsQuoteRequests: true, projects: [] });
    expect(JSON.stringify(publicDoc())).not.toContain(ACCEPTING.recipientEmail);
  });

  it('🔑 Ε6β: η απενεργοποίηση φτάνει τη βιτρίνα ως `false`, με ακύρωση μνήμης', async () => {
    await drainPublicProfile(db, COMPANY, AT, depsWith({ readSnapshot: async () => ({ ...SNAPSHOT, quoteIntake: ACCEPTING }) }));
    expect(publicDoc()).toMatchObject({ acceptsQuoteRequests: true });
    await outbox().set({ revision: 2 }, { merge: true });
    const deps = depsWith();
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('published');
    expect(publicDoc()).toMatchObject({ acceptsQuoteRequests: false });
    expect(deps.revalidate).toHaveBeenCalledWith(COMPANY);
  });

  it('🔑 δημοσιευμένο προφίλ που έχασε όλα τα μέσα: αποσύρεται με ακύρωση μνήμης και άδειο ράφι', async () => {
    await drainPublicProfile(db, COMPANY, AT, depsWith());
    await outbox().set({ revision: 2 }, { merge: true });
    const definition = { description: {}, projects: [PROJECT] };
    const deps = depsWith({ readSnapshot: async () => ({ definition, quoteIntake: QUOTE_INTAKE_OFF, assets: new Map() }) });
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('withdrawn');
    expect(publicDoc()).toBeUndefined();
    expect(deps.revalidate).toHaveBeenCalledWith(COMPANY);
    expect(deps.reconcileMedia).toHaveBeenCalledWith(expect.any(String), []);
  });

  it('🔑 φράχτης: ανάκληση στο ενδιάμεσο ⇒ `raced`, καμία εγγραφή', async () => {
    const deps = depsWith({
      reconcileMedia: async (_id, assets) => {
        await publicOutboxRef(db, COMPANY, PUBLIC_CATALOG_SCOPE).set({ revision: 7 }, { merge: true });
        return new Map(assets.map((asset) => [asset.assetId, { assetId: asset.assetId, url: 'u', labels: {} }]));
      },
    });
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('raced');
    expect(publicDoc()).toBeUndefined();
  });

  it('ίδιο έγγραφο ⇒ `unchanged`, χωρίς νέα ακύρωση μνήμης', async () => {
    await drainPublicProfile(db, COMPANY, AT, depsWith());
    await outbox().set({ revision: 2 }, { merge: true });
    const deps = depsWith();
    await expect(drainPublicProfile(db, COMPANY, AT, deps)).resolves.toBe('unchanged');
    expect(deps.revalidate).not.toHaveBeenCalled();
  });
});
