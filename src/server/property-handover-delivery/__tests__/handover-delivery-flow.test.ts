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
import { handoverCopyFileIdOf, handoverDossierIdOf, propertyHandoverIdOf } from '@/lib/property-handover/property-handover-id';
import { deliverHandoverFiles, type HandoverFileDeliveryRecorder } from '@/server/property-handover-delivery/handover-delivery.server';
import { recordDeliverySha256 } from '@/server/property-handover-delivery/handover-delivery-ledger.server';
import { runPropertyHandoverDeliveryQueue } from '@/services/property-handover/property-handover-delivery-queue.service';
import { previewPropertyHandover } from '@/services/property-handover/property-handover-preview.server';
import { recordHandoverFileDelivery } from '@/services/property-handover/property-handover-write.service';
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
