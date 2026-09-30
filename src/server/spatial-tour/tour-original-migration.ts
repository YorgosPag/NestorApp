import 'server-only';

/**
 * @fileoverview **Η ΜΕΤΑΒΑΣΗ ΤΩΝ ΠΡΩΤΟΤΥΠΩΝ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ ΣΤΗΝ ΕΕ** — `FileRecord` των λήψεων 360°, `legacy-default` →
 * `eu-originals` (ADR-895 Φ4 §7.5 · Α9). Το δίδυμο του `tour-media-migration` (πλακίδια) πάνω στον **ίδιο** μηχανισμό
 * (`server/storage/placement-copy`) — ό,τι διαφέρει είναι μόνο ο δείκτης (εγγραφή αρχείου αντί για περιήγηση).
 * @related `tour-residency-migration.ts` (η σειρά: πλακίδια → πρωτότυπα) · `file-record-core` (ο ΜΟΝΟΣ builder της μετάβασης)
 * @module server/spatial-tour/tour-original-migration
 *
 * 🔑 **Μονάδα τοποθεσίας = η περιήγηση** (ADR-895 §7.4): πρωτότυπο περνά **μόνο** αφού περάσουν τα πλακίδια. Ο ψήστης γράφει
 *   πλακίδια στον κάδο της **περιήγησης** ⇒ πρωτότυπο ΕΕ σε περιήγηση ΗΠΑ = παράγωγα ΕΕ στις ΗΠΑ. Το αντίστροφο ενδιάμεσο
 *   (πλακίδια ΕΕ, πρωτότυπο ΗΠΑ) είναι ακίνδυνο.
 * 🔑 **Όλα τα πρωτότυπα, και των αποσυρμένων λήψεων**: είναι αναντικατάστατα και δεν δείχνουν τίποτα κρυμμένο (αντίθετα με
 *   τα αποσυρμένα πλακίδια) — η κατοικία αφορά **κάθε** byte.
 * 🔑 **Χωρίς παράθυρο 404**: αντιγραφή → απόδειξη → **CAS** (θέση + `hash` + `ready` + όχι δέσμευση + περιήγηση ΕΕ) που γράφει
 *   **μαζί** θέση, νέο proxy URL και `placementTransition` → η πηγή μένει ανέπαφη ως τον καθαρισμό.
 * 🔴 **Δέσμευση ⇒ `refused`**: το rewrite δεν αντιγράφει holds — ποτέ αντίγραφο χωρίς κλείδωμα.
 * 🔴 **Καθαρισμός και για εκκαθαρισμένα**: το purge/GDPR μηδενίζει `storagePath` και σβήνει μόνο την τρέχουσα θέση· η πηγή
 *   βρίσκεται από το `placementTransition` και **φεύγει** χωρίς έλεγχο ισοτιμίας (τα bytes πρέπει να φύγουν ούτως ή άλλως).
 */

import type { File } from '@google-cloud/storage';
import { FieldValue, type CollectionReference, type DocumentReference, type Firestore } from 'firebase-admin/firestore';

