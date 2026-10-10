/**
 * @fileoverview **Ο ΑΝΑΓΝΩΣΤΗΣ ΤΗΣ ΚΑΤΟΨΗΣ ΟΡΟΦΟΥ** — ο δεύτερος, ρητός αναγνώστης δίπλα στον `agency-media.reader` (ADR-907 §11.7).
 * @related lib/listings/floor-plate (η κρίση, καθαρή) · ./listing-media-sources (ο ΕΝΑΣ τόπος που τον καλεί) · ./floor-plate-declaration.service
 * @module services/listings/floor-plate.reader
 *
 * ```
 * όροφος (δήλωση) → αρχείο εικόνας + υπόβαθρα → περιγράμματα του υποβάθρου → μονάδες → κρίση επιμέλειας → πηγή ραφιού
 * ```
 *
 * 🔑 **Δύο στάδια, και η τομή είναι το κόστος.** Τα **τεκμήρια του ορόφου** (ό,τι δεν εξαρτάται από το ποια αγγελία
 * ρωτά) διαβάζονται **μία φορά ανά όροφο και πέρασμα** — N αδελφές μονάδες ⇒ 1 ανάγνωση. Η **κρίση** («ποια είναι η
 * δική μου μονάδα;») τρέχει ανά αγγελία, στη μνήμη.
 *
 * 🔴 **Ο φρουρός Ο-9 δεν χαλαρώνει**: ο `agency-media.reader` δεν μαθαίνει τίποτα για ορόφους, και το ερώτημά του δεν
 * αλλάζει. Αρχείο ορόφου δεν φτάνει ποτέ εκεί (`entityType: 'floor'`).
 *
 * ⚠️ **Όλα ή τίποτα, με όνομα** — η άρνηση επιστρέφεται (`why` · `overlayId`) ώστε η πόρτα της δήλωσης να πει στον
 * άνθρωπο τι να διορθώσει. Η επαναπροβολή τη μεταφράζει σε «καμία κάτοψη ορόφου», σιωπηλά.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { isPayloadOwnedByCompany } from '@/lib/auth/tenant-ownership';
import { compareInstantsAsc } from '@/lib/date-local';
import {
  curateFloorPlate,
  type FloorPlateOutlineCandidate,
  type FloorPlateUnitFacts,
} from '@/lib/listings/floor-plate/floor-plate-curation';
import { readFloorPlateDeclaration, type FloorPlateRefusal } from '@/lib/listings/floor-plate/floor-plate-declaration';
import {
  floorPlateImageOf,
  type FloorPlateBackgroundCandidate,
  type FloorPlateFileCandidate,
  type FloorPlateImage,
} from '@/lib/listings/floor-plate/floor-plate-image';
import { floorPlateFrameOf, type FloorPlateFrame } from '@/lib/listings/floor-plate/floor-plate-outline';
import { FLOOR_PLATE_MAX_UNITS } from '@/lib/listings/floor-plate/floor-plate-publication';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import { createModuleLogger } from '@/lib/telemetry';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import { ROLE_REQUIRES_LINK, type OverlayLinked, type OverlayRole } from '@/types/floorplan-overlays';

import { isPubliclyListed } from './public-listing-projection';
import type { ListingSourceProperty } from './publish-public-listing';

const logger = createModuleLogger('floor-plate-reader');

/** Ό,τι ξέρει ο διακομιστής για έναν όροφο, **ανεξάρτητα** από το ποια αγγελία ρωτά. */
interface FloorPlateEvidence {
  readonly image: FloorPlateImage;
  readonly frame: FloorPlateFrame;
  readonly privateStoragePath: string;
  readonly storagePlacement: FloorPlateFileCandidate['storagePlacement'];
  readonly outlines: readonly FloorPlateOutlineCandidate[];
  readonly unitFacts: ReadonlyMap<string, FloorPlateUnitFacts>;
}

type FloorPlateEvidenceReading =
  | { readonly ok: true; readonly evidence: FloorPlateEvidence }
  | { readonly ok: false; readonly why: FloorPlateRefusal; readonly overlayId: string | null };

type FloorPlateSourceReading =
  | { readonly ok: true; readonly source: PublicShelfSource<ListingMaterial> }
  | { readonly ok: false; readonly why: FloorPlateRefusal; readonly overlayId: string | null };

