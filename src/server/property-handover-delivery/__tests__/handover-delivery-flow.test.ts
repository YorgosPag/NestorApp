/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Γ7–Γ13 — **η παράδοση αρχείων στον φάκελο του αγοραστή**, πάνω στο fake Firestore και σε
 *   ψεύτικο κάδο GCS (crc32c · μέγεθος · γενιά). Ο πραγματικός εκτελεστής, ο πραγματικός γραφέας της προόδου, η
 *   πραγματική προεπισκόπηση. Mocks: μόνο οι κάδοι, το ίχνος και το ημερολόγιο αρχείων. Όλα τα δεδομένα συνθετικά.
 */

import { createHash } from 'crypto';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { handoverDeliveryDigest, type HandoverDeliveredRow } from '@/lib/property-handover/handover-delivery-plan';
import { propertyHandoverFromDocument } from '@/lib/property-handover/property-handover-from-document';
import { isPreserved } from '@/lib/files/file-hold';
import { handoverCopyFileIdOf, handoverDeliveryIdOf, handoverDossierIdOf, propertyHandoverIdOf } from '@/lib/property-handover/property-handover-id';
import { deliverHandoverFiles, type HandoverFileDeliveryRecorder } from '@/server/property-handover-delivery/handover-delivery.server';
import { claimDeliveryRecovery, recordDeliveryClosure, recordDeliverySha256 } from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import { deliverDueHandoverFiles } from '@/services/property-handover/property-handover-delivery-trigger';
import { runPropertyHandoverDeliveryQueue } from '@/services/property-handover/property-handover-delivery-queue.service';
import { closeHandoverLine } from '@/services/property-handover/property-handover-line-closure.service';
import { previewPropertyHandover } from '@/services/property-handover/property-handover-preview.server';
import { recordHandoverFileDelivery } from '@/services/property-handover/property-handover-progress-write';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { fakeGcsBucket, type FakeGcsCopyCall, type FakeGcsStore } from '@/test-utils/fake-gcs/fake-gcs-bucket';

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({ createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }) }));
jest.mock('@/lib/firebaseAdmin', () => ({ FieldValue: { serverTimestamp: () => '2026-10-20T10:00:00.000Z' } }));
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn(async () => undefined) }));
jest.mock('@/services/file-audit-admin.service', () => ({ recordFileAudit: jest.fn(async (input: Record<string, unknown>) => { mockAudits.push(input); return 'audit'; }) }));
jest.mock('@/server/files/file-record-bucket', () => ({
  fileRecordBucket: () => mockBucket(),
  fileStorageBucket: () => mockBucket(),
}));

const mockAudits: Array<Record<string, unknown>> = [];
const store: FakeGcsStore = new Map();
const copies: FakeGcsCopyCall[] = [];
let copyHook: (call: FakeGcsCopyCall) => void = () => undefined;
const reads: string[] = [];
let readHook: (path: string) => void = () => undefined;
const bucket = fakeGcsBucket(store, 'default', {
  onCopy: (call) => { copies.push(call); copyHook(call); },
  onRead: (call) => { reads.push(call.path); readHook(call.path); },
});
function mockBucket() { return bucket; }

const COMPANY = 'comp_alfa';
const PROPERTY = 'prop_1';
const BUYER = 'uid_anna';
const HANDOVER = propertyHandoverIdOf(COMPANY, PROPERTY, 'cont_anna');
const MAIN_DOSSIER = handoverDossierIdOf(HANDOVER);
const PARKING_DOSSIER = handoverDossierIdOf(HANDOVER, { entityType: 'parking_spot', entityId: 'park_1' });
const AT = '2026-10-20T09:00:00.000Z';

let fake: FakeFirestore;
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const docs = (collection: string) => fake.getAllDocs(collection);
const record: HandoverFileDeliveryRecorder = (input) => recordHandoverFileDelivery(db(), input);
const handover = () => {
  const found = propertyHandoverFromDocument(docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER], HANDOVER);
  if (found === null) throw new Error('no handover');
  return found;
};
const deliver = (maxFiles = 50, maxHashBytes = 1_000_000) => deliverHandoverFiles(db(), handover(), { maxFiles, deadlineAt: null, maxHashBytes }, record);
const copyOf = (sourceFileId: string) => docs(COLLECTIONS.FILES_PERSONAL)[handoverCopyFileIdOf(HANDOVER, sourceFileId)];

/** Αρχείο της εταιρείας **με** τα bytes του. */
function companyFile(id: string, category: string, entity: { type: string; id: string } = { type: 'property', id: PROPERTY }, extra: Record<string, unknown> = {}) {
  const storagePath = `companies/${COMPANY}/entities/${entity.type}/${entity.id}/files/${id}.pdf`;
  fake.seed(COLLECTIONS.FILES, id, {
    companyId: COMPANY, entityType: entity.type, entityId: entity.id, domain: 'construction', category, status: 'ready',
    storagePath, originalFilename: `${id}.pdf`, displayName: id, contentType: 'application/pdf', ext: 'pdf', ...extra,
  });
  store.set(storagePath, { crc32c: `crc_${id}`, size: 1000, generation: 5, bytes: bytesOf(id) });
}

/** Συνθετικά bytes ενός αρχείου — 1000, διαφορετικά ανά αρχείο. */
const bytesOf = (id: string): Buffer => Buffer.alloc(1000, id);
const shaOf = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const ledgerRow = (sourceFileId: string) =>
  Object.values(docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)).find((row) => row.sourceFileId === sourceFileId);
const sourcePath = (id: string) => `companies/${COMPANY}/entities/property/${PROPERTY}/files/${id}.pdf`;

function seedHandover(patch: Record<string, unknown> = {}) {
  fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, {
    companyId: COMPANY, propertyId: PROPERTY, recipientContactId: 'cont_anna', lifecycle: 'ready',
    completion: { source: 'final-contract', at: AT }, recipient: { userId: BUYER, acceptedAt: AT, dossierId: MAIN_DOSSIER },
    invitation: null, fileDelivery: null, fileDeliveryState: 'pending', createdAt: AT, updatedAt: AT, ...patch,
  });
}

beforeEach(() => {
  fake = new FakeFirestore();
  store.clear();
  bucket.softDeleted.clear();
  copies.length = 0;
  reads.length = 0;
  mockAudits.length = 0;
  copyHook = () => undefined;
  readHook = () => undefined;
  seedWorld();
});

