import 'server-only';

/**
 * @fileoverview **Η ΜΕΤΑΒΑΣΗ ΤΩΝ ΜΕΣΩΝ ΜΙΑΣ ΠΕΡΙΗΓΗΣΗΣ ΣΤΗΝ ΕΕ** — `legacy-default` (US) → `tour-eu` (ADR-884 Φ2ζ ζ5 · §12 Δ11).
 * @related `tour-media-store.ts` (ο ΕΝΑΣ επιλογέας κάδου) · `tour-tileset-baker.ts` (ο συγγραφέας των πλακιδίων) ·
 *   `tour-view-grant.ts` (η θέση μέσα στο κουπόνι) · `scripts/migrations/migrate-tour-media-to-eu.ts` (ο ΜΟΝΟΣ καλών)
 * @module server/spatial-tour/tour-media-migration
 *
 * 🧩 Ο μηχανισμός αντιγραφής/απόδειξης ζει στο `server/storage/placement-copy` (ADR-895 Α9 — γενίκευση, όχι αντίγραφο)·
 *   εδώ μένει ό,τι είναι ειδικό για πλακίδια: manifest ζωντανών κλειδιών, CAS του `mediaPlacement`, καθαρισμός προθέματος.
 * 🏆 **Αντιγραφή bytes, όχι επανα-ψήση**: GCS rewrite **μέσα στο Google** (κανένα κατέβασμα), ίδια bytes, ίδια metadata, επαλήθευση
 * **crc32c + μέγεθος** ανά αντικείμενο. Καμία απόκλιση απόδοσης ή έκδοσης ανιχνευτή — και η επόμενη επανα-ψήση γίνεται ήδη στην ΕΕ.
 * 🔒 **Μόνο τα ΖΩΝΤΑΝΑ κλειδιά**: `tileset.contentHash` λήψεων `ready` + παράγωγα κατόψεων. Ποτέ αποσυρμένα/ορφανά — δείχνουν ό,τι
 * ζητήθηκε να κρυφτεί (Φ2ζ). Φεύγουν με τον καθαρισμό του παλιού κάδου.
 * 🔑 **Χωρίς παράθυρο 404**: αντιγραφή → επαλήθευση → **CAS** θέσης (συναλλαγή: ίδια κλειδιά, καμία λήψη `pending`) → δίχτυ →
 * καθαρισμός **μόνο** αφού λήξουν τα κουπόνια που δείχνουν ακόμα τον παλιό κάδο (`ACCESS_GRANT_TTL_SECONDS`).
 * 🔑 **Όχι `revision + 1`**: υποδομή, όχι γράφος — μια αύξηση θα απέρριπτε ανοιχτή επεξεργασία του υπευθύνου.
 */

import type { Bucket, File } from '@google-cloud/storage';
import type { DocumentReference, Firestore, QuerySnapshot } from 'firebase-admin/firestore';

import { SUBCOLLECTIONS } from '@/config/firestore-collections';
import { TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS, TOUR_MEDIA_PLACEMENT_LEGACY } from '@/constants/spatial-tour-vocabulary';
import { nowISO } from '@/lib/date-local';
import { spatialTourFromDocument, tourCaptureFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { TOUR_TILES_ROOT } from '@/lib/spatial-tour/tour-media-path';
import { createModuleLogger } from '@/lib/telemetry';
import { ACCESS_GRANT_TTL_SECONDS } from '@/server/access-grant/access-grant';
import { copyObjects, listObjects, missingIn } from '@/server/storage/placement-copy';
import type { SpatialTour, TourCapture } from '@/types/spatial-tour';

import { effectiveMediaPlacement, tourMediaBucket } from './tour-media-store';

const logger = createModuleLogger('tour-media-migration');

/** Ό,τι μετακινείται: ζωντανά κλειδιά πλακιδίων + παράγωγα κατόψεων. `unservable` = `ready` χωρίς `faceSize` (παλιά διάταξη). */
export interface TourMediaManifest {
  readonly tileKeys: readonly string[];
  readonly planHashes: readonly string[];
  readonly unservable: readonly string[];
}

export type TourMediaMigrationOutcome =
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'already-eu' | 'busy' }
  | { readonly kind: 'planned' | 'migrated'; readonly manifest: TourMediaManifest; readonly objects: number; readonly bytes: number; readonly copied: number }
  | { readonly kind: 'refused'; readonly reason: 'parity' | 'changed'; readonly missing: readonly string[] };

export type TourMediaCleanupOutcome =
  | { readonly kind: 'skipped'; readonly reason: 'missing' | 'not-migrated' | 'grace' | 'busy' }
  | { readonly kind: 'refused'; readonly reason: 'parity'; readonly missing: readonly string[] }
  | { readonly kind: 'cleaned'; readonly deleted: number };

