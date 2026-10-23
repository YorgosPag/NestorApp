/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ23–Ζ30 (ροή) — **η απόφαση γραφείου ανά αρχείο**, πάνω στο fake Firestore και σε ψεύτικο κάδο
 *   GCS. Ο πραγματικός γραφέας της απόφασης, η πραγματική συμφιλίωση, ο πραγματικός εκτελεστής, η πραγματική προεπισκόπηση.
 *   Mocks: μόνο οι κάδοι, τα ίχνη και ο εκδότης Πρωτοκόλλου. Όλα τα δεδομένα συνθετικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { handoverCopyFileIdOf, handoverDossierIdOf, propertyHandoverIdOf } from '@/lib/property-handover/property-handover-id';
import { deliverHandoverFiles } from '@/server/property-handover-delivery/handover-delivery.server';
import { decideHandoverFile, type HandoverFileDecisionCommand } from '@/services/property-handover/property-handover-file-decision.service';
import { previewPropertyHandover } from '@/services/property-handover/property-handover-preview.server';
import { recordHandoverFileDelivery } from '@/services/property-handover/property-handover-write.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { fakeGcsBucket, type FakeGcsCopyCall, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/firebaseAdmin', () => {
  const actual = jest.requireActual('firebase-admin/firestore');
  return { FieldValue: { serverTimestamp: () => '2026-10-23T10:00:00.000Z', delete: () => actual.FieldValue.delete() } };
});
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn(async () => undefined) }));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async (input: Record<string, unknown>) => { mockAudits.push(input); return 'audit'; }) }));
jest.mock('@/services/property-handover/property-handover-protocol-write.service', () => ({
  openHandoverProtocolRun: () => ({ issue: async () => undefined, finish: () => 0 }),
}));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => mockBucket(), fileStorageBucket: () => mockBucket() }));

const mockAudits: Array<Record<string, unknown>> = [];
const store: FakeGcsStore = new Map();
let copyHook: (call: FakeGcsCopyCall) => void = () => undefined;
const bucket = fakeGcsBucket(store, 'default', { onCopy: (call) => copyHook(call) });
function mockBucket() { return bucket; }

const COMPANY = 'comp_alfa';
const PROPERTY = 'prop_1';
const BUYER = 'uid_anna';
const OFFICE = 'uid_office';
const HANDOVER = propertyHandoverIdOf(COMPANY, PROPERTY, 'cont_anna');
const AT = '2026-10-20T09:00:00.000Z';
const REASON = 'Ελέγχθηκε από τον νομικό σύμβουλο';

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const file = (id: string) => fake.getData(COLLECTIONS.FILES, id);
const copyOf = (sourceFileId: string) => fake.getData(COLLECTIONS.FILES_PERSONAL, handoverCopyFileIdOf(HANDOVER, sourceFileId));
const handover = () => {
  const found = propertyHandoverFromDocument(fake.getData(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER), HANDOVER);
  if (found === null) throw new Error('no handover');
  return found;
};
const deliverNow = () => deliverHandoverFiles(db(), handover(), { maxFiles: 50, deadlineAt: null, maxHashBytes: 1_000_000 },
  (input) => recordHandoverFileDelivery(db(), input));
const decide = (patch: Partial<HandoverFileDecisionCommand>) => decideHandoverFile(db(), {
  companyId: COMPANY, propertyId: PROPERTY, performedBy: OFFICE, fileId: 'f_doc', choice: 'deliver', expected: null,
  reason: REASON, confirmConfidential: false, ...patch,
});
const previewFile = async (fileId: string) => {
  const preview = await previewPropertyHandover(db(), COMPANY, PROPERTY);
  const all = preview === null ? [] : [...preview.files.deliver, ...preview.files.review, ...preview.files.internal];
  return { preview, row: all.find((row) => row.fileId === fileId) };
};

