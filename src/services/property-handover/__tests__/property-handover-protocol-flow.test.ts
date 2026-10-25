/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ35–Γ36 (Φ-Γ2 Σ4) — **ο ένας γραφέας του Πρωτοκόλλου**, από άκρη σε άκρη: κρίση → στοιχεία →
 *   σφράγιση (συνθετικός πάροχος ADR-918, σε επίπεδο HTTP) → bytes (ψεύτικο GCS) → μία συναλλαγή (ψεύτικο Firestore) → ίχνη.
 *   Mocks: μόνο κάδοι, ίχνη, ονόματα εταιρείας/χώρου και το θέμα της πώλησης. Όλα τα δεδομένα συνθετικά.
 */

import { createHash } from 'crypto';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { handoverDeliveryDigest, type HandoverDeliveredRow } from '@/lib/property-handover/handover-delivery-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import {
  handoverCopyFileIdOf,
  handoverDeliveryIdOf,
  handoverDossierIdOf,
  handoverProtocolFileIdOf,
  handoverProtocolIdOf,
  propertyHandoverIdOf,
} from '@/lib/property-handover/property-handover-id';
import { openSealSession } from '@/server/pdf-seal/seal-pdf.server';
import { verifyPdfSeal } from '@/server/pdf-seal/verify-pdf-seal';
import { makeSigner, syntheticProvider, type SyntheticSigner } from '@/server/pdf-seal/__tests__/synthetic-seal-provider';
import { readHandoverProtocolManifest } from '@/services/pdf/renderers/handover-protocol/handover-protocol-manifest';
import { buildStoragePath } from '@/services/upload/utils/storage-path';
import { loadHandoverSet } from '@/services/property-handover/property-handover-set.server';
import { issueHandoverProtocol } from '@/services/property-handover/property-handover-protocol-write.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { fileTrashBlockOf } from '@/lib/files/file-hold';
import { isFileHeld } from '@/services/file-record/file-purge-helpers';
import { fakeGcsBucket, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/firebaseAdmin', () => ({ FieldValue: { serverTimestamp: () => '2026-10-22T10:00:00.000Z' } }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn(async (input: Record<string, unknown>) => { mockEntityAudits.push(input); }) }));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async (input: Record<string, unknown>) => { mockFileAudits.push(input); return 'audit'; }) }));
jest.mock('@/server/files/file-record-bucket', () => ({ fileRecordBucket: () => mockBucket(), fileStorageBucket: () => mockBucket() }));
jest.mock('@/services/company/company-legal-identity', () => ({ readCompanyLegalIdentity: async () => ({ businessName: 'Κατασκευαστική Άλφα Α.Ε.' }) }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: async () => 'Άλφα' }));
jest.mock('@/services/conveyance/conveyance-subject.server', () => ({
  loadConveyanceSubject: async (_db: unknown, companyId: string, propertyId: string) =>
    companyId === 'comp_alfa' ? { propertyName: 'Διαμέρισμα Α1', subject: { propertyId, appurtenances: [] } } : null,
}));

const mockFileAudits: Array<Record<string, unknown>> = [];
const mockEntityAudits: Array<Record<string, unknown>> = [];
const store: FakeGcsStore = new Map();
let copyHook: () => void = () => undefined;
/** Ζ58 — η GCS δεν τεκμηριώνει αν το `save` πάνω σε δεσμευμένο κλειδί απαντά 403 ή 412: η σουίτα δοκιμάζει ΚΑΙ τα δύο. */
const bucketOptions: { heldSaveCode: 403 | 412; onCopy: () => void } = { heldSaveCode: 403, onCopy: () => copyHook() };
const bucket = fakeGcsBucket(store, 'default', bucketOptions);
function mockBucket() { return bucket; }

