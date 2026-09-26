import 'server-only';

/**
 * @fileoverview **ΑΝΕΒΑΣΜΑ ΛΗΨΗΣ 360° — Η ΟΛΟΚΛΗΡΩΣΗ**: καραντίνα → κρίση bytes → κανονικό αρχείο → λήψη.
 * @related ADR-884 Φ0.8 · Φ0.14 · §4.5 (Κ3α) · `tour-capture-upload.ts` (η έναρξη)
 * @module server/spatial-tour/tour-capture-finalize
 *
 * 🔑 **Ξανακρίνει τα πάντα** — το εισιτήριο λέει **τι** ζητήθηκε, όχι ότι **ακόμη** επιτρέπεται: η άδεια του
 * φωτογράφου μπορεί να ανακλήθηκε ανάμεσα, η αγγελία να άλλαξε χέρια (§4.4).
 *
 * 🏆 **Ιδεμπότητη από κατασκευή**: το id της λήψης **και** του αρχείου **παράγονται** από το id ανεβάσματος. Διπλό
 * κλικ, επανάληψη δικτύου ή δύο καρτέλες ⇒ **ίδιο** έγγραφο αρχείου, **ίδια** διαδρομή, **μία** λήψη.
 *
 * ⚠️ **Σειρά εγγραφών** (πρότυπο της διαδρομής μοντέλου, ADR-845): `FileRecord` PENDING **πρώτα** (είναι το
 * claim απέναντι στο `orphan-cleanup`, που σβήνει ό,τι δεν διεκδικείται σε ~2″) → αντιγραφή στο GCS (server-side,
 * τα bytes δεν ξαναπερνούν) → READY → λήψη. Ο αναγνώστης φιλτράρει READY, άρα μισό ανέβασμα είναι **αόρατο**.
 */

import { createHash } from 'node:crypto';

import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES, FILE_CATEGORIES, FILE_DOMAINS, FILE_STATUS } from '@/config/domain-constants';
import { isTourCaptureAudience, isTourMilestone } from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { FieldValue, getAdminBucket } from '@/lib/firebaseAdmin';
import { readMediaRights } from '@/lib/media-rights/media-rights-read';
import { PANORAMA_CONTENT_TYPE, judgePanorama } from '@/lib/spatial-tour/panorama-policy';
import { tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import type { TourActor } from '@/lib/spatial-tour/tour-authority';
import { checkTourCapture } from '@/lib/spatial-tour/tour-capture-invariants';
import { createModuleLogger } from '@/lib/telemetry';
import { isRecord } from '@/lib/type-guards';
import { custodyKindOfScope, custodyOnly, isOwnedByCustody, type CustodyScope } from '@/lib/workspace/custody-scope';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { buildFinalizeFileRecordUpdate, buildPendingFileRecordData } from '@/services/file-record';
import { buildProxyUrl } from '@/services/storage-admin/public-upload.service';
import type { MediaRights } from '@/types/media-rights';
import type { TourCapture } from '@/types/spatial-tour';
import type { TourCaptureAudience, TourMilestone } from '@/constants/spatial-tour-vocabulary';

import { readPanoramaFacts } from './panorama-facts';
import {
  judgeUploader,
  tourIngestPath,
  type TourUploadRefusal,
  type TourUploadRefused,
  type TourUploadUnavailable,
} from './tour-capture-upload';
import { readTourUploadTicket, type TourUploadTicket } from './tour-upload-ticket';

const logger = createModuleLogger('tour-capture-finalize');

/** Οι πηγές που φτάνουν **με ανέβασμα** — η απόδοση BIM (`bim-render`) τη γεννά μόνο ο ψήστης της Φ3. */
const UPLOAD_SOURCES = ['camera-360', 'phone'] as const;
type UploadSource = (typeof UPLOAD_SOURCES)[number];
const MAX_FILENAME = 255;

/** Ό,τι δηλώνει ο άνθρωπος για τη λήψη — τα υπόλοιπα (κατεύθυνση · ημερομηνία) τα λένε τα **bytes**. */
export interface TourCaptureDeclaration {
  readonly source: UploadSource;
  readonly audience: TourCaptureAudience;
  readonly milestone: TourMilestone | null;
  readonly rights: MediaRights;
  readonly originalFilename: string | null;
}

/**
 * **Η δήλωση, ή `null`.** Τα δικαιώματα κρίνονται από τον **ίδιο** αναγνώστη που διαβάζει τη λήψη (`readMediaRights`)
 * — δήλωση που δεν θα διαβαζόταν μετά δεν γράφεται ποτέ. 🔴 Δημιουργός με λογαριασμό = **μόνο** ο δράστης: κανείς
 * δεν αποδίδει φωτογραφία σε **άλλον** λογαριασμό (ο εξωτερικός φωτογράφος δηλώνεται με όνομα, `userId: null`).
 */
export function readCaptureDeclaration(raw: unknown, actorUid: string): TourCaptureDeclaration | null {
  if (!isRecord(raw)) return null;
  const source = UPLOAD_SOURCES.find((s) => s === raw.source);
  const milestone = raw.milestone ?? null;
  const rights = readMediaRights(raw.rights);
  if (source === undefined || !isTourCaptureAudience(raw.audience) || rights === null) return null;
  if (milestone !== null && !isTourMilestone(milestone)) return null;
  if (rights.creator.userId !== null && rights.creator.userId !== actorUid) return null;
  const name = typeof raw.originalFilename === 'string' ? raw.originalFilename.trim().slice(0, MAX_FILENAME) : '';
  return { source, audience: raw.audience, milestone, rights, originalFilename: name.length > 0 ? name : null };
}

export interface FinalizeTourCaptureUploadInput {
  readonly ticket: string;
  readonly actor: TourActor;
  readonly declaration: unknown;
}

export type FinalizeTourCaptureUploadOutcome =
  | { readonly kind: 'finalized'; readonly capture: TourCapture; readonly replayed: boolean }
  | TourUploadRefused
  | TourUploadUnavailable;

const refuse = (reason: TourUploadRefusal): TourUploadRefused => ({ kind: 'refused', reason });

/** **Ολοκλήρωσε ανέβασμα λήψης.** */
export async function finalizeTourCaptureUpload(
  db: Firestore,
  input: FinalizeTourCaptureUploadInput,
): Promise<FinalizeTourCaptureUploadOutcome> {
  const reading = readTourUploadTicket(input.ticket, Date.now());
  if (reading.kind === 'secret-missing') return { kind: 'unavailable', reason: 'secret-missing' };
  if (reading.kind === 'invalid') return refuse('ticket-invalid');
  const { ticket } = reading;
  if (ticket.uploaderUid !== input.actor.listing.uid) return refuse('ticket-foreign');
  const declaration = readCaptureDeclaration(input.declaration, input.actor.listing.uid);
  if (declaration === null) return refuse('declaration-invalid');

  const standing = await judgeUploader(db, ticket.subject, input.actor, false);
  if ('kind' in standing) return standing;
  if (!isOwnedByCustody(ticket.custody, standing.custody)) return refuse('tour-custody-mismatch');

  const captureRef = standing.tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES)
    .doc(enterpriseIdService.generateDeterministicTourCaptureIdForUpload(ticket.uploadId));
  const replay = await readExistingCapture(captureRef);
  if (replay !== null) return { kind: 'finalized', capture: replay, replayed: true };

  return finalizeFromQuarantine(db, {
    ticket, declaration, custody: standing.custody, tourRef: standing.tourRef, captureRef, label: standing.label,
  });
}