function companyFile(id: string, category: string, extra: Record<string, unknown> = {}, entity = { type: 'property', id: PROPERTY }) {
  const storagePath = `companies/${COMPANY}/entities/${entity.type}/${entity.id}/files/${id}.pdf`;
  fake.seed(COLLECTIONS.FILES, id, {
    companyId: COMPANY, entityType: entity.type, entityId: entity.id, domain: 'construction', category, status: 'ready',
    storagePath, originalFilename: `${id}.pdf`, displayName: id, contentType: 'application/pdf', ext: 'pdf', updatedAt: AT, revision: 3, ...extra,
  });
  store.set(storagePath, { crc32c: `crc_${id}`, size: 1000, generation: 5, bytes: Buffer.alloc(1000, id) });
}

beforeEach(() => {
  fake = new FakeFirestore();
  store.clear();
  mockAudits.length = 0;
  copyHook = () => undefined;
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', commercialStatus: 'sold',
    commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'final_signed' },
  });
  fake.seed(COLLECTIONS.PROPERTY_DOSSIERS, handoverDossierIdOf(HANDOVER), {
    userId: BUYER, label: 'Διαμέρισμα Α1', type: null, lifecycle: 'active', createdAt: AT, updatedAt: AT,
    origin: { kind: 'handover', handoverId: HANDOVER, issuerCompanyId: COMPANY, issuerName: 'Κατασκευαστική Άλφα', acceptedAt: AT, handoverLifecycle: 'ready' },
  });
  fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, {
    companyId: COMPANY, propertyId: PROPERTY, recipientContactId: 'cont_anna', lifecycle: 'ready',
    completion: { source: 'final-contract', at: AT }, recipient: { userId: BUYER, acceptedAt: AT, dossierId: handoverDossierIdOf(HANDOVER) },
    invitation: null, fileDelivery: null, fileDeliveryState: 'pending', createdAt: AT, updatedAt: AT,
  });
  companyFile('f_plan', 'floorplans');
  companyFile('f_doc', 'documents');
  companyFile('f_conf', 'photos', { classification: 'confidential' });
  companyFile('f_other', 'photos', {}, { type: 'property', id: 'prop_2' });
});

describe('Ζ23 · Ζ30 — «Παραδίδεται» σε αρχείο που περίμενε απόφαση', () => {
  it('γράφεται ΜΟΝΟ το πεδίο · παραδίδεται ΤΩΡΑ · το «θέλουν απόφαση» ξαναμετριέται τώρα · ίχνος με αιτιολογία', async () => {
    expect(await decide({})).toEqual({ kind: 'decided' });
    expect(file('f_doc')).toMatchObject({
      handoverDecision: { disposition: 'deliver', reason: REASON, decidedBy: OFFICE, decidedAt: expect.any(String) },
      updatedAt: AT, revision: 3,
    });
    expect(copyOf('f_doc')).toBeDefined();
    expect(handover().fileDelivery).toMatchObject({ awaitingReview: 1 });
    expect(mockAudits.find((audit) => audit.action === 'handover_decision')).toMatchObject({
      fileId: 'f_doc', performedBy: OFFICE, companyId: COMPANY, metadata: { choice: 'deliver', previous: 'automatic', reason: REASON },
    });
    const { row } = await previewFile('f_doc');
    expect(row).toMatchObject({ basis: 'office-decision', delivered: true, decision: { disposition: 'deliver', reason: REASON } });
    expect(row?.decision).not.toHaveProperty('decidedBy');
  });

  it('Ζ30 — σε ΗΔΗ παραδομένη παράδοση: το «Παραδίδεται» φτάνει ΤΩΡΑ, όχι στο νυχτερινό δίχτυ', async () => {
    await deliverNow();
    expect(handover().fileDelivery).toMatchObject({ state: 'delivered', awaitingReview: 2 });
    expect(copyOf('f_doc')).toBeUndefined();
    expect(await decide({})).toEqual({ kind: 'decided' });
    expect(copyOf('f_doc')).toBeDefined();
    expect(handover().fileDelivery).toMatchObject({ state: 'delivered', awaitingReview: 1 });
  });

  it('ιδεμπότητα — ίδιο αίτημα ξανά (ακόμη και με το ΠΑΛΙΟ `expected`) ⇒ `unchanged`, καμία δεύτερη γραμμή ίχνους', async () => {
    await decide({});
    expect(await decide({})).toEqual({ kind: 'unchanged' });
    expect(mockAudits.filter((audit) => audit.action === 'handover_decision')).toHaveLength(1);
  });
});