const NOW = new Date('2026-10-22T10:00:00.000Z');
const DAY = 86_400_000;
const COMPANY = 'comp_alfa';
const PROPERTY = 'prop_1';
const BUYER = 'uid_anna';
const CONTACT = 'cont_anna';
const HANDOVER = propertyHandoverIdOf(COMPANY, PROPERTY, CONTACT);
const MAIN_DOSSIER = handoverDossierIdOf(HANDOVER);
const AT = '2026-10-21T09:00:00.000Z';
/** Στοιχεία επαφής που **υπάρχουν** — και δεν πρέπει να φανούν πουθενά (ρήτρα `personalData`). */
const BUYER_EMAIL = 'anna.private@example.test';
const BUYER_PHONE = '6944123456';
const BUYER_VAT = '123456789';

let fake: FakeFirestore;
let seal: SyntheticSigner;
let tsa: SyntheticSigner;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const docs = (collection: string) => fake.getAllDocs(collection);
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const handover = () => {
  const found = propertyHandoverFromDocument(docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER], HANDOVER);
  if (found === null) throw new Error('no handover');
  return found;
};
const configured = () => {
  const provider = syntheticProvider(seal, tsa, { tsa: { genTime: NOW } });
  return openSealSession(provider.env, provider.transport);
};
const issue = (session = configured()) => issueHandoverProtocol(db(), handover(), session);

const ledgerRow = (sourceFileId: string): HandoverDeliveredRow & { readonly sha256: string } =>
  ({ sourceFileId, copyFileId: handoverCopyFileIdOf(HANDOVER, sourceFileId), crc32c: `crc_${sourceFileId}`, size: 1000, sha256: sha(sourceFileId) });

/** Ένα παραδομένο αρχείο: γραμμή καθολικού με sha256 + το αντίγραφο του αγοραστή. */
function seedDelivered(sourceFileId: string): void {
  const row = ledgerRow(sourceFileId);
  fake.seed(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES, handoverDeliveryIdOf(HANDOVER, sourceFileId), {
    ...row, companyId: COMPANY, propertyId: PROPERTY, handoverId: HANDOVER, recipientUserId: BUYER, dossierId: MAIN_DOSSIER,
    sourceGeneration: '5', revisionOfFileId: null, deliveredAt: AT, sha256Of: 'copy', hashedAt: AT,
  });
  fake.seed(COLLECTIONS.FILES_PERSONAL, row.copyFileId, { userId: BUYER, displayName: `Έγγραφο ${sourceFileId}.pdf`, status: 'ready' });
}

/** Η παράδοση σε κατάσταση `delivered`, με αποτύπωμα πάνω σε **όσες** γραμμές υπάρχουν. */
async function seedHandover(sources: readonly string[], patch: Record<string, unknown> = {}): Promise<void> {
  sources.forEach(seedDelivered);
  const digest = await handoverDeliveryDigest(sources.map(ledgerRow));
  const previous = docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER];
  fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, {
    companyId: COMPANY, propertyId: PROPERTY, recipientContactId: CONTACT, lifecycle: 'ready',
    completion: { source: 'final-contract', at: '2026-10-20T09:00:00.000Z' },
    recipient: { userId: BUYER, acceptedAt: AT, dossierId: MAIN_DOSSIER }, invitation: null,
    fileDelivery: {
      state: 'delivered', delivered: sources.length, total: sources.length, awaitingReview: 0, bytes: 1000 * sources.length,
      digest, startedAt: AT, completedAt: AT, lastError: null, unverifiable: 0,
    },
    protocol: previous?.protocol ?? null, fileDeliveryState: 'delivered', createdAt: AT, updatedAt: AT, ...patch,
  });
}

beforeAll(async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://nestorconstruct.gr';
  seal = await makeSigner('VATEL-999999999', new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY));
  tsa = await makeSigner('SYNTHETIC-TSA', new Date(NOW.getTime() - 30 * DAY), new Date(NOW.getTime() + 365 * DAY), 'SYNTHETIC TSA');
}, 30_000);