const legacyBucket = (): Bucket => tourMediaBucket(TOUR_MEDIA_PLACEMENT_LEGACY);
const euBucket = (): Bucket => tourMediaBucket(TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS);

/** **Καθαρό**: τι είναι ζωντανό. `pending` ⇒ `null` (ο ψήστης δουλεύει — κανένα σχέδιο πάνω σε κινούμενο στόχο). */
export function tourMediaManifest(tour: SpatialTour, captures: readonly TourCapture[]): TourMediaManifest | null {
  if (captures.some((capture) => capture.tileset.state === 'pending')) return null;
  const ready = captures.filter((capture) => capture.tileset.state === 'ready' && capture.tileset.contentHash !== null);
  const servable = ready.filter((capture) => capture.tileset.faceSize !== null);
  const planHashes = tour.levels.flatMap((level) => level.floorPlans.flatMap((plan) => (plan.image ? [plan.image.contentHash] : [])));
  return {
    tileKeys: [...new Set(servable.map((capture) => capture.tileset.contentHash as string))].sort(),
    planHashes: [...new Set(planHashes)].sort(),
    unservable: ready.filter((capture) => capture.tileset.faceSize === null).map((capture) => capture.id).sort(),
  };
}

/** Τα προθέματα του manifest μέσα στο `tour-tiles/{tourId}/`. */
function manifestPrefixes(tourId: string, manifest: TourMediaManifest): string[] {
  const root = `${TOUR_TILES_ROOT}/${tourId}`;
  return [...manifest.tileKeys.map((key) => `${root}/${key}/`), ...manifest.planHashes.map((hash) => `${root}/plans/${hash}/`)];
}

/** Όσα αντικείμενα της πηγής **δεν** υπάρχουν πανομοιότυπα στον EU — μία λίστα ανά πρόθεμα του manifest (ADR-895 Α9: γενικός πυρήνας). */
const missingInEu = (prefixes: readonly string[], source: readonly File[]): Promise<File[]> => missingIn(euBucket(), prefixes, source);

/** Η πηγή (US) και ό,τι της λείπει στον EU, για ένα manifest. */
async function compareBuckets(tourId: string, manifest: TourMediaManifest): Promise<{ source: File[]; missing: File[] }> {
  const prefixes = manifestPrefixes(tourId, manifest);
  const source = await listObjects(legacyBucket(), prefixes);
  return { source, missing: await missingInEu(prefixes, source) };
}

/** GCS rewrite (γενικός πυρήνας: καρφωμένη γενιά, χωρίς download token) — ιδεμπότητο: ο καλών δίνει μόνο ό,τι λείπει. */
const copyToEu = (files: readonly File[]): Promise<void> => copyObjects(files, euBucket());

interface TourSnapshot {
  readonly tour: SpatialTour;
  readonly captures: readonly TourCapture[];
}

function readSnapshot(tourRef: DocumentReference, tourData: unknown, captures: QuerySnapshot): TourSnapshot | null {
  const tour = spatialTourFromDocument(tourData, tourRef.id);
  if (tour === null) return null;
  const parsed = captures.docs.map((doc) => tourCaptureFromDocument(doc.data(), doc.id));
  return { tour, captures: parsed.filter((capture): capture is TourCapture => capture !== null) };
}

async function loadSnapshot(tourRef: DocumentReference): Promise<TourSnapshot | null> {
  const [tourSnap, captures] = await Promise.all([tourRef.get(), tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES).get()]);
  return tourSnap.exists ? readSnapshot(tourRef, tourSnap.data(), captures) : null;
}

const sameKeys = (a: TourMediaManifest, b: TourMediaManifest): boolean =>
  a.tileKeys.join() === b.tileKeys.join() && a.planHashes.join() === b.planHashes.join();

/**
 * **CAS της θέσης** — ξαναδιαβάζει περιήγηση + λήψεις μέσα στη συναλλαγή: ακόμη legacy, καμία `pending`, **ίδια** ζωντανά κλειδιά
 * με όσα επαληθεύτηκαν. Οτιδήποτε άλλο ⇒ `false` (τίποτα δεν γράφεται — ξανατρέξε).
 */
async function flipPlacement(db: Firestore, tourRef: DocumentReference, verified: TourMediaManifest): Promise<boolean> {
  return db.runTransaction(async (tx) => {
    const [tourSnap, captures] = await Promise.all([tx.get(tourRef), tx.get(tourRef.collection(SUBCOLLECTIONS.TOUR_CAPTURES))]);
    const snapshot = tourSnap.exists ? readSnapshot(tourRef, tourSnap.data(), captures) : null;
    if (snapshot === null || effectiveMediaPlacement(snapshot.tour.mediaPlacement) !== TOUR_MEDIA_PLACEMENT_LEGACY) return false;
    const now = tourMediaManifest(snapshot.tour, snapshot.captures);
    if (now === null || !sameKeys(now, verified)) return false;
    tx.update(tourRef, { mediaPlacement: TOUR_MEDIA_PLACEMENT_FOR_NEW_TOURS, mediaPlacementChangedAt: nowISO() });
    return true;
  });
}