function refuse(why: FloorPlateRefusal, overlayId: string | null = null): { ok: false; why: FloorPlateRefusal; overlayId: string | null } {
  return { ok: false, why, overlayId };
}

// ---------------------------------------------------------------------------
// ΠΕΡΙΓΡΑΜΜΑΤΑ
// ---------------------------------------------------------------------------

/** Το κλειδί του `linked` κατά ρόλο — από το **ένα** μητρώο (`ROLE_REQUIRES_LINK`), ποτέ δεύτερος πίνακας εδώ. */
function linkKeyOf(role: unknown): keyof OverlayLinked | null {
  if (typeof role !== 'string' || !Object.hasOwn(ROLE_REQUIRES_LINK, role)) return null;
  return ROLE_REQUIRES_LINK[role as OverlayRole] ?? null;
}

function linkedUnitOf(raw: Readonly<Record<string, unknown>>): { readonly key: keyof OverlayLinked; readonly unitId: string } | null {
  const key = linkKeyOf(raw.role);
  const linked = raw.linked as OverlayLinked | undefined;
  const unitId = key === null ? undefined : linked?.[key];
  return key !== null && typeof unitId === 'string' && unitId !== '' ? { key, unitId } : null;
}

/** Κλειστό πολύγωνο ⇒ οι κορυφές του· οτιδήποτε άλλο ⇒ `null` (η κρίση το ονομάζει `not-a-polygon`). */
function polygonOf(geometry: unknown): FloorPlateOutlineCandidate['vertices'] {
  const shape = geometry as { type?: unknown; vertices?: unknown; closed?: unknown } | undefined;
  if (shape?.type !== 'polygon' || shape.closed === false || !Array.isArray(shape.vertices)) return null;
  return shape.vertices as FloorPlateOutlineCandidate['vertices'];
}

/**
 * Τα περιγράμματα **ενός** υποβάθρου, με τη σειρά που γράφτηκαν (ισοπαλία στο id — το δημόσιο έγγραφο δεν επιτρέπεται να
 * αλλάζει σειρά χωρίς να έχει αλλάξει τίποτα).
 *
 * 🔑 Μόνο ισότητες στο ερώτημα· η σειρά γίνεται στη μνήμη. Περίγραμμα **άλλου** υποβάθρου του ίδιου ορόφου ανήκει σε
 * άλλη εικόνα — παραλείπεται, δεν αρνείται.
 */
async function readOutlines(
  adminDb: AdminFirestore,
  companyId: string,
  floorId: string,
  backgroundId: string,
): Promise<readonly { readonly candidate: FloorPlateOutlineCandidate; readonly link: ReturnType<typeof linkedUnitOf> }[]> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, raw: doc.data() as Readonly<Record<string, unknown>> }))
    .filter(({ raw }) => raw.backgroundId === backgroundId)
    .sort((a, b) => compareInstantsAsc(a.raw.createdAt, b.raw.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, raw }) => {
      const link = linkedUnitOf(raw);
      const role = typeof raw.role === 'string' ? raw.role : '';
      return { candidate: { overlayId: id, role, vertices: polygonOf(raw.geometry), unitId: link?.unitId ?? null }, link };
    });
}

// ---------------------------------------------------------------------------
// ΜΟΝΑΔΕΣ
// ---------------------------------------------------------------------------

/** Σε ποια συλλογή ζει η μονάδα κάθε ρόλου. Εξαντλητικό στα κλειδιά του `OverlayLinked`. */
const UNIT_COLLECTION: Readonly<Record<keyof OverlayLinked, string>> = {
  propertyId: COLLECTIONS.PROPERTIES,
  parkingId: COLLECTIONS.PARKING_SPACES,
  storageId: COLLECTIONS.STORAGE,
};

/**
 * Ό,τι επιτρέπεται να μάθει το κοινό για μια μονάδα: κατάσταση, και —**μόνο** για ακίνητο που δημοσιεύεται τώρα— η
 * ταυτότητα της αγγελίας του (id αγγελίας = id ακινήτου).
 *
 * ⚠️ Θέση στάθμευσης και αποθήκη έχουν εμπορική κατάσταση αλλά **ποτέ** δική τους δημόσια αγγελία ⇒ ποτέ σύνδεσμος.
 */
function unitFactsOf(key: keyof OverlayLinked, unitId: string, data: Readonly<Record<string, unknown>>): FloorPlateUnitFacts {
  const listed = key === 'propertyId' && isPubliclyListed({ ...(data as ListingSourceProperty), id: unitId });
  return { commercialStatus: data.commercialStatus, publicListingId: listed ? unitId : null };
}