beforeEach(async () => {
  fake = new FakeFirestore();
  store.clear();
  copyHook = () => undefined;
  bucketOptions.heldSaveCode = 403;
  mockFileAudits.length = 0;
  mockEntityAudits.length = 0;
  fake.seed(COLLECTIONS.CONTACTS, CONTACT, {
    companyId: COMPANY, type: 'individual', firstName: 'Άννα', lastName: 'Παπαδοπούλου',
    emails: [{ email: BUYER_EMAIL, isPrimary: true }], phones: [{ number: BUYER_PHONE }], vatNumber: BUYER_VAT,
  });
  fake.seed(COLLECTIONS.PROPERTY_DOSSIERS, MAIN_DOSSIER, {
    userId: BUYER, label: 'Α1', type: 'apartment', lifecycle: 'active', createdAt: AT, updatedAt: AT,
    origin: { kind: 'handover', handoverId: HANDOVER, issuerCompanyId: COMPANY, issuerName: 'Άλφα', acceptedAt: AT, handoverLifecycle: 'ready', fileDelivery: null, appurtenanceOf: null },
  });
  await seedHandover(['file_a', 'file_b']);
});

const companyRecord = (protocolId: string) => docs(COLLECTIONS.FILES)[handoverProtocolFileIdOf(protocolId, 'company')];
const recipientRecord = (protocolId: string) => docs(COLLECTIONS.FILES_PERSONAL)[handoverProtocolFileIdOf(protocolId, 'recipient')];
const bytesAt = (path: unknown): Uint8Array => {
  const bytes = store.get(String(path))?.bytes;
  if (bytes === undefined) throw new Error(`no bytes at ${String(path)}`);
  return bytes;
};