async function readExistingCapture(captureRef: DocumentReference): Promise<TourCapture | null> {
  const snap = await captureRef.get();
  return snap.exists ? tourCaptureFromDocument(snap.data(), captureRef.id) : null;
}

interface FinalizeContext {
  readonly ticket: TourUploadTicket;
  readonly declaration: TourCaptureDeclaration;
  readonly custody: CustodyScope;
  readonly tourRef: DocumentReference;
  readonly captureRef: DocumentReference;
  /** Η ετικέτα του ακινήτου — στο όνομα του αρχείου. */
  readonly label: string | null;
}

/** Τα bytes της καραντίνας — ακριβώς όσα δηλώθηκαν, αλλιώς ονομασμένη άρνηση. */
async function readQuarantine(ctx: FinalizeContext): Promise<Buffer | TourUploadRefused> {
  const object = getAdminBucket().file(tourIngestPath(ctx.tourRef.id, ctx.ticket.uploadId));
  const [exists] = await object.exists();
  if (!exists) return refuse('upload-missing');
  const [metadata] = await object.getMetadata();
  if (Number(metadata.size) !== ctx.ticket.contentLength) return refuse('upload-incomplete');
  const [bytes] = await object.download();
  return bytes;
}

async function discardQuarantine(ctx: FinalizeContext): Promise<void> {
  await getAdminBucket().file(tourIngestPath(ctx.tourRef.id, ctx.ticket.uploadId)).delete({ ignoreNotFound: true });
}

async function finalizeFromQuarantine(db: Firestore, ctx: FinalizeContext): Promise<FinalizeTourCaptureUploadOutcome> {
  const bytes = await readQuarantine(ctx);
  if (!Buffer.isBuffer(bytes)) return bytes;
  const facts = await readPanoramaFacts(bytes);
  const verdict = judgePanorama(facts);
  if (!verdict.ok) {
    // Ό,τι απορρίφθηκε δεν μένει στην καραντίνα ούτε μέχρι τον κανόνα κύκλου ζωής.
    await discardQuarantine(ctx);
    return refuse(verdict.refusal);
  }
  const contentHash = createHash('sha256').update(bytes).digest('hex');
  const fileId = await persistOriginal(db, ctx, bytes.byteLength, contentHash);
  const doc = captureDocument(ctx, { fileId, contentHash, headingRad: verdict.headingRad, takenAt: facts.takenAt });
  const written = await writeCaptureOnce(db, ctx.captureRef, doc);
  await discardQuarantine(ctx);
  await recordFileAudit({
    fileId, action: 'upload', performedBy: ctx.ticket.uploaderUid, ...custodyOnly(ctx.custody),
    metadata: { tourId: ctx.tourRef.id, captureId: ctx.captureRef.id },
  });
  logger.info('Λήψη 360° ολοκληρώθηκε', { tourId: ctx.tourRef.id, captureId: ctx.captureRef.id, fileId, bytes: bytes.byteLength });
  return { kind: 'finalized', capture: written, replayed: false };
}