/**
 * Οι μονάδες με τις οποίες δένουν τα περιγράμματα — **μόνο του ίδιου χώρου**. Ξένη ή ανύπαρκτη μονάδα απλώς λείπει από
 * τον χάρτη, και η κρίση την ονομάζει `foreign-unit`.
 */
async function readUnitFacts(
  adminDb: AdminFirestore,
  companyId: string,
  links: readonly { readonly key: keyof OverlayLinked; readonly unitId: string }[],
): Promise<ReadonlyMap<string, FloorPlateUnitFacts>> {
  const facts = new Map<string, FloorPlateUnitFacts>();
  if (links.length === 0) return facts;

  const refs = links.map(({ key, unitId }) => adminDb.collection(UNIT_COLLECTION[key]).doc(unitId));
  const snapshots = await adminDb.getAll(...refs);

  snapshots.forEach((snapshot, index) => {
    const data = snapshot.data();
    if (data === undefined || !isPayloadOwnedByCompany(data, companyId)) return;
    const { key, unitId } = links[index];
    facts.set(unitId, unitFactsOf(key, unitId, data));
  });
  return facts;
}

// ---------------------------------------------------------------------------
// ΤΑ ΤΕΚΜΗΡΙΑ ΤΟΥ ΟΡΟΦΟΥ
// ---------------------------------------------------------------------------

/** Το αρχείο της εικόνας και τα υπόβαθρα του ορόφου — δύο ανεξάρτητες ερωτήσεις, ένας γύρος δικτύου. */
async function readImage(adminDb: AdminFirestore, companyId: string, floorId: string, fileId: string) {
  const [fileSnapshot, backgrounds] = await Promise.all([
    adminDb.collection(COLLECTIONS.FILES).doc(fileId).get(),
    adminDb
      .collection(COLLECTIONS.FLOORPLAN_BACKGROUNDS)
      .where('companyId', '==', companyId)
      .where('floorId', '==', floorId)
      .get(),
  ]);

  const data = fileSnapshot.data();
  // 🔒 Ξένο αρχείο = ανύπαρκτο — το `fileId` της δήλωσης δεν είναι ποτέ απόδειξη κηδεμονίας.
  if (data === undefined || !isPayloadOwnedByCompany(data, companyId)) return null;

  return {
    file: { ...(data as FloorPlateFileCandidate), id: fileSnapshot.id },
    backgrounds: backgrounds.docs.map((doc): FloorPlateBackgroundCandidate => ({ ...doc.data(), id: doc.id })),
  };
}

/**
 * **Τα τεκμήρια ενός ορόφου για ΣΥΓΚΕΚΡΙΜΕΝΗ εικόνα** — ό,τι χρειάζεται η κρίση, ή γιατί δεν υπάρχει.
 *
 * 🔑 Το `fileId` είναι όρισμα: η επαναπροβολή δίνει της **υπογεγραμμένης** δήλωσης, η πόρτα δίνει της δήλωσης που
 * **πρόκειται** να υπογραφεί — η ίδια κρίση, πριν και μετά την υπογραφή.
 */
export async function readFloorPlateEvidence(
  adminDb: AdminFirestore,
  companyId: string,
  floorId: string,
  fileId: string,
): Promise<FloorPlateEvidenceReading> {
  const read = await readImage(adminDb, companyId, floorId, fileId);
  if (read === null) return refuse('image-missing');

  const reading = floorPlateImageOf(read.file, floorId, read.backgrounds);
  if (!reading.ok) return refuse(reading.why);
  const frame = floorPlateFrameOf(reading.image.source);
  if (frame === null) return refuse('no-frame');

  const outlines = await readOutlines(adminDb, companyId, floorId, reading.image.backgroundId);
  const links = outlines.flatMap(({ link }) => (link === null ? [] : [link]));

  return {
    ok: true,
    evidence: {
      image: reading.image,
      frame,
      privateStoragePath: read.file.storagePath,
      storagePlacement: read.file.storagePlacement,
      outlines: outlines.map(({ candidate }) => candidate),
      unitFacts: await readUnitFacts(adminDb, companyId, links),
    },
  };
}