/** **Δίχτυ μετά το CAS**: ό,τι ζωντανό δεν είναι στον EU (π.χ. ψήθηκε στο US ακριβώς πριν) αντιγράφεται — ο US δεν έχει σβηστεί. */
async function healAfterFlip(tourRef: DocumentReference): Promise<number> {
  const snapshot = await loadSnapshot(tourRef);
  const manifest = snapshot && tourMediaManifest(snapshot.tour, snapshot.captures);
  if (!manifest) return 0;
  const { missing } = await compareBuckets(tourRef.id, manifest);
  await copyToEu(missing);
  return missing.length;
}

/** Ξηρό (`apply: false`) = σχέδιο + μέτρηση· `apply: true` = αντιγραφή → επαλήθευση → CAS → δίχτυ. */
export async function migrateTourMedia(db: Firestore, tourRef: DocumentReference, apply: boolean): Promise<TourMediaMigrationOutcome> {
  const snapshot = await loadSnapshot(tourRef);
  if (snapshot === null) return { kind: 'skipped', reason: 'missing' };
  if (effectiveMediaPlacement(snapshot.tour.mediaPlacement) !== TOUR_MEDIA_PLACEMENT_LEGACY) return { kind: 'skipped', reason: 'already-eu' };
  const manifest = tourMediaManifest(snapshot.tour, snapshot.captures);
  if (manifest === null) return { kind: 'skipped', reason: 'busy' };
  const { source, missing: toCopy } = await compareBuckets(tourRef.id, manifest);
  const bytes = source.reduce((sum, file) => sum + Number(file.metadata.size ?? 0), 0);
  if (!apply) return { kind: 'planned', manifest, objects: source.length, bytes, copied: toCopy.length };
  await copyToEu(toCopy);
  const stillMissing = await missingInEu(manifestPrefixes(tourRef.id, manifest), source);
  if (stillMissing.length > 0) return { kind: 'refused', reason: 'parity', missing: stillMissing.map((file) => file.name) };
  if (!(await flipPlacement(db, tourRef, manifest))) return { kind: 'refused', reason: 'changed', missing: [] };
  const healed = await healAfterFlip(tourRef);
  logger.warn('Περιήγηση μετακινήθηκε στον κάδο της ΕΕ', { tourId: tourRef.id, objects: source.length, bytes, copied: toCopy.length, healed });
  return { kind: 'migrated', manifest, objects: source.length, bytes, copied: toCopy.length + healed };
}

/**
 * **Καθαρισμός του παλιού κάδου** — μόνο (α) μετά τη μετάβαση, (β) αφού λήξουν τα κουπόνια που εκδόθηκαν πριν από αυτήν, (γ) αν η
 * ισοτιμία ξαναεπαληθευτεί **τώρα**. Σβήνει ΟΛΟ το `tour-tiles/{tourId}/` του US (και τα ορφανά/αποσυρμένα).
 */
export async function cleanupLegacyTourMedia(tourRef: DocumentReference, nowMs: number = Date.now()): Promise<TourMediaCleanupOutcome> {
  const snapshot = await loadSnapshot(tourRef);
  if (snapshot === null) return { kind: 'skipped', reason: 'missing' };
  const changedAt = snapshot.tour.mediaPlacementChangedAt;
  if (effectiveMediaPlacement(snapshot.tour.mediaPlacement) === TOUR_MEDIA_PLACEMENT_LEGACY || changedAt === undefined) {
    return { kind: 'skipped', reason: 'not-migrated' };
  }
  if (nowMs - Date.parse(changedAt) < ACCESS_GRANT_TTL_SECONDS * 1000) return { kind: 'skipped', reason: 'grace' };
  const manifest = tourMediaManifest(snapshot.tour, snapshot.captures);
  if (manifest === null) return { kind: 'skipped', reason: 'busy' };
  const { missing } = await compareBuckets(tourRef.id, manifest);
  if (missing.length > 0) return { kind: 'refused', reason: 'parity', missing: missing.map((file) => file.name) };
  const [legacy] = await legacyBucket().getFiles({ prefix: `${TOUR_TILES_ROOT}/${tourRef.id}/` });
  await legacyBucket().deleteFiles({ prefix: `${TOUR_TILES_ROOT}/${tourRef.id}/` });
  logger.warn('Παλιά μέσα περιήγησης σβήστηκαν από τον κανονικό κάδο', { tourId: tourRef.id, deleted: legacy.length });
  return { kind: 'cleaned', deleted: legacy.length };
}