/** Το `FileRecord` του πρωτοτύπου — PENDING (claim) → αντιγραφή → READY. Επιστρέφει το (παραγόμενο) id. */
async function persistOriginal(db: Firestore, ctx: FinalizeContext, sizeBytes: number, contentHash: string): Promise<string> {
  const { ticket, custody } = ctx;
  const { fileId, storagePath, recordBase } = buildPendingFileRecordData({
    ...custodyOnly(custody),
    entityType: ticket.subject.kind === 'owner-property' ? ENTITY_TYPES.OWNER_PROPERTY : ENTITY_TYPES.PROPERTY,
    entityId: ticket.subject.id,
    domain: FILE_DOMAINS.SALES,
    category: FILE_CATEGORIES.PANORAMAS,
    originalFilename: ctx.declaration.originalFilename ?? `${ctx.captureRef.id}.jpg`,
    contentType: PANORAMA_CONTENT_TYPE,
    createdBy: ticket.uploaderUid,
    ext: 'jpg',
    // 🔴 Κ3β: ΧΩΡΙΣ `purpose` — δεν είναι είδος σπουδής (`STUDY_ENTRIES`), και ο διακομιστής δεν έχει μεταφραστή:
    //    το `purpose: 'panorama'` έγραφε «panoramas panorama». Σύμβαση `model-file-record` / `version-promotion`:
    //    μόνο κατηγορία (την μεταφράζει η οθόνη, `useFileDisplayName`) + η ετικέτα του ακινήτου.
    ...(ctx.label !== null ? { entityLabel: ctx.label } : {}),
    fileId: enterpriseIdService.generateDeterministicFileId(`tour-upload:${ticket.uploadId}`),
  });
  const fileRef = db.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(custody)]]).doc(fileId);
  await fileRef.set({ ...recordBase, createdAt: FieldValue.serverTimestamp() });
  await getAdminBucket().file(tourIngestPath(ctx.tourRef.id, ticket.uploadId)).copy(getAdminBucket().file(storagePath));
  await fileRef.update({
    ...buildFinalizeFileRecordUpdate({ sizeBytes, downloadUrl: buildProxyUrl(storagePath), hash: contentHash, nextStatus: FILE_STATUS.READY }),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return fileId;
}

/** Το έγγραφο της λήψης όπως αποθηκεύεται. 🔑 **Χωρίς `id`**: η ταυτότητα έρχεται από τη διαδρομή και νικά (σύνορο ανάγνωσης). */
type TourCaptureDocument = Omit<TourCapture, 'id'>;

/** Η λήψη — **ατοποθέτητη** (`nodeId: null`, Φ2 την τοποθετεί) · `as-built` · πλακίδια σε αναμονή. */
function captureDocument(
  ctx: FinalizeContext,
  from: { readonly fileId: string; readonly contentHash: string; readonly headingRad: number; readonly takenAt: string | null },
): TourCaptureDocument {
  const at = nowISO();
  return {
    tourId: ctx.tourRef.id,
    nodeId: null,
    capturedAt: from.takenAt ?? at,
    headingRad: from.headingRad,
    source: ctx.declaration.source,
    provenance: 'as-built',
    baseCaptureId: null,
    signatory: null,
    audience: ctx.declaration.audience,
    milestone: ctx.declaration.milestone,
    originalFileId: from.fileId,
    rights: ctx.declaration.rights,
    tileset: { state: 'pending', contentHash: from.contentHash },
    uploadedBy: ctx.ticket.uploaderUid,
    createdAt: at,
  };
}

/** **Create-if-absent σε συναλλαγή** — δύο ταυτόχρονες ολοκληρώσεις ⇒ μία λήψη, και η δεύτερη παίρνει την πρώτη. */
async function writeCaptureOnce(db: Firestore, captureRef: DocumentReference, doc: TourCaptureDocument): Promise<TourCapture> {
  const capture: TourCapture = { id: captureRef.id, ...doc };
  const violations = checkTourCapture(capture, null);
  // Αδύνατο για `as-built` χωρίς βάση — αν ποτέ συμβεί, είναι βλάβη του γραφέα, όχι άρνηση του ανθρώπου.
  if (violations.length > 0) throw new Error(`Tour capture violates invariants: ${violations.map((v) => v.kind).join(',')}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(captureRef);
    const existing = snap.exists ? tourCaptureFromDocument(snap.data(), captureRef.id) : null;
    if (existing !== null) return existing;
    tx.create(captureRef, doc);
    return capture;
  });
}

