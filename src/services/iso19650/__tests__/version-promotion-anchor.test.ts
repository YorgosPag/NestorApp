/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΓΚΥΡΑ Α24** — «Ορισμός ως τρέχουσας» και στοίβα εκδόσεων (ADR-862 Φ0).
 * @related services/iso19650/version-promotion · version-stack · container-transitions
 *
 * Κλειδώνει τις τρεις υποσχέσεις που μας βάζουν **πάνω** από Box/SharePoint:
 *   Α — **νέα έκδοση στην κορυφή**, ποτέ ανάσταση· η παλιά μένει αρχείο.
 *   Β — **προϋπόθεση κεφαλής** (AIP-154): ό,τι άλλαξε ⇒ `head-moved`, τίποτα δεν γράφεται.
 *   Γ — **ατομικότητα**: άρνηση του γραφέα ⇒ ΚΑΝΕΝΑΣ διάδοχος, αντιστάθμιση αντιγράφου.
 *   Δ — **ιδεμποτησία**: επανάληψη ⇒ ίδιος διάδοχος, μία αντιγραφή.
 *
 * ⚠️ Γνήσιοι: γραφέας, κριτής διαδοχής, θεματοφύλακας. Πλαστά: μόνο Storage και ίχνος.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { readContainerState } from '@/lib/files/file-record-read';
import { successionIdentityOf } from '@/lib/files/succession-identity';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

let fake: FakeFirestore;

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: (): AdminFirestore => fake as unknown as AdminFirestore,
}));
jest.mock('@/services/file-audit-admin.service', () => ({
  recordFileAudit: jest.fn(async () => 'audit_test'),
}));
jest.mock('@/services/storage-admin/public-upload.service', () => ({
  copyPublicFile: jest.fn(async (p: { storagePath: string }) => ({
    url: `/api/storage/file/${p.storagePath}`,
    storagePath: p.storagePath,
    bucket: 'b',
    fileId: 'x',
  })),
  discardPublicCopy: jest.fn(async () => undefined),
}));

import { copyPublicFile, discardPublicCopy } from '@/services/storage-admin/public-upload.service';
import { promoteVersion } from '../version-promotion';
import { readVersionStack } from '../version-stack';
import { transitionContainer } from '../container-transitions';

const COMPANY = 'c_alpha';
const AUTHOR = 'u_author';
const author = { uid: AUTHOR, companyId: COMPANY, globalRole: 'company_admin' as const };
/** Χωρίς καμία ικανότητα CDE — ο γραφέας αρνείται. */
const viewer = { uid: 'u_viewer', companyId: COMPANY, globalRole: 'company_viewer' as const };

const SLOT = { entityType: 'floor', entityId: 'floor_1', domain: 'construction', category: 'floorplans', purpose: 'floor-floorplan' };

function seed(id: string, extra: Record<string, unknown>): void {
  fake.seed(COLLECTIONS.FILES, id, {
    id,
    companyId: COMPANY,
    createdBy: AUTHOR,
    status: 'ready',
    lifecycleState: 'active',
    isDeleted: false,
    cdeReadReach: 'tenant',
    displayName: id,
    originalFilename: `${id}.dxf`,
    ext: 'dxf',
    contentType: 'application/dxf',
    storagePath: `companies/${COMPANY}/files/${id}.dxf`,
    sizeBytes: 100,
    ...SLOT,
    ...extra,
  });
}

/** v1 (αρχειοθετημένη, αντικαταστάθηκε από v2) → v2 (κεφαλή). */
function seedChain(): void {
  seed('file_v1', {
    createdAt: '2026-09-01T10:00:00.000Z',
    lifecycleState: 'archived',
    cdeState: 'SUPERSEDED',
    supersededByFileId: 'file_v2',
    processedData: { fileType: 'dxf', processedDataPath: 'scene_v1.json', processedAt: 1 },
  });
  seed('file_v2', { createdAt: '2026-09-10T10:00:00.000Z' });
}

const doc = (id: string): Record<string, unknown> | undefined =>
  fake.all<Record<string, unknown>>(COLLECTIONS.FILES).find(row => row.id === id);

beforeEach(() => {
  fake = new FakeFirestore();
  jest.clearAllMocks();
});