/** **Τα τεκμήρια του ορόφου όπως είναι ΥΠΟΓΕΓΡΑΜΜΕΝΑ τώρα** — χωρίς δήλωση, τίποτα άλλο δεν διαβάζεται. */
export async function readDeclaredFloorPlateEvidence(
  adminDb: AdminFirestore,
  companyId: string,
  floorId: string,
): Promise<FloorPlateEvidenceReading> {
  const floor = (await adminDb.collection(COLLECTIONS.FLOORS).doc(floorId).get()).data();
  if (floor === undefined || !isPayloadOwnedByCompany(floor, companyId)) return refuse('floor-missing');

  const declaration = readFloorPlateDeclaration(floor);
  if (declaration === null) return refuse('not-declared');

  return readFloorPlateEvidence(adminDb, companyId, floorId, declaration.fileId);
}

// ---------------------------------------------------------------------------
// ΠΟΙΟΥΣ ΟΡΟΦΟΥΣ ΑΦΟΡΑ ΜΙΑ ΜΟΝΑΔΑ ΠΟΥ ΑΛΛΑΞΕ (ADR-907 §11.8)
// ---------------------------------------------------------------------------

/** Μια μονάδα **όπως τη δείχνει ένα περίγραμμα**: ποιο κλειδί του `linked`, ποια ταυτότητα. */
export interface FloorPlateUnitRef {
  readonly link: keyof OverlayLinked;
  readonly unitId: string;
}

/**
 * **Σε ποιους ορόφους ΦΑΙΝΕΤΑΙ αυτή η μονάδα;** — οι όροφοι των περιγραμμάτων που δένουν μαζί της.
 *
 * 🔴 **Από τα ΠΕΡΙΓΡΑΜΜΑΤΑ, όχι από το `floorId` της μονάδας**: η κάτοψη ενός ορόφου δείχνει ό,τι **σχεδιάστηκε**
 * πάνω της. Μεζονέτα σχεδιασμένη σε δύο επίπεδα, ή θέση στάθμευσης χωρίς δικό της όροφο, φαίνονται σε κατόψεις που το
 * `floorId` τους δεν ονομάζει — και εκεί ακριβώς θα έμενε μπαγιάτικη κατάσταση χωρίς να το πει κανείς.
 *
 * 🔒 Μόνο περιγράμματα του **ίδιου χώρου**: ξένο περίγραμμα που δείχνει σε δική μας μονάδα δεν ξυπνά ξένο όροφο.
 */
export async function readFloorsShowingUnit(
  adminDb: AdminFirestore,
  companyId: string,
  unit: FloorPlateUnitRef,
): Promise<readonly string[]> {
  // firestore-index-exempt: δύο ισότητες και καμία ταξινόμηση — το Firestore συγχωνεύει τους αυτόματους δείκτες ενός πεδίου, σύνθετος δείκτης δεν χρειάζεται.
  const snapshot = await adminDb
    .collection(COLLECTIONS.FLOORPLAN_OVERLAYS)
    .where('companyId', '==', companyId)
    .where(`linked.${unit.link}`, '==', unit.unitId)
    .get();

  const floors = new Set<string>();
  for (const doc of snapshot.docs) {
    const floorId: unknown = doc.get('floorId');
    if (typeof floorId === 'string' && floorId !== '') floors.add(floorId);
  }
  return [...floors];
}

/**
 * **Έχει ο όροφος υπογεγραμμένη κάτοψη;** — μία ανάγνωση, και η μόνη που πληρώνει όροφος **χωρίς** δήλωση.
 *
 * 🔑 Χωρίς δήλωση καμία αγγελία του δεν έχει κάτοψη ορόφου, άρα καμία αλλαγή μονάδας δεν μπορεί να τις αγγίξει.
 * Η **άρση** της δήλωσης δεν περνά από εδώ: την ξαναπροβάλλει η πόρτα της, χωρίς αυτή την ερώτηση.
 */
export async function hasFloorPlateDeclaration(
  adminDb: AdminFirestore,
  companyId: string,
  floorId: string,
): Promise<boolean> {
  const floor = (await adminDb.collection(COLLECTIONS.FLOORS).doc(floorId).get()).data();
  if (floor === undefined || !isPayloadOwnedByCompany(floor, companyId)) return false;
  return readFloorPlateDeclaration(floor) !== null;
}

// ---------------------------------------------------------------------------
// Η ΚΡΙΣΗ ΑΝΑ ΑΓΓΕΛΙΑ
// ---------------------------------------------------------------------------