describe('Γ7 — ολοκληρωμένη πώληση + αποδεκτή πρόσκληση ⇒ τα παραδοτέα γίνονται αντίγραφα του αγοραστή', () => {
  it('μόνο τα `deliver` · εγγραφές personal `ready` με προέλευση · καθολικό · bytes · πρόοδος + προβολή στον φάκελο', async () => {
    expect(await deliver()).toEqual({ kind: 'delivered', copied: 3, failed: 0 });

    const plan = copyOf('f_plan');
    expect(plan).toMatchObject({
      userId: BUYER, entityType: 'property_dossier', entityId: MAIN_DOSSIER, status: 'ready', category: 'floorplans',
      createdBy: 'system:property-handover', uploaderName: 'Κατασκευαστική Άλφα',
      handoverOrigin: { handoverId: HANDOVER, sourceFileId: 'f_plan', issuerCompanyId: COMPANY, crc32c: 'crc_f_plan', size: 1000, revisionOfFileId: null },
    });
    expect(plan).not.toHaveProperty('companyId');
    expect(plan).not.toHaveProperty('cdeReadReach');
    expect(store.get(String(plan?.storagePath))).toMatchObject({ crc32c: 'crc_f_plan', size: 1000 });
    expect(copyOf('f_invoice')).toBeUndefined();
    expect(copyOf('f_doc')).toBeUndefined();

    expect(Object.values(docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES))).toHaveLength(3);
    expect(handover().fileDelivery).toMatchObject({ state: 'delivered', delivered: 3, total: 3, awaitingReview: 1, bytes: 3000 });
    expect(handover().fileDelivery?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER]).toMatchObject({ fileDeliveryState: 'delivered' });
    expect(docs(COLLECTIONS.PROPERTY_DOSSIERS)[MAIN_DOSSIER]).toMatchObject({ origin: { fileDelivery: { state: 'delivered', delivered: 3, total: 3 } } });
    expect(mockAudits.map((audit) => audit.action)).toEqual(['handover_receive', 'handover_receive', 'handover_receive']);
  });

  it('Δ4 — το αρχείο της θέσης στάθμευσης πάει στον ΔΙΚΟ της φάκελο, δεμένο με τον κύριο, με το όνομα της θέσης', async () => {
    await deliver();
    expect(docs(COLLECTIONS.PROPERTY_DOSSIERS)[PARKING_DOSSIER]).toMatchObject({
      userId: BUYER, label: 'P-12', origin: { handoverId: HANDOVER, appurtenanceOf: MAIN_DOSSIER },
    });
    expect(copyOf('f_park')).toMatchObject({ entityId: PARKING_DOSSIER });
  });
});

describe('Γ37 (Σ4) — ο εκτελεστής καλεί τον εκδότη Πρωτοκόλλου ΜΟΝΟ όταν καταλήγει `delivered`', () => {
  it('διακοπή ⇒ κανένας εκδότης · ολοκλήρωση ⇒ μία κλήση με την ΤΕΛΙΚΗ πρόοδο · δίχτυ χωρίς αλλαγή ⇒ ξανά (επανάληψη σφράγισης)', async () => {
    const issued: Array<{ readonly state: string | undefined; readonly digest: string | null | undefined }> = [];
    const issuer = async (h: ReturnType<typeof handover>) => { issued.push({ state: h.fileDelivery?.state, digest: h.fileDelivery?.digest }); };
    const run = (maxFiles: number) => deliverHandoverFiles(db(), handover(), { maxFiles, deadlineAt: null, maxHashBytes: 1_000_000 }, record, issuer);
    expect(await run(1)).toMatchObject({ kind: 'delivering' });
    expect(issued).toEqual([]);
    expect(await run(50)).toMatchObject({ kind: 'delivered' });
    expect(issued).toEqual([{ state: 'delivered', digest: handover().fileDelivery?.digest }]);
    expect(await run(50)).toMatchObject({ kind: 'delivered', copied: 0 });
    expect(issued).toHaveLength(2);
  });
});

describe('Γ8–Γ9 — συνέχιση χωρίς διπλά', () => {
  it('Γ8 — διακοπή μετά από 1 ⇒ `delivering` 1/3 · η επόμενη εκτέλεση ολοκληρώνει · καμία δεύτερη αντιγραφή', async () => {
    expect(await deliver(1)).toMatchObject({ kind: 'delivering', copied: 1 });
    expect(handover().fileDelivery).toMatchObject({ state: 'delivering', delivered: 1, total: 3 });
    expect(await deliver()).toMatchObject({ kind: 'delivered', copied: 2 });
    expect(await deliver()).toMatchObject({ kind: 'delivered', copied: 0 });
    expect(copies).toHaveLength(3);
    expect(Object.values(docs(COLLECTIONS.FILES_PERSONAL))).toHaveLength(3);
  });

  it('Γ9 — bytes χωρίς εγγραφή (κράτημα μετά το rewrite) ⇒ ΔΕΝ ξανααντιγράφεται, γεννιέται μόνο η εγγραφή', async () => {
    await deliver();
    const path = String(copyOf('f_plan')?.storagePath);
    // Νέα βάση, ίδιος κάδος: τα bytes ΕΝΟΣ αντιγράφου υπάρχουν ήδη, χωρίς εγγραφή και χωρίς γραμμή καθολικού.
    fake = new FakeFirestore();
    for (const key of [...store.keys()]) if (key !== path && key.startsWith('people/')) store.delete(key);
    copies.length = 0;
    seedWorld();
    expect(await deliver()).toMatchObject({ kind: 'delivered', copied: 3 });
    expect(copies.map((call) => call.from)).not.toContain(`companies/${COMPANY}/entities/property/${PROPERTY}/files/f_plan.pdf`);
    expect(copyOf('f_plan')).toMatchObject({ status: 'ready' });
  });
});

describe('Γ9β — καμία εγγραφή χωρίς απόδειξη', () => {
  it('🔴 αντίγραφο με άλλο crc32c από την πηγή ⇒ ΚΑΜΙΑ εγγραφή, καμία γραμμή καθολικού· μετριέται ως αποτυχία', async () => {
    copyHook = (call) => { if (call.to.includes(handoverCopyFileIdOf(HANDOVER, 'f_plan'))) store.set(call.to, { crc32c: 'αλλοιωμένο', size: 1000 }); };
    expect(await deliver()).toMatchObject({ kind: 'delivering', copied: 2, failed: 1 });
    expect(copyOf('f_plan')).toBeUndefined();
    expect(handover().fileDelivery).toMatchObject({ state: 'delivering', delivered: 2, total: 3 });
  });
});

describe('Γ10 — συμπληρώσεις και αναθεωρήσεις (Δ5 · ISO 19650)', () => {
  it('νέο παραδοτέο μετά την παράδοση ⇒ φτάνει μόνο του · τα παλιά ανέγγιχτα', async () => {
    await deliver();
    companyFile('f_cert', 'permits');
    expect(await deliver()).toMatchObject({ kind: 'delivered', copied: 1 });
    expect(handover().fileDelivery).toMatchObject({ delivered: 4, total: 4 });
  });

  it('νέα αναθεώρηση ⇒ ΝΕΟ αντίγραφο δεμένο με το παλιό · το παλιό ΜΕΝΕΙ ως ιστορικό', async () => {
    await deliver();
    fake.seed(COLLECTIONS.FILES, 'f_photo', { ...docs(COLLECTIONS.FILES).f_photo, supersededByFileId: 'f_photo2' });
    companyFile('f_photo2', 'photos');
    await deliver();
    expect(copyOf('f_photo2')?.handoverOrigin).toMatchObject({ revisionOfFileId: handoverCopyFileIdOf(HANDOVER, 'f_photo') });
    expect(copyOf('f_photo')).toMatchObject({ status: 'ready' });
    expect(handover().fileDelivery).toMatchObject({ delivered: 4, total: 4 });
  });
});