describe('Α24.Α — νέα έκδοση στην κορυφή, ποτέ ανάσταση', () => {
  it('η v1 γίνεται ΝΕΟΣ διάδοχος· η v2 αρχειοθετείται· η v1 μένει αρχείο', async () => {
    seedChain();
    const outcome = await promoteVersion({ actor: author, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v2' });

    expect(outcome.kind).toBe('promoted');
    const successorId = outcome.kind === 'promoted' ? outcome.successorId : '';
    const successor = doc(successorId) ?? {};

    expect(successor).toMatchObject({ status: 'ready', promotedFromFileId: 'file_v1', cdeReadReach: 'tenant' });
    expect(successor.processedData).toMatchObject({ processedDataPath: 'scene_v1.json' });
    expect(successionIdentityOf(successor)).toBe(successionIdentityOf(doc('file_v2') ?? {}));
    expect(readContainerState(successor)).toEqual({ phase: 'pre-cde' });

    expect(doc('file_v2')).toMatchObject({ lifecycleState: 'archived', supersededByFileId: successorId });
    expect(doc('file_v1')).toMatchObject({ lifecycleState: 'archived', supersededByFileId: 'file_v2' });
  });

  it('η στοίβα: κεφαλή ο διάδοχος, και οι τρεις εκδόσεις, από οποιοδήποτε μέλος', async () => {
    seedChain();
    const outcome = await promoteVersion({ actor: author, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v2' });
    const successorId = outcome.kind === 'promoted' ? outcome.successorId : '';

    // Από την ΠΑΛΑΙΟΤΕΡΗ (δρόμος προς τα εμπρός) ΚΑΙ από την ΚΕΦΑΛΗ (δρόμος προς τα πίσω) — η
    // οθόνη ανοίγει σχεδόν πάντα την τρέχουσα, άρα ο δεύτερος δρόμος ΔΕΝ είναι προαιρετικός.
    for (const from of ['file_v1', successorId]) {
      const stack = await readVersionStack(COMPANY, from);
      expect(stack).toMatchObject({ kind: 'stack', headFileId: successorId });
      expect(stack.kind === 'stack' ? stack.versions.map(v => v.id) : []).toEqual([successorId, 'file_v2', 'file_v1']);
    }
  });

  it('ξένος μισθωτής ⇒ not-found, κανένα μαντείο ύπαρξης', async () => {
    seedChain();
    const stranger = { ...author, companyId: 'c_other' };
    expect(await promoteVersion({ actor: stranger, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v2' }))
      .toEqual({ kind: 'refused', why: 'not-found' });
  });
});

describe('Α24.Β — προϋπόθεση κεφαλής', () => {
  it('κεφαλή άλλη από αυτή που είδε ο αιτών ⇒ head-moved, ΚΑΜΙΑ αντιγραφή', async () => {
    seedChain();
    expect(await promoteVersion({ actor: author, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v1' }))
      .toEqual({ kind: 'refused', why: 'head-moved' });
    expect(copyPublicFile).not.toHaveBeenCalled();
  });

  it('η πηγή είναι ήδη η κεφαλή ⇒ noop', async () => {
    seedChain();
    expect(await promoteVersion({ actor: author, sourceFileId: 'file_v2', expectedHeadFileId: 'file_v2' }))
      .toEqual({ kind: 'noop', why: 'already-current' });
  });
});

describe('Α24.Γ — ατομικότητα', () => {
  it('ο γραφέας αρνείται ⇒ ΚΑΝΕΝΑΣ διάδοχος, η κεφαλή ενεργή, αντιστάθμιση αντιγράφου', async () => {
    seedChain();
    const before = fake.all(COLLECTIONS.FILES).length;
    const outcome = await promoteVersion({ actor: viewer, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v2' });

    expect(outcome).toEqual({ kind: 'refused', why: 'not-capable' });
    expect(fake.all(COLLECTIONS.FILES)).toHaveLength(before);
    expect(doc('file_v2')).toMatchObject({ lifecycleState: 'active' });
    expect(discardPublicCopy).toHaveBeenCalledTimes(1);
  });

  it('κεφαλή που αρχειοθετήθηκε ανάμεσα ⇒ predecessor-not-active, ΚΑΜΙΑ γέννηση', async () => {
    seedChain();
    seed('file_v3', { createdAt: '2026-09-12T10:00:00.000Z', lifecycleState: 'archived', supersededByFileId: 'file_vx' });
    const outcome = await transitionContainer({
      fileId: 'file_v3',
      act: 'supersede',
      actor: author,
      supersededByFileId: 'file_born',
      successorBirth: { ...doc('file_v2'), id: 'file_born', createdAt: '2026-09-17T10:00:00.000Z' },
    });

    expect(outcome.kind).not.toBe('transitioned');
    expect(doc('file_born')).toBeUndefined();
  });
});

describe('Α24.Δ — ιδεμποτησία', () => {
  it('επανάληψη της ίδιας αίτησης ⇒ ίδιος διάδοχος, μία αντιγραφή', async () => {
    seedChain();
    const first = await promoteVersion({ actor: author, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v2' });
    const again = await promoteVersion({ actor: author, sourceFileId: 'file_v1', expectedHeadFileId: 'file_v2' });

    expect(again).toEqual(first);
    expect(copyPublicFile).toHaveBeenCalledTimes(1);
  });
});