describe('Γ35 — `delivered` ⇒ ΕΝΑ σφραγισμένο Πρωτόκολλο, ΔΥΟ αντίτυπα, μία συναλλαγή', () => {
  it('έκδοση: έγγραφο `phpr` · αρχείο εταιρείας (ΕΕ, σημάδι) · αρχείο αγοραστή (προέλευση) · δείκτης · προβολή · ίχνη', async () => {
    const outcome = await issue();
    const protocolId = handoverProtocolIdOf(HANDOVER, handover().fileDelivery?.digest ?? '');
    expect(outcome).toEqual({ kind: 'issued', protocolId, revision: 1 });

    const protocol = docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)[protocolId];
    expect(protocol).toMatchObject({ handoverId: HANDOVER, revision: 1, supersedesProtocolId: null, rows: 2, bytes: 2000, legalText: { version: 1 } });
    expect(companyRecord(protocolId)).toMatchObject({ companyId: COMPANY, status: 'ready', storagePlacement: 'eu-originals', handoverProtocolOf: { protocolId, revision: 1 } });
    expect(recipientRecord(protocolId)).toMatchObject({
      userId: BUYER, status: 'ready', handoverOrigin: { sourceFileId: handoverProtocolFileIdOf(protocolId, 'company'), revisionOfFileId: null },
    });
    expect(handover().protocol).toMatchObject({ protocolId, revision: 1, recipientFileId: handoverProtocolFileIdOf(protocolId, 'recipient') });
    expect(docs(COLLECTIONS.PROPERTY_DOSSIERS)[MAIN_DOSSIER]).toMatchObject({ origin: { protocol: { revision: 1, fileId: handoverProtocolFileIdOf(protocolId, 'recipient') } } });
    expect(mockFileAudits.map((a) => a.action).sort()).toEqual(['handover_protocol_issue', 'handover_receive']);
    expect(mockEntityAudits).toHaveLength(1);
  }, 60_000);

  it('τα δύο αντίτυπα είναι ΤΑ ΙΔΙΑ bytes, γνήσια σφραγισμένα, με sha256 = του εγγράφου `phpr`', async () => {
    await issue();
    const { protocol } = handover();
    const company = bytesAt(companyRecord(protocol?.protocolId ?? '')?.storagePath);
    const recipient = bytesAt(recipientRecord(protocol?.protocolId ?? '')?.storagePath);
    expect(Buffer.compare(Buffer.from(company), Buffer.from(recipient))).toBe(0);
    await expect(verifyPdfSeal(company)).resolves.toMatchObject({ kind: 'valid', timestamped: true });
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)[protocol?.protocolId ?? '']?.pdfSha256).toBe(createHash('sha256').update(company).digest('hex'));
  }, 60_000);

  it('🔒 GDPR: το manifest (και ό,τι τυπώνεται) ΔΕΝ περιέχει email · τηλέφωνο · ΑΦΜ του αγοραστή — που η επαφή ΕΧΕΙ', async () => {
    await issue();
    const manifest = (await readHandoverProtocolManifest(bytesAt(companyRecord(handover().protocol?.protocolId ?? '')?.storagePath))) ?? '';
    expect(manifest).toContain('Άννα Παπαδοπούλου');
    for (const secret of [BUYER_EMAIL, BUYER_PHONE, BUYER_VAT, '@']) expect(manifest).not.toContain(secret);
  }, 60_000);

  it('ιδεμπότητα: δεύτερη εκτέλεση ⇒ `current` — κανένα νέο αντικείμενο, εγγραφή ή ίχνος', async () => {
    await issue();
    const objects = store.size;
    const audits = mockFileAudits.length;
    expect((await issue()).kind).toBe('current');
    expect(store.size).toBe(objects);
    expect(mockFileAudits).toHaveLength(audits);
  }, 60_000);

  it('συμπλήρωση (Δ5) ⇒ αναθεώρηση 2 που αντικαθιστά την 1 · `revisionOfFileId` · η 1 ΜΕΝΕΙ', async () => {
    await issue();
    const first = handover().protocol;
    await seedHandover(['file_a', 'file_b', 'file_c']);
    expect(await issue()).toMatchObject({ kind: 'issued', revision: 2 });
    const second = handover().protocol;
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)[second?.protocolId ?? '']).toMatchObject({ supersedesProtocolId: first?.protocolId, rows: 3 });
    expect(recipientRecord(second?.protocolId ?? '')?.handoverOrigin).toMatchObject({ revisionOfFileId: first?.recipientFileId });
    expect(recipientRecord(first?.protocolId ?? '')).toBeDefined();
  }, 60_000);

  it('🔴 ο βρόχος κλείνει: το PDF της εταιρείας ΔΕΝ μπαίνει στο σύνολο παράδοσης (internal), άρα ούτε στο καθολικό', async () => {
    await issue();
    const set = await loadHandoverSet(db(), COMPANY, PROPERTY);
    const companyFileId = handover().protocol?.companyFileId;
    expect(set?.deliver.map((f) => f.doc.id)).not.toContain(companyFileId);
    expect(set?.internal.map((f) => f.doc.id)).toContain(companyFileId);
  }, 60_000);
});