import { FILE_STATUS } from '@/config/domain-constants';
import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS } from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { FILE_COLLECTION } from '@/lib/files/file-custody';
import { readFileRecord, readPlacementCleanupFacts, type PlacementCleanupFacts } from '@/lib/files/file-record-read';
import { FILE_STORAGE_PLACEMENT_LEGACY, fileStoragePlacementOf, type FileStoragePlacement } from '@/lib/files/file-storage-placement';
import { placementForNewFile } from '@/lib/files/new-file-placement';
import { spatialTourFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { custodyKindOfScope, custodyOnly } from '@/lib/workspace/custody-scope';
import { fileStorageBucket } from '@/server/files/file-record-bucket';
import { copyObjects, missingIn, sameObject, statObjects } from '@/server/storage/placement-copy';
import { recordFileAudit } from '@/services/file-audit-admin.service';
import { buildPlacementTransitionUpdate, buildSourceCleanedUpdate } from '@/services/file-record/file-record-core';
import { isFileHeld } from '@/services/file-record/file-purge-helpers';
import { buildProxyUrl } from '@/services/storage-admin/public-upload.service';
import type { FilePlacementTransition, FileRecord } from '@/types/file-record';
import type { SpatialTour } from '@/types/spatial-tour';

import { effectiveMediaPlacement } from './tour-media-store';

const logger = createModuleLogger('tour-original-migration');

/**
 * **Χάρη πριν σβηστεί η πηγή: 24 ώρες.** Ο proxy **δεν** ρωτά τη βάση — σερβίρει τον κάδο που λέει το `?placement=` του URL.
 * Όποιος φόρτωσε την εγγραφή πριν το CAS κρατά URL χωρίς λήξη (ανοιχτή καρτέλα, cache λίστας), άρα η χάρη μετριέται σε
 * «μια εργάσιμη μέρα», όχι στα 15′ των κουπονιών των πλακιδίων (`ACCESS_GRANT_TTL_SECONDS`), που **λήγουν**.
 */
export const ORIGINAL_SOURCE_GRACE_MS = 24 * 60 * 60 * 1000;

/** Ποιος γράφει στο ίχνος — ονομασμένος αυτοματισμός, όχι άνθρωπος. */
const MIGRATION_ACTOR = 'system:residency-migration';

const SOURCE_PLACEMENT: FileStoragePlacement = FILE_STORAGE_PLACEMENT_LEGACY;

/** Ο προορισμός **τον λέει ο ΕΝΑΣ κριτής πολιτικής** — πρωτότυπο λήψης περιήγησης ΕΕ. Καμία δεύτερη πολιτική εδώ. */
const targetPlacement = (): FileStoragePlacement =>
  placementForNewFile({ kind: 'tour-capture', ingestPlacement: TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS });

export type OriginalMigrationOutcome =
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'already-moved' | 'purged' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'refused'; readonly reason: 'held' | 'unreadable' | 'source-missing' | 'parity' | 'changed' }
  | { readonly kind: 'planned' | 'migrated'; readonly bytes: number; readonly copied: number };

export type OriginalCleanupOutcome =
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'not-migrated' | 'already-cleaned' | 'grace' }
  | { readonly kind: 'refused'; readonly reason: 'parity' | 'changed' }
  | { readonly kind: 'cleaned'; readonly deleted: number };

export type TourOriginalsOutcome<T> =
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'tiles-first' }
  | {
      readonly kind: 'done';
      readonly files: ReadonlyArray<{ readonly fileId: string; readonly outcome: T }>;
      /** Λήψεις που δεν διαβάστηκαν — το πρωτότυπό τους **δεν** κρίθηκε· αναφέρονται, δεν αποσιωπούνται. */
      readonly unreadableCaptures: readonly string[];
    };

interface TourContext {
  readonly tourRef: DocumentReference;
  readonly tour: SpatialTour;
  readonly files: CollectionReference;
  readonly fileIds: readonly string[];
  readonly unreadableCaptures: readonly string[];
}

async function loadTourContext(db: Firestore, tourRef: DocumentReference): Promise<TourContext | null> {
  const [tourSnap, captures] = await Promise.all([tourRef.get(), tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES).get()]);
  const tour = tourSnap.exists ? spatialTourFromDocument(tourSnap.data(), tourRef.id) : null;
  if (tour === null) return null;
  const parsed = captures.docs.map((doc) => ({ id: doc.id, capture: tourCaptureFromDocument(doc.data(), doc.id) }));
  const fileIds = parsed.flatMap(({ capture }) => (capture === null ? [] : [capture.originalFileId]));
  return {
    tourRef,
    tour,
    files: db.collection(COLLECTIONS[FILE_COLLECTION[custodyKindOfScope(tour.custody)]]),
    fileIds: [...new Set(fileIds)].sort(),
    unreadableCaptures: parsed.filter(({ capture }) => capture === null).map(({ id }) => id),
  };
}

const isTourInEu = (tour: SpatialTour): boolean => effectiveMediaPlacement(tour.mediaPlacement) === TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS;

/** Η εγγραφή όπως τη δίνει το **σύνορο ανάγνωσης** (CHECK 3.74) — ποτέ ωμή μετατροπή τύπου. */
export type OriginalRecordRead =
  | { readonly kind: 'record'; readonly record: FileRecord }
  | { readonly kind: 'missing' | 'purged' | 'unreadable' };

interface SnapshotLike { readonly exists: boolean; readonly id: string; data(): unknown }

/** Διαδρομή που θα **γράψει** ⇒ η φρουρημένη πόρτα `readFileRecord` (`unreadable` ⇒ άρνηση, ADR-862). */
function readForMigration(snap: SnapshotLike): OriginalRecordRead {
  if (!snap.exists) return { kind: 'missing' };
  const raw = snap.data();
  if (readPlacementCleanupFacts(raw)?.purged) return { kind: 'purged' };
  const read = readFileRecord(raw, snap.id);
  return read.outcome === 'record' ? { kind: 'record', record: read.record } : { kind: 'unreadable' };
}