describe('Γ11–Γ12 — πότε ΔΕΝ γίνεται τίποτα, και τι δεν αφαιρείται ποτέ', () => {
  it.each([
    ['πώληση σε αναμονή ολοκλήρωσης', { lifecycle: 'awaiting-completion', completion: null }],
    ['χωρίς αποδοχή (κανένας φάκελος-προορισμός)', { recipient: null }],
  ])('Γ11 — %s ⇒ `not-due`, καμία αντιγραφή', async (_case, patch) => {
    seedHandover(patch);
    expect(await deliver()).toEqual({ kind: 'not-due', copied: 0, failed: 0 });
    expect(copies).toHaveLength(0);
  });

  it('Γ12 — η εταιρεία σβήνει την πηγή μετά την παράδοση ⇒ το αντίγραφο ΜΕΝΕΙ και μετρά (Δ5 · Δ8)', async () => {
    await deliver();
    fake.seed(COLLECTIONS.FILES, 'f_plan', { ...docs(COLLECTIONS.FILES).f_plan, isDeleted: true });
    expect(await deliver()).toMatchObject({ kind: 'delivered', copied: 0 });
    expect(copyOf('f_plan')).toMatchObject({ status: 'ready' });
    expect(handover().fileDelivery).toMatchObject({ delivered: 3, total: 3 });
  });
});

describe('Ζ54 — Φ-Δ.5: η ανάκληση ΝΙΚΑ την αντιγραφή που ήδη έτρεχε', () => {
  it('🔴 κούρσα — ανάκληση ΑΝΑΜΕΣΑ στα bytes και το commit ⇒ καμία εγγραφή, καμία γραμμή καθολικού, κανένα ορφανό byte', async () => {
    const running = handover();
    copyHook = (call) => {
      if (!call.to.includes(handoverCopyFileIdOf(HANDOVER, 'f_plan'))) return;
      seedHandover({
        lifecycle: 'withdrawn', fileDeliveryState: null,
        withdrawal: { reason: 'Η πώληση ακυρώθηκε', withdrawnBy: 'uid_office', withdrawnAt: AT, notice: null },
      });
    };
    const outcome = await deliverHandoverFiles(db(), running, { maxFiles: 50, deadlineAt: null, maxHashBytes: 1_000_000 }, record);
    expect(outcome.failed).toBe(0);
    expect(copyOf('f_plan')).toBeUndefined();
    expect(ledgerRow('f_plan')).toBeUndefined();
    expect([...store.keys()].some((key) => key.includes(handoverCopyFileIdOf(HANDOVER, 'f_plan')))).toBe(false);
    // Η πρόοδος δεν γράφεται πάνω σε ανακλημένη (CAS των γραφών προόδου).
    expect(handover()).toMatchObject({ lifecycle: 'withdrawn', fileDelivery: null });
  });

  it('ό,τι είχε ήδη παραδοθεί πριν την ανάκληση ΜΕΝΕΙ· νέα εκτέλεση = not-due, καμία αντιγραφή', async () => {
    await deliver();
    const delivered = copyOf('f_plan');
    seedHandover({ lifecycle: 'withdrawn', fileDeliveryState: null, fileDelivery: handover().fileDelivery });
    copies.length = 0;
    expect(await deliver()).toEqual({ kind: 'not-due', copied: 0, failed: 0 });
    expect(copies).toHaveLength(0);
    expect(copyOf('f_plan')).toEqual(delivered);
  });
});

describe('Γ13 — η όψη του γραφείου και η πράξη ΔΕΝ μπορούν να διαφωνήσουν · η ουρά του cron', () => {
  it('ό,τι λέει η προεπισκόπηση «παραδίδεται» είναι ΑΚΡΙΒΩΣ ό,τι γράφτηκε στο καθολικό', async () => {
    const preview = await previewPropertyHandover(db(), COMPANY, PROPERTY);
    await deliver();
    const ledger = Object.values(docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)).map((row) => row.sourceFileId).sort();
    expect(preview?.files.deliver.map((file) => file.fileId).sort()).toEqual(ledger);
  });

  it('Ζ8 — η καρτέλα «Παράδοση» (Φ-Δ): κρίση ανά παράδοση από την ΙΔΙΑ πόρτα · μόνο ονοματεπώνυμο · σφραγίδα μόνο «ρυθμίστηκε;»', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_anna', {
      companyId: COMPANY, type: 'individual', firstName: 'Άννα', lastName: 'Δοκιμαστική', vatNumber: '000000000', phones: [{ number: '2100000000' }],
    });
    const preview = await previewPropertyHandover(db(), COMPANY, PROPERTY);
    expect(preview?.seal).toEqual({ configured: false });
    expect(preview?.handovers).toHaveLength(1);
    expect(preview?.handovers[0]).toMatchObject({ recipientName: 'Άννα Δοκιμαστική', status: { reason: 'delivery-queued', move: 'system' } });
    const wire = JSON.stringify(preview);
    expect(wire).not.toContain('000000000');
    expect(wire).not.toContain('2100000000');
    expect(wire).not.toMatch(/NESTOR_SEAL/);
  });

  it('Ζ8β — Ο4 στην πόρτα: η πώληση έπεσε ΜΕΤΑ την ολοκλήρωση ⇒ sale-reverted (ποτέ σιωπηλά «σε εξέλιξη»)', async () => {
    fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { ...docs(COLLECTIONS.PROPERTIES)[PROPERTY], commercial: { owners: [], legalPhase: 'final_signed' } });
    const preview = await previewPropertyHandover(db(), COMPANY, PROPERTY);
    expect(preview?.handovers[0]?.status).toMatchObject({ reason: 'sale-reverted', move: 'office' });
  });

  it('η ουρά βρίσκει την οφειλόμενη παράδοση από το παράγωγο `fileDeliveryState` και την ολοκληρώνει', async () => {
    expect(await runPropertyHandoverDeliveryQueue(db())).toMatchObject({ queued: 1, completed: 1, copied: 3, failedHandovers: 0 });
    expect(await runPropertyHandoverDeliveryQueue(db())).toMatchObject({ queued: 0 });
  });
});