describe('Γ36 — ό,τι ΔΕΝ εκδίδει Πρωτόκολλο, και γιατί', () => {
  const nothingWritten = () => {
    expect(store.size).toBe(0);
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)).toEqual({});
    expect(handover().protocol).toBeNull();
  };

  it.each<[string, Record<string, unknown>]>([
    ['ακυρωμένη πώληση', { lifecycle: 'cancelled' }],
    ['αντιγραφή σε εξέλιξη', { fileDelivery: { state: 'delivering', delivered: 1, total: 2, awaitingReview: 0, bytes: 1000, digest: null, startedAt: AT, completedAt: null, lastError: null, unverifiable: 0 } }],
  ])('%s ⇒ not-due, τίποτα', async (_, patch) => {
    await seedHandover(['file_a', 'file_b'], patch);
    expect((await issue()).kind).toBe('not-due');
    nothingWritten();
  });

  it('🔴 Ο13 — γραμμή χωρίς αποδείξιμα bytes ⇒ `unverifiable-rows`, τίποτα', async () => {
    await seedHandover(['file_a'], { fileDelivery: { state: 'delivering', delivered: 2, total: 2, awaitingReview: 0, bytes: 2000, digest: null, startedAt: AT, completedAt: null, lastError: 'x', unverifiable: 1 } });
    expect(await issue()).toEqual({ kind: 'not-due', reason: 'unverifiable-rows', unverifiable: 1 });
    nothingWritten();
  });

  it('🔴 Ζ104 (Φ-Δ.7γ) — κλεισμένη γραμμή με κείμενο σε ισχύ το v1 ⇒ `legal-text-lacks-closures`: ποτέ Πρωτόκολλο που σιωπά γι\' αυτήν', async () => {
    const closed = { sourceFileId: 'file_c', copyFileId: handoverCopyFileIdOf(HANDOVER, 'file_c'), crc32c: 'crc_file_c', size: 1000, cause: 'bytes-gone' as const };
    fake.seed(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES, handoverDeliveryIdOf(HANDOVER, 'file_c'), {
      ...closed, sha256: null, companyId: COMPANY, propertyId: PROPERTY, handoverId: HANDOVER, recipientUserId: BUYER, dossierId: MAIN_DOSSIER,
      sourceGeneration: '5', revisionOfFileId: null, deliveredAt: AT, sha256Of: null, hashedAt: null,
      closure: { cause: 'bytes-gone', reason: 'χάθηκαν και οι δύο πλευρές', closedBy: 'uid_office', closedAt: AT },
    });
    const digest = await handoverDeliveryDigest(['file_a', 'file_b'].map(ledgerRow), [closed]);
    await seedHandover(['file_a', 'file_b'], { fileDelivery: { ...handover().fileDelivery, digest } });
    expect(await issue()).toMatchObject({ kind: 'refused', reason: 'legal-text-lacks-closures' });
    nothingWritten();
  });

  it('🔴 χωρίς ρύθμιση παρόχου ⇒ `awaiting-seal-configuration`: τίποτα στο GCS ή στη βάση, ένα σήμα', async () => {
    const session = openSealSession({}, { fetchImpl: jest.fn(), env: {}, now: () => NOW });
    expect(await issue(session)).toEqual({ kind: 'awaiting-seal-configuration' });
    nothingWritten();
    expect(session.finish()).toBe(1);
  });

  it('🔴 412 με ΞΕΝΟ αντικείμενο στο κλειδί ⇒ άρνηση, ΠΟΤΕ επανεγγραφή', async () => {
    const protocolId = handoverProtocolIdOf(HANDOVER, handover().fileDelivery?.digest ?? '');
    const { path } = buildStoragePath({
      companyId: COMPANY, entityType: 'property', entityId: PROPERTY, domain: 'legal', category: 'contracts',
      fileId: handoverProtocolFileIdOf(protocolId, 'company'), ext: 'pdf',
    });
    const foreign = new Uint8Array([1, 2, 3]);
    await bucket.file(path).save(foreign);
    expect(await issue()).toMatchObject({ kind: 'failed', reason: 'foreign-object' });
    expect(Buffer.compare(Buffer.from(bytesAt(path)), Buffer.from(foreign))).toBe(0);
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)).toEqual({});
  }, 60_000);

  it('🔴 CAS: η πώληση ακυρώθηκε ανάμεσα σε σφράγιση και συναλλαγή ⇒ `superseded`, καμία εγγραφή — και μετά ΥΙΟΘΕΤΟΥΝΤΑΙ τα ίδια bytes', async () => {
    const ready = docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER];
    copyHook = () => {
      fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, { ...ready, lifecycle: 'cancelled' });
      copyHook = () => undefined;
    };
    const stale = handover();
    expect((await issueHandoverProtocol(db(), stale, configured())).kind).toBe('superseded');
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)).toEqual({});
    const orphaned = new Map(store);
    expect(orphaned.size).toBe(2);
    fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, ready);
    expect(await issueHandoverProtocol(db(), stale, configured())).toMatchObject({ kind: 'issued', revision: 1 });
    expect([...store.keys()].sort()).toEqual([...orphaned.keys()].sort());
    const companyPath = String(companyRecord(handover().protocol?.protocolId ?? '')?.storagePath);
    expect(Buffer.compare(Buffer.from(bytesAt(companyPath)), Buffer.from(orphaned.get(companyPath)?.bytes ?? []))).toBe(0);
  }, 60_000);
});