/** **Καθαρό**: μπορεί αυτή η εγγραφή να μεταβεί **τώρα**; `null` = ναι. Ίδιος κριτής πριν την αντιγραφή **και** μέσα στο CAS. */
export function originalMigrationBlocker(read: OriginalRecordRead): OriginalMigrationOutcome | null {
  if (read.kind === 'missing' || read.kind === 'purged') return { kind: 'skipped', reason: read.kind };
  if (read.kind === 'unreadable') return { kind: 'refused', reason: 'unreadable' };
  const { record } = read;
  if (fileStoragePlacementOf(record) !== SOURCE_PLACEMENT) return { kind: 'skipped', reason: 'already-moved' };
  if (record.status !== FILE_STATUS.READY) return { kind: 'busy' };
  if (isFileHeld(record)) return { kind: 'refused', reason: 'held' };
  return null;
}

/**
 * **CAS της θέσης** — ξαναδιαβάζει εγγραφή **και** περιήγηση μέσα στη συναλλαγή: ίδιος κριτής, **ίδιο** `hash` και μονοπάτι με όσα
 * αποδείχθηκαν, περιήγηση ήδη στην ΕΕ. Οτιδήποτε άλλο ⇒ `false`, τίποτα δεν γράφεται (ξανατρέξε).
 */
async function flipOriginal(db: Firestore, ctx: TourContext, fileRef: DocumentReference, verified: FileRecord): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const [fileSnap, tourSnap] = await Promise.all([tx.get(fileRef), tx.get(ctx.tourRef)]);
    const read = readForMigration(fileSnap);
    const tour = tourSnap.exists ? spatialTourFromDocument(tourSnap.data(), ctx.tourRef.id) : null;
    if (read.kind !== 'record' || originalMigrationBlocker(read) !== null || tour === null || !isTourInEu(tour)) return false;
    const now = read.record;
    if (now.hash !== verified.hash || now.storagePath !== verified.storagePath) return false;
    const to = targetPlacement();
    const patch = buildPlacementTransitionUpdate({
      storagePath: now.storagePath, from: SOURCE_PLACEMENT, to, downloadUrl: buildProxyUrl(now.storagePath, to), changedAt: nowISO(),
    });
    tx.update(fileRef, { ...patch, updatedAt: FieldValue.serverTimestamp() });
    return true;
  });
}

/** Μία εγγραφή: κριτής → πηγή → ό,τι λείπει → (ξηρό: σχέδιο) → αντιγραφή → απόδειξη → CAS → ίχνος. */
async function migrateOriginal(db: Firestore, ctx: TourContext, fileId: string, apply: boolean): Promise<OriginalMigrationOutcome> {
  const fileRef = ctx.files.doc(fileId);
  const read = readForMigration(await fileRef.get());
  const blocker = originalMigrationBlocker(read);
  if (blocker !== null || read.kind !== 'record') return blocker ?? { kind: 'skipped', reason: 'missing' };
  const { record } = read;
  const source = await statObjects(fileStorageBucket(SOURCE_PLACEMENT), [record.storagePath]);
  if (source.length === 0) return { kind: 'refused', reason: 'source-missing' };
  const target = fileStorageBucket(targetPlacement());
  const toCopy = await missingIn(target, [record.storagePath], source);
  const bytes = Number(source[0].metadata.size ?? 0);
  if (!apply) return { kind: 'planned', bytes, copied: toCopy.length };
  await copyObjects(toCopy, target);
  if ((await missingIn(target, [record.storagePath], source)).length > 0) return { kind: 'refused', reason: 'parity' };
  if (!(await flipOriginal(db, ctx, fileRef, record))) return { kind: 'refused', reason: 'changed' };
  await recordFileAudit({
    fileId, action: 'storage_relocate', performedBy: MIGRATION_ACTOR, ...custodyOnly(ctx.tour.custody),
    metadata: { from: SOURCE_PLACEMENT, to: targetPlacement(), tourId: ctx.tourRef.id },
  });
  logger.warn('Πρωτότυπο πανοράματος μετακινήθηκε στον κάδο της ΕΕ', { tourId: ctx.tourRef.id, fileId, bytes, copied: toCopy.length });
  return { kind: 'migrated', bytes, copied: toCopy.length };
}