describe('Γ18–Γ22 — Φ-Γ2 Σ2: sha256 ανά παραδομένο αρχείο + αποτύπωμα v2', () => {
  it('Γ18 — κάθε γραμμή καθολικού κρατά το sha256 των bytes του ΑΝΤΙΓΡΑΦΟΥ · το αποτύπωμα καλύπτει κάθε byte', async () => {
    expect(await deliver()).toEqual({ kind: 'delivered', copied: 3, failed: 0 });
    for (const id of ['f_plan', 'f_photo', 'f_park']) {
      expect(ledgerRow(id)).toMatchObject({ sha256: shaOf(bytesOf(id)), sha256Of: 'copy' });
      expect(ledgerRow(id)?.hashedAt).toEqual(expect.any(String));
    }
    const rows = Object.values(docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)) as unknown as HandoverDeliveredRow[];
    expect(handover().fileDelivery?.digest).toBe(await handoverDeliveryDigest(rows));
    expect(reads.every((path) => path.startsWith('people/'))).toBe(true);
  });

  it('Γ19 — προϋπολογισμός bytes: «παραδόθηκαν» αλλά αποτύπωμα ΕΚΚΡΕΜΕΙ ⇒ `delivering` + digest `null` · οι επόμενες ολοκληρώνουν, καμία διπλή ανάγνωση', async () => {
    expect(await deliver(50, 1000)).toEqual({ kind: 'delivering', copied: 3, failed: 0 });
    expect(handover().fileDelivery).toMatchObject({ state: 'delivering', delivered: 3, total: 3, digest: null });
    expect(docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER]).toMatchObject({ fileDeliveryState: 'delivering' });
    expect(await deliver(50, 1000)).toMatchObject({ kind: 'delivering', copied: 0 });
    expect(await deliver(50, 1000)).toMatchObject({ kind: 'delivered', copied: 0 });
    expect(handover().fileDelivery?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(reads).toHaveLength(3);
    await deliver();
    expect(reads).toHaveLength(3);
  });

  it('Γ20 — ο αγοραστής ΑΝΤΙΚΑΤΕΣΤΗΣΕ το αντίγραφό του πριν τον κατακερματισμό ⇒ μετριέται η καρφωμένη γενιά-πηγή (ίδια bytes)', async () => {
    await deliver(50, 0);
    const copyPath = String(copyOf('f_plan')?.storagePath);
    store.set(copyPath, { crc32c: 'άλλο', size: 1000, generation: 999, bytes: Buffer.alloc(1000, 'x') });
    expect(await deliver()).toMatchObject({ kind: 'delivered' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: shaOf(bytesOf('f_plan')), sha256Of: 'source' });
  });

  it('🔴 Γ21 — ούτε αντίγραφο ούτε η γενιά-πηγή ⇒ ΚΑΝΕΝΑ sha256, κανένα αποτύπωμα, το σφάλμα λέγεται', async () => {
    await deliver(50, 0);
    store.delete(String(copyOf('f_plan')?.storagePath));
    store.set(sourcePath('f_plan'), { crc32c: 'crc_f_plan', size: 1000, generation: 6, bytes: bytesOf('f_plan') });
    expect(await deliver()).toMatchObject({ kind: 'delivering' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: null, sha256Of: null });
    expect(ledgerRow('f_photo')?.sha256).toBe(shaOf(bytesOf('f_photo')));
    expect(handover().fileDelivery).toMatchObject({ state: 'delivering', digest: null, lastError: expect.stringMatching(/f_plan/) });
    // Σ4 (Ο13) — ονομασμένο, όχι μόνο κείμενο σφάλματος: η κρίση του Πρωτοκόλλου το διαβάζει ως «απόφαση γραφείου».
    expect(handover().fileDelivery?.unverifiable).toBe(1);
  });

  it('🔴 Γ22 — η γενιά αλλάζει ΑΝΑΜΕΣΑ σε μέτρηση και ανάγνωση (ίδιο crc32c, άλλα bytes) ⇒ ΔΕΝ γράφεται λάθος sha256', async () => {
    await deliver(50, 0);
    const copyPath = String(copyOf('f_plan')?.storagePath);
    const forged = { crc32c: 'crc_f_plan', size: 1000, bytes: Buffer.alloc(1000, 'πλαστό') };
    readHook = (path) => {
      if (path === copyPath) store.set(copyPath, { ...forged, generation: 777 });
      if (path === sourcePath('f_plan')) store.set(path, { ...forged, generation: 778 });
    };
    await deliver();
    expect(ledgerRow('f_plan')?.sha256).toBeNull();
    expect(ledgerRow('f_plan')?.sha256).not.toBe(shaOf(forged.bytes));
    expect(handover().fileDelivery?.digest).toBeNull();
  });

  it('🔴 Γ23 — το sha256 γράφεται ΜΙΑ φορά: δεύτερη εγγραφή επιστρέφει το αποθηκευμένο · άλλα bytes (crc32c) ⇒ άρνηση', async () => {
    await deliver(50, 0);
    const first = { sourceFileId: 'f_plan', crc32c: 'crc_f_plan', size: 1000, sha256: 'a'.repeat(64), origin: 'copy' as const };
    expect(await recordDeliverySha256(db(), HANDOVER, first)).toEqual({ kind: 'hashed', sha256: 'a'.repeat(64) });
    expect(await recordDeliverySha256(db(), HANDOVER, { ...first, sha256: 'b'.repeat(64) })).toEqual({ kind: 'hashed', sha256: 'a'.repeat(64) });
    expect(await recordDeliverySha256(db(), HANDOVER, { ...first, sourceFileId: 'f_photo', crc32c: 'άλλο' })).toEqual({ kind: 'refused' });
    expect(ledgerRow('f_plan')?.sha256).toBe('a'.repeat(64));
    expect(ledgerRow('f_photo')?.sha256).toBeNull();
  });
});