describe('Ζ57–Ζ59 — το αντίτυπο της ΕΤΑΙΡΕΙΑΣ γεννιέται RECORD (ADR-916 Φ-Δ.6 · Ο14)', () => {
  const issuedPaths = () => {
    const protocolId = handover().protocol?.protocolId ?? '';
    return { company: String(companyRecord(protocolId)?.storagePath), recipient: String(recipientRecord(protocolId)?.storagePath), protocolId };
  };

  it('Ζ57 — βάση ΚΑΙ bytes: `hold: record` από τον σύστημα-γραφέα · GCS `temporaryHold` · ο αγοραστής ΟΧΙ', async () => {
    await issue();
    const { company, recipient, protocolId } = issuedPaths();
    expect(companyRecord(protocolId)).toMatchObject({
      hold: 'record', holdPlacedBy: 'system:property-handover-protocol', holdReason: 'handover-protocol',
      holdPlacedAt: docs(COLLECTIONS.PROPERTY_HANDOVER_PROTOCOLS)[protocolId]?.issuedAt,
    });
    expect(store.get(company)?.temporaryHold).toBe(true);
    expect(recipientRecord(protocolId)?.hold).toBeUndefined();
    expect(store.get(recipient)?.temporaryHold).toBeUndefined();
    // Κάθε πόρτα οριστικής διαγραφής ρωτά τον ΕΝΑ κριτή — και ο κάδος τον δικό του.
    expect(isFileHeld(companyRecord(protocolId) ?? {})).toBe(true);
    expect(fileTrashBlockOf(companyRecord(protocolId) ?? {})).toBe('record');
    expect(fileTrashBlockOf(recipientRecord(protocolId) ?? {})).toBeNull();
    expect(isFileHeld(recipientRecord(protocolId) ?? {})).toBe(false);
  }, 60_000);

  it('Ζ57 — η πλατφόρμα αρνείται: ούτε `delete` ούτε σάρωση προθέματος σβήνει τα bytes του record', async () => {
    await issue();
    const { company } = issuedPaths();
    await expect(bucket.file(company).delete()).rejects.toMatchObject({ code: 403 });
    await bucket.deleteFiles({ prefix: `companies/${COMPANY}/` });
    expect(store.has(company)).toBe(true);
  }, 60_000);

  it.each([403, 412] as const)('Ζ58 — επανάληψη πάνω σε ΔΕΣΜΕΥΜΕΝΟ κλειδί (GCS απαντά %s) ⇒ υιοθέτηση, ποτέ επανεγγραφή', async (code) => {
    bucketOptions.heldSaveCode = code;
    const ready = docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER];
    copyHook = () => {
      fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, { ...ready, lifecycle: 'cancelled' });
      copyHook = () => undefined;
    };
    const stale = handover();
    expect((await issueHandoverProtocol(db(), stale, configured())).kind).toBe('superseded');
    fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, ready);
    expect(await issueHandoverProtocol(db(), stale, configured())).toMatchObject({ kind: 'issued', revision: 1 });
    expect(companyRecord(issuedPaths().protocolId)).toMatchObject({ hold: 'record' });
  }, 60_000);

  it('Ζ59 — χαμένο hold στα bytes (έπεσε μετά το ανέβασμα) ⇒ η επανάληψη το ΘΕΡΑΠΕΥΕΙ στην υιοθέτηση', async () => {
    const ready = docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER];
    copyHook = () => {
      fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, { ...ready, lifecycle: 'cancelled' });
      copyHook = () => undefined;
    };
    const stale = handover();
    expect((await issueHandoverProtocol(db(), stale, configured())).kind).toBe('superseded');
    for (const [path, object] of store) if (object.temporaryHold) store.set(path, { ...object, temporaryHold: false });
    fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, ready);
    await issueHandoverProtocol(db(), stale, configured());
    expect(store.get(issuedPaths().company)?.temporaryHold).toBe(true);
  }, 60_000);
});