/** Ξηρό (`apply: false`) = σχέδιο + μέτρηση ανά αρχείο· `apply: true` μόνο αφού η περιήγηση είναι ήδη στην ΕΕ. */
export async function migrateTourOriginals(
  db: Firestore, tourRef: DocumentReference, apply: boolean,
): Promise<TourOriginalsOutcome<OriginalMigrationOutcome>> {
  const ctx = await loadTourContext(db, tourRef);
  if (ctx === null) return { kind: 'skipped', reason: 'missing' };
  if (apply && !isTourInEu(ctx.tour)) return { kind: 'skipped', reason: 'tiles-first' };
  const files: Array<{ fileId: string; outcome: OriginalMigrationOutcome }> = [];
  for (const fileId of ctx.fileIds) files.push({ fileId, outcome: await migrateOriginal(db, ctx, fileId, apply) });
  return { kind: 'done', files, unreadableCaptures: ctx.unreadableCaptures };
}

/** Η πηγή υπάρχει πανομοιότυπη στην τρέχουσα θέση; (το μονοπάτι μπορεί να άλλαξε από τότε — συγκρίνεται με το ΤΡΕΧΟΝ). */
async function sourceStillCovered(facts: PlacementCleanupFacts, source: readonly File[]): Promise<boolean> {
  if (source.length === 0) return true;
  if (facts.storagePath === null) return false;
  const [current] = await statObjects(fileStorageBucket(fileStoragePlacementOf(facts)), [facts.storagePath]);
  return current !== undefined && sameObject(source[0], current);
}

const cleanupFactsOf = (snap: { readonly exists: boolean; data(): unknown }): PlacementCleanupFacts | null =>
  (snap.exists ? readPlacementCleanupFacts(snap.data()) : null);

/** Σημειώνει τον καθαρισμό — CAS: η ίδια μετάβαση, ακόμη εκκρεμής. */
async function markSourceCleaned(db: Firestore, fileRef: DocumentReference, transition: FilePlacementTransition): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const now = cleanupFactsOf(await tx.get(fileRef))?.transition;
    if (!now || now.changedAt !== transition.changedAt || now.sourceCleanedAt !== undefined) return false;
    tx.update(fileRef, buildSourceCleanedUpdate(nowISO()));
    return true;
  });
}

/** Μία εγγραφή: μόνο με εκκρεμή μετάβαση, μετά τη χάρη, με νέα απόδειξη (εκτός αν εκκαθαρίστηκε — τότε φεύγει ούτως ή άλλως). */
async function cleanupOriginal(db: Firestore, ctx: TourContext, fileId: string, nowMs: number): Promise<OriginalCleanupOutcome> {
  const fileRef = ctx.files.doc(fileId);
  const facts = cleanupFactsOf(await fileRef.get());
  if (facts === null) return { kind: 'skipped', reason: 'missing' };
  const { transition } = facts;
  if (transition === null) return { kind: 'skipped', reason: 'not-migrated' };
  if (transition.sourceCleanedAt !== undefined) return { kind: 'skipped', reason: 'already-cleaned' };
  if (nowMs - Date.parse(transition.changedAt) < ORIGINAL_SOURCE_GRACE_MS) return { kind: 'skipped', reason: 'grace' };
  const source = await statObjects(fileStorageBucket(transition.from), [transition.sourcePath]);
  if (!facts.purged) {
    if (fileStoragePlacementOf(facts) === transition.from) return { kind: 'refused', reason: 'changed' };
    if (!(await sourceStillCovered(facts, source))) return { kind: 'refused', reason: 'parity' };
  }
  for (const file of source) await file.delete({ ignoreNotFound: true });
  if (!(await markSourceCleaned(db, fileRef, transition))) return { kind: 'refused', reason: 'changed' };
  logger.warn('Πηγή πρωτοτύπου σβήστηκε από τον παλιό κάδο', { tourId: ctx.tourRef.id, fileId, deleted: source.length });
  return { kind: 'cleaned', deleted: source.length };
}

/** Καθαρισμός των πηγών όλων των πρωτοτύπων μιας περιήγησης — ανεξάρτητα από την κατάσταση των πλακιδίων. */
export async function cleanupTourOriginals(
  db: Firestore, tourRef: DocumentReference, nowMs: number = Date.now(),
): Promise<TourOriginalsOutcome<OriginalCleanupOutcome>> {
  const ctx = await loadTourContext(db, tourRef);
  if (ctx === null) return { kind: 'skipped', reason: 'missing' };
  const files: Array<{ fileId: string; outcome: OriginalCleanupOutcome }> = [];
  for (const fileId of ctx.fileIds) files.push({ fileId, outcome: await cleanupOriginal(db, ctx, fileId, nowMs) });
  return { kind: 'done', files, unreadableCaptures: ctx.unreadableCaptures };
}