describe('Ζ26 — ό,τι παραδόθηκε μένει', () => {
  it('«Μένει εσωτερικό» σε παραδομένο ⇒ `already-delivered`, καμία εγγραφή', async () => {
    await deliverNow();
    expect(copyOf('f_plan')).toBeDefined();
    fake.clearWriteLog();
    expect(await decide({ fileId: 'f_plan', choice: 'internal' })).toEqual({ kind: 'refused', reason: 'already-delivered' });
    expect(fake.writeLog()).toEqual([]);
    expect((await previewFile('f_plan')).row?.offer).toMatchObject({ kind: 'open', choices: ['deliver'] });
  });

  it('🔴 κούρσα — απόφαση «εσωτερικό» ΑΝΑΜΕΣΑ στην ανάγνωση του συνόλου και την εγγραφή καθολικού ⇒ η αντιγραφή αποσύρεται', async () => {
    copyHook = (call) => {
      if (!call.to.includes(handoverCopyFileIdOf(HANDOVER, 'f_plan'))) return;
      const current = file('f_plan') ?? {};
      fake.write(COLLECTIONS.FILES, 'f_plan', {
        ...current, handoverDecision: { disposition: 'internal', reason: REASON, decidedBy: OFFICE, decidedAt: AT },
      });
    };
    const outcome = await deliverNow();
    expect(outcome.failed).toBe(0);
    expect(copyOf('f_plan')).toBeUndefined();
    expect(Object.values(fake.getAllDocs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)).some((row) => row.sourceFileId === 'f_plan')).toBe(false);
    expect([...store.keys()].some((key) => key.includes(handoverCopyFileIdOf(HANDOVER, 'f_plan')))).toBe(false);
  });
});

describe('Ζ25 · Ζ27 · Ζ28 — αρνήσεις της πόρτας', () => {
  it('Ζ25 — εμπιστευτικό ⇒ μόνο με ρητή επιβεβαίωση', async () => {
    expect(await decide({ fileId: 'f_conf' })).toEqual({ kind: 'refused', reason: 'confidential-unconfirmed' });
    expect(file('f_conf')).not.toHaveProperty('handoverDecision');
    expect(await decide({ fileId: 'f_conf', confirmConfidential: true })).toEqual({ kind: 'decided' });
  });

  it('Ζ27 — άλλος αποφάσισε στο μεταξύ ⇒ `stale`', async () => {
    await decide({ choice: 'internal' });
    expect(await decide({ choice: 'deliver', expected: null })).toEqual({ kind: 'refused', reason: 'stale' });
    expect(await decide({ choice: 'automatic', expected: 'internal' })).toEqual({ kind: 'decided' });
    expect(file('f_doc')).not.toHaveProperty('handoverDecision');
  });

  it('Ζ28 — αρχείο άλλου ακινήτου ή ανύπαρκτο ⇒ `file-unknown`, καμία εγγραφή', async () => {
    fake.clearWriteLog();
    expect(await decide({ fileId: 'f_other' })).toEqual({ kind: 'refused', reason: 'file-unknown' });
    expect(await decide({ fileId: 'f_missing' })).toEqual({ kind: 'refused', reason: 'file-unknown' });
    expect(fake.writeLog()).toEqual([]);
  });
});