describe('Ζ67–Ζ73 — Φ-Δ.7α: η γενιά-πηγή ΔΙΑΤΗΡΕΙΤΑΙ ως την απόδειξη (Ο13β πρόληψη)', () => {
  const source = (id: string) => docs(COLLECTIONS.FILES)[id];
  const proofOf = (id: string) => handoverDeliveryIdOf(HANDOVER, id);
  /** Η διαδρομή από την ΙΔΙΑ την εγγραφή — η θέση στάθμευσης ζει κάτω από άλλη οντότητα από το ακίνητο. */
  const bytesHeld = (id: string) => store.get(String(source(id)?.storagePath))?.temporaryHold === true;
  const tryDeleteSource = (id: string) => bucket.file(sourcePath(id)).delete();

  it('🔴 Ζ67 — γραμμή χωρίς sha256 ⇒ η πηγή διατηρείται: βάση (`preservedFor`) ΚΑΙ bytes (GCS) — η πλατφόρμα αρνείται τη διαγραφή', async () => {
    expect(await deliver(50, 0)).toMatchObject({ kind: 'delivering', copied: 3 });
    for (const id of ['f_plan', 'f_photo', 'f_park']) {
      expect(source(id)?.preservedFor).toEqual([proofOf(id)]);
      expect(isPreserved(source(id) ?? {})).toBe(true);
      expect(bytesHeld(id)).toBe(true);
    }
    await expect(tryDeleteSource('f_plan')).rejects.toMatchObject({ code: 403 });
    // Ό,τι ΔΕΝ παραδόθηκε μένει ανέγγιχτο.
    expect(source('f_invoice')).not.toHaveProperty('preservedFor');
    expect(bytesHeld('f_invoice')).toBe(false);
  });

  it('🔴 Ζ67 — bytes ΠΡΩΤΑ: ο κάδος κλειδώνει ΠΡΙΝ γεννηθεί η γραμμή (ποτέ «διατηρείται στη βάση, ελεύθερο στον κάδο»)', async () => {
    const order: string[] = [];
    const original = bucket.file.bind(bucket);
    const spy = jest.spyOn(bucket, 'file').mockImplementation((path, opts) => {
      const file = original(path, opts);
      if (path !== sourcePath('f_plan')) return file;
      const setMetadata = file.setMetadata;
      file.setMetadata = async (patch) => {
        if (patch.temporaryHold) order.push(ledgerRow('f_plan') === undefined ? 'before-row' : 'after-row');
        return setMetadata(patch);
      };
      return file;
    });
    try {
      await deliver(50, 0);
    } finally {
      spy.mockRestore();
    }
    expect(order[0]).toBe('before-row');
  });

  it('🔴 Ζ67 — ΑΤΟΜΙΚΑ με τη γραμμή: τη στιγμή που ο κατακερματισμός διαβάζει, η πηγή διατηρείται ΗΔΗ (όχι από το δίχτυ)', async () => {
    const seen: unknown[] = [];
    readHook = (path) => { if (path === String(copyOf('f_plan')?.storagePath)) seen.push(source('f_plan')?.preservedFor); };
    await deliver();
    expect(seen).toEqual([[proofOf('f_plan')]]);
  });

  it('🔴 Ζ68 — το sha256 αποδεσμεύει στην ΙΔΙΑ συναλλαγή · τα bytes ξεκλειδώνουν · μία εκτέλεση = καμία διατήρηση στο τέλος', async () => {
    await deliver(50, 0);
    expect(await deliver()).toMatchObject({ kind: 'delivered' });
    for (const id of ['f_plan', 'f_photo', 'f_park']) {
      expect(ledgerRow(id)?.sha256).toBe(shaOf(bytesOf(id)));
      expect(source(id)?.preservedFor).toEqual([]);
      expect(bytesHeld(id)).toBe(false);
    }
    await expect(tryDeleteSource('f_plan')).resolves.toBeUndefined();
  });

  it('🔴 Ζ68 — ποτέ εγγραφή σε ΞΕΝΟ έγγραφο: πηγή άλλου ενοικιαστή ⇒ το sha256 γράφεται, η διατήρησή της ΔΕΝ αγγίζεται', async () => {
    await deliver(50, 0);
    fake.seed(COLLECTIONS.FILES, 'f_plan', { ...source('f_plan'), companyId: 'comp_beta' });
    const measured = { sourceFileId: 'f_plan', crc32c: 'crc_f_plan', size: 1000, sha256: 'a'.repeat(64), origin: 'copy' as const };
    expect(await recordDeliverySha256(db(), HANDOVER, measured)).toEqual({ kind: 'hashed', sha256: 'a'.repeat(64) });
    expect(source('f_plan')?.preservedFor).toEqual([proofOf('f_plan')]);
  });

  it('🔴 Ζ69 — η άρση της διατήρησης ΔΕΝ ξεκλειδώνει bytes που κρατά νόμιμη δέσμευση (ένας διακόπτης, δύο κάτοχοι)', async () => {
    fake.seed(COLLECTIONS.FILES, 'f_plan', { ...source('f_plan'), hold: 'legal' });
    await deliver();
    expect(source('f_plan')?.preservedFor).toEqual([]);
    expect(bytesHeld('f_plan')).toBe(true);
    expect(bytesHeld('f_photo')).toBe(false);
  });

  it('🔴 Ζ71 — η παράδοση ΔΕΝ οφείλεται πια (ανάκληση) ⇒ οι πηγές αφήνονται: βάση + bytes', async () => {
    await deliver(50, 0);
    seedHandover({ lifecycle: 'withdrawn', fileDeliveryState: null, fileDelivery: handover().fileDelivery });
    await deliverDueHandoverFiles(db(), [handover()], { rescanDelivered: false }, record);
    for (const id of ['f_plan', 'f_photo', 'f_park']) {
      expect(source(id)?.preservedFor).toEqual([]);
      expect(bytesHeld(id)).toBe(false);
    }
    expect(ledgerRow('f_plan')?.sha256).toBeNull();
  });

  it('🔴 Ζ72 — δίχτυ: γραμμή χωρίς διατήρηση (πριν τη Φ-Δ.7α · μισή αποτυχία) ⇒ η επόμενη εκτέλεση τη θεραπεύει', async () => {
    await deliver(50, 0);
    const { preservedFor: _lost, ...withoutPreservation } = source('f_plan') ?? {};
    fake.seed(COLLECTIONS.FILES, 'f_plan', withoutPreservation);
    store.set(sourcePath('f_plan'), { ...store.get(sourcePath('f_plan')), temporaryHold: false } as NonNullable<ReturnType<typeof store.get>>);
    await deliver(50, 0);
    expect(source('f_plan')?.preservedFor).toEqual([proofOf('f_plan')]);
    expect(bytesHeld('f_plan')).toBe(true);
  });

  it('🔴 Ζ73 — δύο αποδείξεις στην ίδια πηγή ⇒ φεύγει μόνο η ΔΙΚΗ μας· τα bytes μένουν κλειδωμένα για την άλλη', async () => {
    fake.seed(COLLECTIONS.FILES, 'f_plan', { ...source('f_plan'), preservedFor: ['phdl_other'] });
    await deliver(50, 0);
    expect(source('f_plan')?.preservedFor).toEqual(['phdl_other', proofOf('f_plan')]);
    await deliver();
    expect(source('f_plan')?.preservedFor).toEqual(['phdl_other']);
    expect(bytesHeld('f_plan')).toBe(true);
  });
});