/**
 * **Η πηγή ραφιού για ΜΙΑ αγγελία** — η κρίση επιμέλειας με «δική μου μονάδα» το ακίνητο που ρωτά.
 *
 * 🔑 Καθαρή πάνω στα τεκμήρια: δύο αδελφές αγγελίες παίρνουν την **ίδια** εικόνα και τις **ίδιες** μονάδες, με άλλη
 * `self`. Τα bytes είναι ίδια ⇒ το ράφι (διεύθυνση = sha256) δεν τα ξαναγράφει.
 */
export function floorPlateSourceOf(evidence: FloorPlateEvidence, selfUnitId: string): FloorPlateSourceReading {
  const curation = curateFloorPlate({
    selfUnitId,
    frame: evidence.frame,
    outlines: evidence.outlines,
    unitFacts: evidence.unitFacts,
  });
  if (!curation.ok) return refuse(curation.why, curation.overlayId);
  if (curation.units.length > FLOOR_PLATE_MAX_UNITS) return refuse('too-many-units');

  const { at, provenance } = evidence.image;
  return {
    ok: true,
    source: {
      privateStoragePath: evidence.privateStoragePath,
      storagePlacement: evidence.storagePlacement,
      material: { kind: 'floorPlate', at, provenance, units: curation.units },
    },
  };
}

/** Η μονάδα που θα έπαιζε τη «δική μου» αν ρωτούσε η **πόρτα της δήλωσης** — η πρώτη δεμένη, ή καμία. */
export function firstLinkedUnitOf(evidence: FloorPlateEvidence): string | null {
  return evidence.outlines.find((outline) => outline.unitId !== null)?.unitId ?? null;
}

// ---------------------------------------------------------------------------
// Ο ΕΠΙΛΥΤΗΣ ΕΝΟΣ ΠΕΡΑΣΜΑΤΟΣ
// ---------------------------------------------------------------------------

/** Ό,τι χρειάζεται από το ακίνητο: ο χώρος του και ο όροφός του — **πάντα** από το έγγραφο, ποτέ από τον καλούντα. */
interface FloorPlateOwner {
  readonly companyId?: string | null;
  readonly floorId?: unknown;
}

type FloorPlateResolver = (
  propertyId: string,
  property: FloorPlateOwner,
) => Promise<readonly PublicShelfSource<ListingMaterial>[]>;

const NO_FLOOR_PLATE: readonly PublicShelfSource<ListingMaterial>[] = [];

/**
 * **Ο επιλυτής ενός περάσματος** — με μνήμη **ανά όροφο**, σε αντίθεση με τον επιλυτή αρχείων του γραφείου: εκείνος
 * ρωτά ανά ακίνητο (καμία επανάληψη), αυτός ανά όροφο (N αδελφές ⇒ 1 ανάγνωση).
 *
 * 🔑 **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τον `readPublishedAgencyMedia`: βλάβη ανάγνωσης ⇒ η αγγελία δημοσιεύεται
 * χωρίς κάτοψη ορόφου, και η βλάβη ονομάζεται στο ημερολόγιο. Η άρνηση της κρίσης **δεν** είναι βλάβη· είναι σιωπή.
 */
export function createFloorPlateResolver(adminDb: AdminFirestore): FloorPlateResolver {
  const byFloor = new Map<string, Promise<FloorPlateEvidenceReading>>();

  return async (propertyId, property) => {
    const { companyId, floorId } = property;
    if (typeof companyId !== 'string' || companyId === '' || typeof floorId !== 'string' || floorId === '') {
      return NO_FLOOR_PLATE;
    }

    try {
      const key = `${companyId}/${floorId}`;
      const pending = byFloor.get(key) ?? readDeclaredFloorPlateEvidence(adminDb, companyId, floorId);
      byFloor.set(key, pending);

      const reading = await pending;
      if (!reading.ok) return NO_FLOOR_PLATE;
      const source = floorPlateSourceOf(reading.evidence, propertyId);
      return source.ok ? [source.source] : NO_FLOOR_PLATE;
    } catch (error) {
      logger.warn('Η κάτοψη ορόφου δεν διαβάστηκε — η αγγελία δημοσιεύεται χωρίς αυτήν', {
        propertyId, floorId, error: error instanceof Error ? error.message : String(error),
      });
      return NO_FLOOR_PLATE;
    }
  };
}