describe('Ζ74–Ζ81 — Φ-Δ.7β: η απόδειξη από το GCS soft delete (Ο13β (ii))', () => {
  const copyPath = () => String(copyOf('f_plan')?.storagePath);
  const softDeletedAt = (path: string) => bucket.softDeleted.get(path) ?? [];
  const dropSourceRecord = () => db().collection(COLLECTIONS.FILES).doc('f_plan').delete();
  /** Ο κόσμος «εκτός εφαρμογής»: ο αγοραστής έσβησε το αντίγραφο · κάποιος έλυσε το hold και έσβησε πηγή + εγγραφή. */
  async function loseEverything(): Promise<void> {
    await deliver(50, 0);
    await bucket.file(copyPath()).delete();
    store.set(sourcePath('f_plan'), { ...store.get(sourcePath('f_plan')), temporaryHold: false } as NonNullable<ReturnType<typeof store.get>>);
    await bucket.file(sourcePath('f_plan')).delete();
    await dropSourceRecord();
  }
  const realFile = bucket.file.bind(bucket);
  const restores: number[] = [];
  /** «Κρασάρισμα» μετά την επαναφορά / πριν την επαναδιαγραφή — ρίχνει μία φορά και ξαναγίνεται αθόρυβο. */
  let restoreHook: () => void = () => undefined;
  let generationDeleteHook: () => void = () => undefined;
  const failOnce = (): (() => void) => {
    let armed = true;
    return () => {
      if (!armed) return;
      armed = false;
      throw Object.assign(new Error('503 crash'), { code: 503 });
    };
  };
  beforeEach(() => {
    restores.length = 0;
    restoreHook = () => undefined;
    generationDeleteHook = () => undefined;
    jest.spyOn(bucket, 'file').mockImplementation((path, opts) => {
      const file = realFile(path, opts);
      const { restore, delete: remove } = file;
      file.restore = async (options) => {
        const restored = await restore(options);
        restores.push(Number(restored.generation));
        restoreHook();
        return restored;
      };
      file.delete = async (options) => {
        if (options?.ifGenerationMatch !== undefined) generationDeleteHook();
        return remove(options);
      };
      return file;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('Ζ74 — ο εντοπιστής της πηγής γράφεται ΣΤΗ ΓΕΝΝΗΣΗ της γραμμής (θέση + διαδρομή) · κανένα ημερολόγιο', async () => {
    await deliver(50, 0);
    expect(ledgerRow('f_plan')).toMatchObject({ sourceObject: { placement: 'legacy-default', path: sourcePath('f_plan') }, recovery: null });
  });

  it('🔴 Ζ75 — εγγραφή-πηγή σβησμένη εκτός εφαρμογής, bytes ζωντανά ⇒ μετριέται από τον εντοπιστή · ΚΑΜΙΑ επαναφορά', async () => {
    await deliver(50, 0);
    await bucket.file(copyPath()).delete();
    await dropSourceRecord();
    expect(await deliver()).toMatchObject({ kind: 'delivered' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: shaOf(bytesOf('f_plan')), sha256Of: 'source', recovery: null });
    expect(restores).toEqual([]);
  });

  it('🔴 Ζ75β — εγγραφή-πηγή ΞΕΝΟΥ ενοικιαστή ⇒ ο εντοπιστής ΔΕΝ την παρακάμπτει: κανένα sha256 από την πηγή', async () => {
    await deliver(50, 0);
    await bucket.file(copyPath()).delete();
    fake.seed(COLLECTIONS.FILES, 'f_plan', { ...docs(COLLECTIONS.FILES).f_plan, companyId: 'comp_beta' });
    await deliver();
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: null, sha256Of: null });
  });

  it('🔴 Ζ76 — ούτε αντίγραφο ούτε πηγή ⇒ επαναφορά → μέτρηση → ΕΠΑΝΑΔΙΑΓΡΑΦΗ: μένει μόνο το sha256, ειλικρινές', async () => {
    await loseEverything();
    expect(await deliver()).toMatchObject({ kind: 'delivered' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: shaOf(bytesOf('f_plan')), sha256Of: 'restored-source' });
    expect(ledgerRow('f_plan')?.recovery).toMatchObject({ restoredGeneration: String(restores[0]), settledAt: expect.any(String) });
    expect(restores).toHaveLength(1);
    // Ό,τι σβήστηκε ΜΕΝΕΙ σβησμένο — και η γενιά που γεννήσαμε ξανασβήστηκε.
    expect(store.has(sourcePath('f_plan'))).toBe(false);
    expect(softDeletedAt(sourcePath('f_plan')).map((object) => object.generation)).toContain(restores[0]);
    await deliver();
    expect(restores).toHaveLength(1);
  });

  it('🔴 Ζ77 — ζωντανό ΞΕΝΟ αντικείμενο στο όνομα ⇒ καμία επαναφορά από πάνω, καμία διαγραφή του, κανένα sha256', async () => {
    await loseEverything();
    const foreign = { crc32c: 'crc_f_plan', size: 1000, generation: 4242, bytes: Buffer.alloc(1000, 'ξένο') };
    store.set(sourcePath('f_plan'), foreign);
    expect(await deliver()).toMatchObject({ kind: 'delivering' });
    expect(store.get(sourcePath('f_plan'))).toEqual(foreign);
    expect(ledgerRow('f_plan')?.sha256).toBeNull();
    expect(restores).toEqual([]);
  });

  it('🔴 Ζ77β — υιοθεσία ΜΟΝΟ για αντικείμενο γεννημένο ΜΕΤΑ τη μίσθωση: παλαιότερο ζωντανό με ίδια bytes ΔΕΝ είναι δικό μας', async () => {
    await loseEverything();
    const older = { crc32c: 'crc_f_plan', size: 1000, generation: 4242, bytes: Buffer.alloc(1000, 'ξένο'), timeCreated: '2025-12-01T00:00:00.000Z' };
    store.set(sourcePath('f_plan'), older);
    seedLedgerRecovery({ startedAt: '2026-01-01T00:00:00.000Z', restoredGeneration: null, settledAt: null });
    await deliver();
    expect(store.get(sourcePath('f_plan'))).toEqual(older);
    expect(ledgerRow('f_plan')?.sha256).toBeNull();
  });

  it('🔴 Ζ78 — η soft-deleted γενιά ΔΕΝ είναι αυτή της γραμμής (άλλο crc32c) ή έληξε ⇒ τίποτα· μένει unverifiable (→ Φ-Δ.7γ)', async () => {
    await loseEverything();
    bucket.softDeleted.set(sourcePath('f_plan'), softDeletedAt(sourcePath('f_plan')).map((object) => ({ ...object, crc32c: 'άλλο' })));
    expect(await deliver()).toMatchObject({ kind: 'delivering' });
    expect(handover().fileDelivery?.unverifiable).toBe(1);
    // Κλειστή ανάκτηση = τελική· καμία νέα επαναφορά σε κάθε εκτέλεση.
    expect(await claimDeliveryRecovery(db(), HANDOVER, 'f_plan')).toEqual({ kind: 'settled' });
    bucket.softDeleted.clear();
    seedLedgerRecovery(null);
    expect(await deliver()).toMatchObject({ kind: 'delivering' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: null, sha256Of: null });
    expect(restores).toEqual([]);
  });

  it('🔴 Ζ79 — κρασάρισμα ΑΝΑΜΕΣΑ σε επαναφορά και ημερολόγιο ⇒ η επόμενη εκτέλεση ΥΙΟΘΕΤΕΙ τη δική μας γενιά · καμία δεύτερη', async () => {
    await loseEverything();
    restoreHook = failOnce();
    await deliver();
    expect(store.has(sourcePath('f_plan'))).toBe(true);
    expect(ledgerRow('f_plan')?.recovery).toMatchObject({ restoredGeneration: null, settledAt: null });
    seedLedgerRecovery({ startedAt: '2026-01-01T00:00:00.000Z', restoredGeneration: null, settledAt: null });
    expect(await deliver()).toMatchObject({ kind: 'delivered' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: shaOf(bytesOf('f_plan')), sha256Of: 'restored-source' });
    expect(restores).toHaveLength(1);
    expect(store.has(sourcePath('f_plan'))).toBe(false);
  });

  it('🔴 Ζ79β — το όνομα ΞΑΝΑΓΡΑΦΕΤΑΙ ανάμεσα σε επαναφορά και μέτρηση (ίδιο crc32c, άλλα bytes) ⇒ ούτε μέτρηση ούτε διαγραφή του ξένου', async () => {
    await loseEverything();
    const forged = { crc32c: 'crc_f_plan', size: 1000, generation: 4243, bytes: Buffer.alloc(1000, 'πλαστό') };
    restoreHook = () => { store.set(sourcePath('f_plan'), forged); };
    await deliver();
    expect(ledgerRow('f_plan')?.recovery).toMatchObject({ restoredGeneration: String(restores[0]), settledAt: expect.any(String) });
    expect(ledgerRow('f_plan')?.sha256).toBeNull();
    expect(store.get(sourcePath('f_plan'))).toEqual(forged);
  });

  it('🔴 Ζ80 — η απόδειξη γράφτηκε, η επαναδιαγραφή ΟΧΙ ⇒ το δίχτυ κλείνει το ημερολόγιο: ποτέ ορφανό ζωντανό αντικείμενο', async () => {
    await loseEverything();
    generationDeleteHook = failOnce();
    await deliver();
    expect(ledgerRow('f_plan')?.sha256).toBe(shaOf(bytesOf('f_plan')));
    expect(store.has(sourcePath('f_plan'))).toBe(true);
    expect(ledgerRow('f_plan')?.recovery).toMatchObject({ settledAt: null });
    await deliver();
    expect(store.has(sourcePath('f_plan'))).toBe(false);
    expect(ledgerRow('f_plan')?.recovery).toMatchObject({ settledAt: expect.any(String) });
  });

  it('🔴 Ζ81 — δύο ταυτόχρονες εκτελέσεις ⇒ μία διεκδίκηση· η άλλη `busy` · ΜΙΑ επαναφορά', async () => {
    await loseEverything();
    expect(await claimDeliveryRecovery(db(), HANDOVER, 'f_plan')).toEqual({ kind: 'claimed', adoptSince: null });
    expect(await claimDeliveryRecovery(db(), HANDOVER, 'f_plan')).toEqual({ kind: 'busy' });
    await Promise.all([deliver(), deliver()]);
    expect(restores).toEqual([]);
    seedLedgerRecovery({ startedAt: '2026-01-01T00:00:00.000Z', restoredGeneration: null, settledAt: null });
    await Promise.all([deliver(), deliver()]);
    expect(restores).toHaveLength(1);
    expect(ledgerRow('f_plan')?.sha256Of).toBe('restored-source');
  });

  /** Το ημερολόγιο της γραμμής, όπως θα το άφηνε μια παλιά εκτέλεση (ληγμένη μίσθωση). */
  function seedLedgerRecovery(recovery: Record<string, unknown> | null): void {
    const id = handoverDeliveryIdOf(HANDOVER, 'f_plan');
    fake.seed(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES, id, { ...docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)[id], recovery });
  }
});

describe('Ζ83–Ζ92 — Φ-Δ.7γ: κλείσιμο γραμμής χωρίς πλήρες αποτύπωμα (Ο13β (i))', () => {
  const copyPath = () => String(copyOf('f_plan')?.storagePath);
  const REASON = 'Ο αγοραστής έσβησε το αντίγραφο και η πηγή χάθηκε.';
  const close = (patch: Partial<{ companyId: string; handoverId: string; sourceFileId: string }> = {}) => closeHandoverLine(db(), {
    companyId: COMPANY, propertyId: PROPERTY, handoverId: HANDOVER, sourceFileId: 'f_plan', reason: REASON, performedBy: 'uid_office', ...patch,
  });
  const unproven = async () => (await previewPropertyHandover(db(), COMPANY, PROPERTY))?.handovers[0]?.unprovenLines ?? [];
  /** Αντίγραφο σβησμένο · πηγή σβησμένη · η soft-deleted γενιά έληξε. `keepRecord` ⇒ η εγγραφή-πηγή μένει (μόνο τα bytes χάθηκαν). */
  async function loseForever(keepRecord = false): Promise<void> {
    await deliver(50, 0);
    await bucket.file(copyPath()).delete();
    store.set(sourcePath('f_plan'), { ...store.get(sourcePath('f_plan')), temporaryHold: false } as NonNullable<ReturnType<typeof store.get>>);
    await bucket.file(sourcePath('f_plan')).delete();
    if (!keepRecord) await db().collection(COLLECTIONS.FILES).doc('f_plan').delete();
    bucket.softDeleted.clear();
    expect(await deliver()).toMatchObject({ kind: 'delivering' });
    expect(handover().fileDelivery?.unverifiable).toBe(1);
  }

  it('🔴 Ζ83 — bytes χαμένα οριστικά ⇒ η καρτέλα προσφέρει κλείσιμο ΜΕ την αιτία της μηχανής · η πόρτα κλείνει · η παράδοση ολοκληρώνεται με αποτύπωμα v3', async () => {
    await loseForever();
    expect(await unproven()).toEqual([expect.objectContaining({ sourceFileId: 'f_plan', offer: { kind: 'close', cause: 'bytes-gone' } })]);
    expect(await close()).toEqual({ kind: 'closed' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: null, closure: { cause: 'bytes-gone', reason: REASON, closedBy: 'uid_office' } });
    expect(await deliver()).toMatchObject({ kind: 'delivered' });
    const open = Object.values(docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES))
      .filter((row) => row.sourceFileId !== 'f_plan')
      .map((row) => ({ sourceFileId: String(row.sourceFileId), copyFileId: String(row.copyFileId), sha256: String(row.sha256), size: Number(row.size) }));
    const v2 = await handoverDeliveryDigest(open);
    const v3 = await handoverDeliveryDigest(open, [{ sourceFileId: 'f_plan', copyFileId: handoverCopyFileIdOf(HANDOVER, 'f_plan'), crc32c: 'crc_f_plan', size: 1000, cause: 'bytes-gone' }]);
    expect(handover().fileDelivery).toMatchObject({ state: 'delivered', unverifiable: 0, digest: v3 });
    expect(v3).not.toBe(v2);
    expect(await unproven()).toEqual([]);
  });

  it('🔴 Ζ84 — η soft-deleted γενιά υπάρχει ακόμη ⇒ `recovering`: ΚΑΝΕΝΑ κλείσιμο (η Φ-Δ.7β μπορεί ακόμη να αποδείξει)', async () => {
    await deliver(50, 0);
    await bucket.file(copyPath()).delete();
    store.set(sourcePath('f_plan'), { ...store.get(sourcePath('f_plan')), temporaryHold: false } as NonNullable<ReturnType<typeof store.get>>);
    await bucket.file(sourcePath('f_plan')).delete();
    store.set(sourcePath('f_plan'), { crc32c: 'crc_f_plan', size: 1000, generation: 4242, bytes: Buffer.alloc(1000, 'ξένο') });
    await deliver();
    expect(handover().fileDelivery?.unverifiable).toBe(1);
    expect(await unproven()).toEqual([expect.objectContaining({ offer: { kind: 'blocked', reason: 'recovering' } })]);
    expect(await close()).toEqual({ kind: 'refused', reason: 'recovering' });
    expect(ledgerRow('f_plan')?.closure).toBeNull();
  });

  it('🔴 Ζ85 — ζωντανά bytes (απλώς δεν μετρήθηκαν ακόμη) ⇒ `provable` · και η καρτέλα ΔΕΝ μετρά όσο δεν βρέθηκε μη επαληθεύσιμη', async () => {
    await deliver(50, 0);
    expect(await unproven()).toEqual([]);
    expect(await close()).toEqual({ kind: 'refused', reason: 'provable' });
  });

  it('🔴 Ζ86 — γραμμή με sha256 ΔΕΝ κλείνει ποτέ — ούτε από την πόρτα, ούτε από τον γραφέα απευθείας', async () => {
    await deliver();
    expect(await close()).toEqual({ kind: 'refused', reason: 'proven' });
    const row = ledgerRow('f_plan');
    expect(await recordDeliveryClosure(db(), HANDOVER, {
      sourceFileId: 'f_plan', crc32c: String(row?.crc32c), size: Number(row?.size), cause: 'bytes-gone', reason: REASON, closedBy: 'uid_office',
    })).toEqual({ kind: 'refused', reason: 'proven' });
  });

  it('🔴 Ζ87 — δεύτερο κλείσιμο (διπλό κλικ · άλλο κλειδί) ⇒ `unchanged`: μία εγγραφή, ένα ίχνος', async () => {
    await loseForever(true);
    expect(await close()).toEqual({ kind: 'closed' });
    const closedAt = (ledgerRow('f_plan')?.closure as { closedAt?: string } | null)?.closedAt;
    expect(await close()).toEqual({ kind: 'unchanged' });
    // Και ο ΙΔΙΟΣ ο γραφέας (δεύτερη άμυνα, πίσω από την κρίση της πόρτας): ήδη κλεισμένη ⇒ `unchanged`, καμία επανεγγραφή.
    expect(await recordDeliveryClosure(db(), HANDOVER, {
      sourceFileId: 'f_plan', crc32c: 'crc_f_plan', size: 1000, cause: 'source-unlocated', reason: 'άλλη αιτιολογία εδώ', closedBy: 'uid_other',
    })).toEqual({ kind: 'unchanged' });
    expect(ledgerRow('f_plan')?.closure).toMatchObject({ cause: 'bytes-gone', closedBy: 'uid_office', closedAt });
    expect(mockAudits.filter((audit) => audit.action === 'handover_line_closure')).toHaveLength(1);
  });

  it('🔴 Ζ88 — κλεισμένη γραμμή: ο κατακερματισμός δεν την ξαναδιαβάζει, και sha256 που φτάνει αργότερα ΔΕΝ την ξανανοίγει', async () => {
    await loseForever();
    await close();
    reads.length = 0;
    await deliver();
    expect(reads).toEqual([]);
    expect(await recordDeliverySha256(db(), HANDOVER, { sourceFileId: 'f_plan', crc32c: 'crc_f_plan', size: 1000, sha256: shaOf(bytesOf('f_plan')), origin: 'copy' }))
      .toEqual({ kind: 'refused' });
    expect(ledgerRow('f_plan')).toMatchObject({ sha256: null, closure: { cause: 'bytes-gone' } });
  });

  it('🔴 Ζ89 — γραμμή χωρίς εντοπιστή (πριν τη Φ-Δ.7β) ⇒ αιτία `source-unlocated`, όχι `bytes-gone`', async () => {
    await loseForever();
    const id = handoverDeliveryIdOf(HANDOVER, 'f_plan');
    fake.seed(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES, id, { ...docs(COLLECTIONS.PROPERTY_HANDOVER_DELIVERIES)[id], sourceObject: null });
    expect(await unproven()).toEqual([expect.objectContaining({ offer: { kind: 'close', cause: 'source-unlocated' } })]);
    expect(await close()).toEqual({ kind: 'closed' });
    expect(ledgerRow('f_plan')?.closure).toMatchObject({ cause: 'source-unlocated' });
  });

  it('🔴 Ζ90 — η παράδοση ΑΝΑΚΛΗΘΗΚΕ ανάμεσα στη μέτρηση και τη συναλλαγή ⇒ ο γραφέας αρνείται `not-owed`', async () => {
    await loseForever();
    fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, HANDOVER, { ...docs(COLLECTIONS.PROPERTY_HANDOVERS)[HANDOVER], lifecycle: 'withdrawn' });
    expect(await recordDeliveryClosure(db(), HANDOVER, {
      sourceFileId: 'f_plan', crc32c: 'crc_f_plan', size: 1000, cause: 'bytes-gone', reason: REASON, closedBy: 'uid_office',
    })).toEqual({ kind: 'refused', reason: 'not-owed' });
    expect(await close()).toEqual({ kind: 'refused', reason: 'not-owed' });
    expect(ledgerRow('f_plan')?.closure).toBeNull();
  });

  it('🔴 Ζ91 — ξένος ενοικιαστής ή άγνωστη γραμμή ⇒ `line-unknown` (καμία πληροφορία ύπαρξης), τίποτα δεν γράφεται', async () => {
    await loseForever();
    expect(await close({ companyId: 'comp_beta' })).toEqual({ kind: 'refused', reason: 'line-unknown' });
    expect(await close({ sourceFileId: 'f_nope' })).toEqual({ kind: 'refused', reason: 'line-unknown' });
    expect(ledgerRow('f_plan')?.closure).toBeNull();
  });

  it('🔴 Ζ92α — ο ΓΡΑΦΕΑΣ λύνει τη διατήρηση στην ΙΔΙΑ συναλλαγή — όχι το δίχτυ της συμφιλίωσης που τρέχει μετά', async () => {
    await loseForever(true);
    expect(isPreserved(docs(COLLECTIONS.FILES).f_plan ?? {})).toBe(true);
    expect(await recordDeliveryClosure(db(), HANDOVER, {
      sourceFileId: 'f_plan', crc32c: 'crc_f_plan', size: 1000, cause: 'bytes-gone', reason: REASON, closedBy: 'uid_office',
    })).toEqual({ kind: 'closed' });
    expect(isPreserved(docs(COLLECTIONS.FILES).f_plan ?? {})).toBe(false);
  });

  it('🔴 Ζ92 — το κλείσιμο ΛΥΝΕΙ τη διατήρηση της πηγής στην ίδια συναλλαγή (Ο24: κανένα κλειδωμένο υπόλοιπο) + ίχνος στο αρχείο', async () => {
    await loseForever(true);
    expect(isPreserved(docs(COLLECTIONS.FILES).f_plan ?? {})).toBe(true);
    await close();
    expect(isPreserved(docs(COLLECTIONS.FILES).f_plan ?? {})).toBe(false);
    expect(mockAudits.find((audit) => audit.action === 'handover_line_closure')).toMatchObject({
      fileId: 'f_plan', performedBy: 'uid_office', metadata: { handoverId: HANDOVER, cause: 'bytes-gone', reason: REASON },
    });
    // Το δίχτυ της διατήρησης δεν την ξαναβάζει σε κλεισμένη γραμμή.
    await deliver();
    expect(isPreserved(docs(COLLECTIONS.FILES).f_plan ?? {})).toBe(false);
  });
});

/** Ο κόσμος: ακίνητο με θέση στάθμευσης · κύριος φάκελος του αγοραστή · ολοκληρωμένη παράδοση · αρχεία με bytes. */
function seedWorld() {
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', commercialStatus: 'sold',
    commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'final_signed' },
    linkedSpaces: [{ spaceId: 'park_1', spaceType: 'parking' }],
  });
  fake.seed(COLLECTIONS.PARKING_SPACES, 'park_1', { number: 'P-12' });
  fake.seed(COLLECTIONS.PROPERTY_DOSSIERS, MAIN_DOSSIER, {
    userId: BUYER, label: 'Διαμέρισμα Α1', type: null, lifecycle: 'active', createdAt: AT, updatedAt: AT,
    origin: { kind: 'handover', handoverId: HANDOVER, issuerCompanyId: COMPANY, issuerName: 'Κατασκευαστική Άλφα', acceptedAt: AT, handoverLifecycle: 'ready' },
  });
  seedHandover();
  companyFile('f_plan', 'floorplans');
  companyFile('f_photo', 'photos');
  companyFile('f_park', 'photos', { type: 'parking_spot', id: 'park_1' });
  companyFile('f_invoice', 'invoices');
  companyFile('f_doc', 'documents');
}
