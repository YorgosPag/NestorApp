/**
 * @fileoverview **ΤΟ ΣΥΝΟΡΟ ΑΝΑΓΝΩΣΗΣ ΤΗΣ ΧΩΡΙΚΗΣ ΠΕΡΙΗΓΗΣΗΣ** — έγγραφο Firestore → `SpatialTour` /
 * `TourCapture`, ή `null`.
 * @related ADR-884 Φ0.2 · Φ0.14 · ADR-839/842 (σύνορα ανάγνωσης) · CHECK 3.74
 * @module lib/spatial-tour/spatial-tour-from-document
 *
 * 🔑 **Κάθε ανάγνωση αποθηκευμένης περιήγησης ή λήψης περνά από εδώ.** Οι γραμμές στο `BOUNDARIES` του
 * CHECK 3.74 μπαίνουν με τον **πρώτο παραγωγικό αναγνώστη** (Κ3): σύνορο χωρίς καταναλωτή κοκκινίζει τον
 * Κ2 της πύλης, και ένας τεχνητός καταναλωτής θα ήταν «πράσινο που δεν κοίταξε».
 *
 * 🔴 **ΟΡΑΤΟΤΗΤΑ = ΑΣΦΑΛΕΙΑ, ΑΡΑ ΚΑΜΙΑ ΠΡΟΕΠΙΛΟΓΗ.** Άγνωστη ή απούσα `visibility` διαβασμένη ως `public`
 * θα έβγαζε στο ράφι περιήγηση που ο υπεύθυνος έκλεισε σε `on-request`. Τα έγγραφα τα γράφει **μόνο** ο
 * διακομιστής, άρα κάθε νόμιμο έγγραφο είναι πλήρες — και ό,τι δεν είναι, είναι `null`, ποτέ «μισή» περιήγηση.
 * Το ίδιο για τον γράφο: κόμβος που δεν διαβάζεται **δεν πετιέται σιωπηλά** (θα άφηνε ορφανούς συνδέσμους)·
 * ολόκληρη η περιήγηση είναι `null`.
 *
 * ⚠️ **Η ταυτότητα έρχεται από έξω και νικά** (ίδιο συμβόλαιο με `readStoredDemand`).
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, κανένα Firestore SDK.
 */

import { isPlaceSource } from '@/constants/place-sources';
import {
  isFloorPlanRecordState,
  isFloorPlanSource,
  isSpatialTourLifecycle,
  isSpatialTourVisibility,
  isTourAccessRequestState,
  isTourCaptureAudience,
  isTourCaptureProvenance,
  isTourCaptureSource,
  isTourDeclaredAreaSource,
  isTourGrantScope,
  isTourHeadingSource,
  isTourLinkVia,
  isTourMilestone,
  isTourRedactionSource,
  isTourRoomSource,
  isTourMediaPlacement,
  isTourSpaceAreaDisplay,
  isTourSpaceSource,
  isTourTilesetState,
} from '@/constants/spatial-tour-vocabulary';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { text } from '@/lib/agency/showcase-read-primitives';
import { normalizeToISO } from '@/lib/date-local';
import { readSignatory } from '@/lib/listings/model-declaration-metadata';
import { readMediaRights } from '@/lib/media-rights/media-rights-read';
import { readProfessionalAttestation } from '@/lib/professional/professional-attestation';
import { isRecord } from '@/lib/type-guards';
import { readCapturePlacementHint, readTourLevelKey } from '@/lib/spatial-tour/tour-capture-placement-hint';
import { normalizeTourRoom } from '@/lib/spatial-tour/tour-room';
import { custodyOnly, custodyScopeFromData } from '@/lib/workspace/custody-scope';
import { isInvitationState } from '@/types/invitation-core';
import type {
  FloorPlanImage,
  FloorPlanRecord,
  FloorPlanScale,
  SpatialTour,
  TourAccessRequest,
  TourCapture,
  TourCaptureGrant,
  TourCaptureInvitation,
  TourCaptureSignatory,
  TourCaptureTileset,
  TourDeclaredArea,
  TourLevel,
  TourLink,
  TourNode,
  TourPoint,
  TourFaceScan,
  TourRedaction,
  TourRoom,
  TourSeparationLine,
  TourSpaceOutline,
  TourSubject,
} from '@/types/spatial-tour';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Πίνακας όπου **κάθε** στοιχείο διαβάζεται — αλλιώς `null` (κανένα σιωπηλό πέταγμα). */
function readAll<T>(raw: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const items = raw.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

function readSubject(raw: unknown): TourSubject | null {
  if (!isRecord(raw) || !isPlaceSource(raw.kind)) return null;
  const id = text(raw.id);
  return id === null ? null : { kind: raw.kind, id };
}

const isPositiveNumber = (value: unknown): value is number => isFiniteNumber(value) && value > 0;
/** Ακέραιος ≥ 0 — μετρητής. */
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** Η εικόνα της κάτοψης — απούσα ⇒ `null`· `undefined` ⇒ υπάρχει αλλά δεν διαβάζεται (ίδια σύμβαση με τη θέση). */
function readPlanImage(raw: unknown): FloorPlanImage | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw) || !isPositiveNumber(raw.width) || !isPositiveNumber(raw.height)) return undefined;
  const contentHash = text(raw.contentHash);
  return contentHash === null ? undefined : { width: raw.width, height: raw.height, contentHash };
}

function readPlanScale(raw: unknown): FloorPlanScale | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw) || !isPositiveNumber(raw.metresPerPixel)) return undefined;
  const calibratedBy = text(raw.calibratedBy);
  const calibratedAt = normalizeToISO(raw.calibratedAt);
  return calibratedBy === null || calibratedAt === null ? undefined : { metresPerPixel: raw.metresPerPixel, calibratedBy, calibratedAt };
}

function readFloorPlan(raw: unknown): FloorPlanRecord | null {
  if (!isRecord(raw) || !isFloorPlanSource(raw.source) || !isFloorPlanRecordState(raw.state)) return null;
  const image = readPlanImage(raw.image);
  const scale = readPlanScale(raw.scale);
  if (image === undefined || scale === undefined) return null;
  return {
    source: raw.source,
    state: raw.state,
    fileId: text(raw.fileId),
    approvedBy: text(raw.approvedBy),
    approvedAt: normalizeToISO(raw.approvedAt),
    ...(image === null ? {} : { image }),
    ...(scale === null ? {} : { scale }),
  };
}

// ── Σχήματα χώρων (Γ3β): λείπει ⇒ κανένα· υπάρχει αλλά δεν διαβάζεται ⇒ ο όροφος (άρα η περιήγηση) `null` ──

function readPlanar(raw: unknown): PlanarPoint | null {
  return isRecord(raw) && isFiniteNumber(raw.x) && isFiniteNumber(raw.y) ? { x: raw.x, y: raw.y } : null;
}

function readDeclaredArea(raw: unknown): TourDeclaredArea | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw) || !isPositiveNumber(raw.areaM2) || !isTourDeclaredAreaSource(raw.source)) return undefined;
  const declaredBy = text(raw.declaredBy);
  const declaredAt = normalizeToISO(raw.declaredAt);
  return declaredBy === null || declaredAt === null ? undefined : { areaM2: raw.areaM2, source: raw.source, declaredBy, declaredAt };
}

function readSpace(raw: unknown): TourSpaceOutline | null {
  if (!isRecord(raw) || !isTourSpaceSource(raw.source)) return null;
  const [id, approvedBy, approvedAt] = [text(raw.id), text(raw.approvedBy), normalizeToISO(raw.approvedAt)];
  const points = readAll(raw.points, readPlanar);
  const room = readRoom(raw.room);
  const declaredArea = readDeclaredArea(raw.declaredArea);
  if (id === null || approvedBy === null || approvedAt === null || points === null || points.length < 3) return null;
  if (room === undefined || declaredArea === undefined) return null;
  return {
    id, points, source: raw.source, approvedBy, approvedAt,
    ...(room === null ? {} : { room }),
    ...(declaredArea === null ? {} : { declaredArea }),
  };
}

function readSeparation(raw: unknown): TourSeparationLine | null {
  if (!isRecord(raw)) return null;
  const [id, approvedBy, approvedAt] = [text(raw.id), text(raw.approvedBy), normalizeToISO(raw.approvedAt)];
  const [a, b] = [readPlanar(raw.a), readPlanar(raw.b)];
  return id === null || approvedBy === null || approvedAt === null || a === null || b === null ? null : { id, a, b, approvedBy, approvedAt };
}

/** Προαιρετικός πίνακας: λείπει ⇒ `[]` · δεν διαβάζεται (ή κάποιο στοιχείο του) ⇒ `null`. */
const readOptionalAll = <T>(raw: unknown, read: (item: unknown) => T | null): T[] | null => (raw === undefined ? [] : readAll(raw, read));

function readLevel(raw: unknown): TourLevel | null {
  if (!isRecord(raw)) return null;
  const key = readTourLevelKey(raw.key);
  const floorPlans = readAll(raw.floorPlans, readFloorPlan);
  const spaces = readOptionalAll(raw.spaces, readSpace);
  const separations = readOptionalAll(raw.separations, readSeparation);
  if (key === null || floorPlans === null || spaces === null || separations === null) return null;
  return {
    key, floorPlans,
    ...(spaces.length > 0 ? { spaces } : {}),
    ...(separations.length > 0 ? { separations } : {}),
  };
}

function readPoint(raw: unknown): TourPoint | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.z)) return undefined;
  return { x: raw.x, y: raw.y, z: raw.z };
}

function readLink(raw: unknown): TourLink | null {
  if (!isRecord(raw) || !isTourLinkVia(raw.via)) return null;
  const toNodeId = text(raw.toNodeId);
  const bearingRad = isFiniteNumber(raw.bearingRad) ? raw.bearingRad : null;
  return toNodeId === null ? null : { toNodeId, via: raw.via, bearingRad };
}

/** Ο χώρος του σημείου — απών ⇒ `null`· `undefined` ⇒ υπάρχει αλλά δεν διαβάζεται (ίδια σύμβαση με τη θέση). */
function readRoom(raw: unknown): TourRoom | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw) || !Array.isArray(raw.types) || !isTourRoomSource(raw.source)) return undefined;
  return normalizeTourRoom({ types: raw.types, label: raw.label ?? null }) ?? undefined;
}

function readNode(raw: unknown): TourNode | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  const levelKey = readTourLevelKey(raw.levelKey);
  // `undefined` ⇒ υπάρχει θέση αλλά δεν διαβάζεται· `null` ⇒ δηλωμένα χωρίς θέση (όροφος χωρίς κάτοψη).
  const position = readPoint(raw.position ?? null);
  const links = readAll(raw.links ?? [], readLink);
  const room = readRoom(raw.room);
  if (id === null || levelKey === null || position === undefined || links === null || room === undefined) return null;
  return room === null ? { id, levelKey, position, links } : { id, levelKey, position, links, room };
}

/** **Διαβάζει ένα αποθηκευμένο έγγραφο ως περιήγηση.** `null` ⇒ «αυτό δεν είναι περιήγηση που σερβίρεται». */
export function spatialTourFromDocument(raw: unknown, id: string): SpatialTour | null {
  if (!isRecord(raw)) return null;
  const custody = custodyScopeFromData(raw);
  const subject = readSubject(raw.subject);
  const levels = readAll(raw.levels, readLevel);
  const nodes = readAll(raw.nodes, readNode);
  const [createdAt, updatedAt] = [normalizeToISO(raw.createdAt), normalizeToISO(raw.updatedAt)];
  const [createdBy, updatedBy] = [text(raw.createdBy), text(raw.updatedBy)];
  if (custody === null || subject === null || levels === null || nodes === null) return null;
  if (!isSpatialTourVisibility(raw.visibility) || !isSpatialTourLifecycle(raw.lifecycle)) return null;
  if (!Number.isInteger(raw.revision) || (raw.revision as number) < 0) return null;
  if (createdAt === null || updatedAt === null || createdBy === null || updatedBy === null) return null;
  // Εμβαδά χώρων (Δ8.4): λείπει ⇒ `shown` (παλιά έγγραφα)· υπάρχει αλλά άγνωστο ⇒ δεν διαβάζεται.
  if (raw.spaceAreaDisplay !== undefined && !isTourSpaceAreaDisplay(raw.spaceAreaDisplay)) return null;
  // Θέση μέσων (Φ2ζ ζ5): λείπει ⇒ legacy (το λύνει το tour-media-store)· άγνωστη ⇒ δεν διαβάζεται (ποτέ «μαντεύω κάδο»).
  if (raw.mediaPlacement !== undefined && !isTourMediaPlacement(raw.mediaPlacement)) return null;
  const mediaPlacementChangedAt = raw.mediaPlacementChangedAt === undefined ? undefined : normalizeToISO(raw.mediaPlacementChangedAt);
  if (mediaPlacementChangedAt === null) return null;
  return {
    id, custody, subject, levels, nodes,
    visibility: raw.visibility,
    lifecycle: raw.lifecycle,
    ...(raw.spaceAreaDisplay === undefined ? {} : { spaceAreaDisplay: raw.spaceAreaDisplay }),
    ...(raw.mediaPlacement === undefined ? {} : { mediaPlacement: raw.mediaPlacement }),
    ...(mediaPlacementChangedAt === undefined ? {} : { mediaPlacementChangedAt }),
    revision: raw.revision as number,
    createdAt, createdBy, updatedAt, updatedBy,
  };
}

// =============================================================================
// ΛΗΨΗ (υποσυλλογή `tour_captures`)
// =============================================================================

/** `undefined` ⇒ υπάρχει κάτι που δεν διαβάζεται· `null` ⇒ δηλωμένα χωρίς υπογράφοντα. */
function readCaptureSignatory(raw: unknown): TourCaptureSignatory | null | undefined {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const person = readSignatory(raw.person);
  const attestation = readProfessionalAttestation(raw.attestation);
  return person === null || attestation === null ? undefined : { person, attestation };
}

function readTileset(raw: unknown): TourCaptureTileset | null {
  if (!isRecord(raw) || !isTourTilesetState(raw.state)) return null;
  const faceSize = isFiniteNumber(raw.faceSize) && raw.faceSize > 0 ? raw.faceSize : null;
  // Αποσυρμένα κλειδιά (Φ2ζ): λείπει ⇒ κανένα· υπάρχει αλλά δεν διαβάζεται ⇒ ΟΛΗ η λήψη `null` — μια σιωπηλά χαμένη λίστα
  // θα άφηνε στον κάδο πλακίδια με ό,τι ζητήθηκε να κρυφτεί.
  const retiredKeys = raw.retiredKeys === undefined ? [] : readAll(raw.retiredKeys, text);
  if (retiredKeys === null) return null;
  return { state: raw.state, contentHash: text(raw.contentHash), faceSize, ...(retiredKeys.length > 0 ? { retiredKeys } : {}) };
}

function readRedaction(raw: unknown): TourRedaction | null {
  if (!isRecord(raw) || !isTourRedactionSource(raw.source)) return null;
  const [id, createdBy] = [text(raw.id), text(raw.createdBy)];
  const createdAt = normalizeToISO(raw.createdAt);
  const { yawRad, pitchRad, radiusRad } = raw;
  if (id === null || createdBy === null || createdAt === null) return null;
  if (!isFiniteNumber(yawRad) || !isFiniteNumber(pitchRad) || !isFiniteNumber(radiusRad)) return null;
  return { id, yawRad, pitchRad, radiusRad, source: raw.source, createdBy, createdAt };
}

/**
 * Οι θολωμένες περιοχές (Φ2ζ): λείπουν ⇒ `[]`· υπάρχουν αλλά **έστω μία** δεν διαβάζεται ⇒ `null` και η λήψη δεν διαβάζεται.
 * 🔴 Ποτέ «πέτα την αδιάβαστη»: ο ψήστης θα έψηνε χωρίς αυτήν — θα **ξεθόλωνε** ένα πρόσωπο σιωπηλά.
 */
function readRedactions(raw: unknown): readonly TourRedaction[] | null {
  return raw === undefined ? [] : readAll(raw, readRedaction);
}

/**
 * Η αυτόματη σάρωση προσώπων (Φ2ζ ζ4): απούσα ⇒ `undefined` (δεν σαρώθηκε)· παρούσα αλλά αδιάβαστη ⇒ `null` και η λήψη δεν
 * διαβάζεται. 🔴 Ποτέ «αδιάβαστη = δεν σαρώθηκε»: θα ξανασάρωνε και θα ξαναγεννούσε ό,τι έσβησε ο άνθρωπος.
 */
function readFaceScan(raw: unknown): TourFaceScan | null | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || typeof raw.saturated !== 'boolean') return null;
  const [version, at] = [text(raw.version), normalizeToISO(raw.at)];
  const { faces, added } = raw;
  if (version === null || at === null || !isCount(faces) || !isCount(added)) return null;
  return { version, faces, added, saturated: raw.saturated, at };
}

/** Τα πεδία λεξιλογίου μιας λήψης — όλα ή τίποτα. */
function readCaptureVocabulary(raw: Record<string, unknown>) {
  const { source, provenance, audience } = raw;
  const milestone = raw.milestone ?? null;
  if (!isTourCaptureSource(source) || !isTourCaptureProvenance(provenance) || !isTourCaptureAudience(audience)) {
    return null;
  }
  if (milestone !== null && !isTourMilestone(milestone)) return null;
  return { source, provenance, audience, milestone };
}

/**
 * Ο κόμβος: `null` **δηλωμένο** ⇒ ατοποθέτητη· `undefined` ⇒ απόν ή αδιάβαστο. 🔴 Το απόν **δεν** γίνεται
 * «ατοποθέτητη»: ο διακομιστής γράφει πάντα το πεδίο, άρα απουσία = έγγραφο που δεν καταλάβαμε.
 */
function readPlacement(raw: unknown): string | null | undefined {
  if (raw === null) return null;
  return text(raw) ?? undefined;
}

/** **Διαβάζει ένα αποθηκευμένο έγγραφο ως λήψη.** Λήψη χωρίς αναγνώσιμα δικαιώματα ⇒ `null` (Φ0.14). */
export function tourCaptureFromDocument(raw: unknown, id: string): TourCapture | null {
  if (!isRecord(raw)) return null;
  const vocabulary = readCaptureVocabulary(raw);
  const signatory = readCaptureSignatory(raw.signatory);
  const rights = readMediaRights(raw.rights);
  const tileset = readTileset(raw.tileset);
  const redactions = readRedactions(raw.redactions);
  const faceScan = readFaceScan(raw.faceScan);
  const placementHint = readCapturePlacementHint(raw.placementHint);
  const originalHash = raw.originalHash === undefined ? undefined : text(raw.originalHash);
  const nodeId = readPlacement(raw.nodeId);
  const [tourId, originalFileId, uploadedBy] = [raw.tourId, raw.originalFileId, raw.uploadedBy].map(text);
  const [capturedAt, createdAt] = [normalizeToISO(raw.capturedAt), normalizeToISO(raw.createdAt)];
  if (vocabulary === null || signatory === undefined || rights === null || tileset === null) return null;
  if (tourId === null || nodeId === undefined || originalFileId === null || uploadedBy === null) return null;
  if (capturedAt === null || createdAt === null || !isFiniteNumber(raw.headingRad)) return null;
  // Απών ⇒ `device` (παλιά έγγραφα)· παρών αλλά άγνωστος ⇒ έγγραφο που δεν καταλάβαμε (Φ2στ-β).
  if (raw.headingSource !== undefined && !isTourHeadingSource(raw.headingSource)) return null;
  // Θολώματα / hash πρωτοτύπου (Φ2ζ): παρόντα αλλά αδιάβαστα ⇒ έγγραφο που δεν καταλάβαμε (ποτέ ψήσιμο χωρίς αυτά).
  if (redactions === null || originalHash === null || faceScan === null) return null;
  // Πρόταση θέσης (ADR-904 Κ8): παρούσα αλλά αδιάβαστη ⇒ έγγραφο που δεν καταλάβαμε — ποτέ σιωπηλή απώλεια του τι δηλώθηκε.
  if (placementHint === undefined) return null;
  return {
    id, tourId, nodeId, capturedAt, createdAt, originalFileId, uploadedBy, rights, tileset, signatory,
    ...vocabulary,
    headingRad: raw.headingRad,
    ...(raw.headingSource === undefined ? {} : { headingSource: raw.headingSource }),
    ...(originalHash === undefined ? {} : { originalHash }),
    ...(redactions.length > 0 ? { redactions } : {}),
    ...(faceScan === undefined ? {} : { faceScan }),
    ...(placementHint === null ? {} : { placementHint }),
    baseCaptureId: text(raw.baseCaptureId),
  };
}

// =============================================================================
// ΑΔΕΙΕΣ (υποσυλλογές `tour_access_requests` · `tour_capture_grants`)
// =============================================================================

/**
 * Προαιρετική στιγμή (ανάκληση · επίλυση · άνοιγμα): `null` = δεν συνέβη· `undefined` = **υπάρχει αλλά δεν
 * διαβάζεται**. 🔴 Το δεύτερο **δεν** γίνεται «δεν συνέβη» — μια ανάκληση που δεν διαβάζεται θα άνοιγε άδεια
 * που κάποιος έκλεισε (ίδια παγίδα με το `new Date(Timestamp)` του `scoped-grant`). Ο καλών απορρίπτει όλο το έγγραφο.
 */
function readOptionalInstant(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) return null;
  return normalizeToISO(raw) ?? undefined;
}

/**
 * **Διαβάζει ένα αίτημα θέασης.** Εγκεκριμένο αίτημα **χωρίς** αναγνώσιμη λήξη **δεν** είναι `null` — το
 * κρατάμε, και ο κριτής αδειών το λέει `unreadable` (άρνηση με όνομα, ορατή στον υπεύθυνο), αντί να
 * εξαφανίζεται σιωπηλά από τη λίστα του.
 */
export function tourAccessRequestFromDocument(raw: unknown, id: string): TourAccessRequest | null {
  if (!isRecord(raw) || !isTourAccessRequestState(raw.state)) return null;
  const [tourId, requesterUid] = [text(raw.tourId), text(raw.requesterUid)];
  const requestedAt = normalizeToISO(raw.requestedAt);
  const requestCount = raw.requestCount;
  const revokedAt = readOptionalInstant(raw.revokedAt);
  if (tourId === null || requesterUid === null || requestedAt === null || revokedAt === undefined) return null;
  if (!Number.isInteger(requestCount) || (requestCount as number) < 1) return null;
  const viewCount = readViewCount(raw.viewCount);
  const lastViewedAt = readOptionalInstant(raw.lastViewedAt);
  if (viewCount === null || lastViewedAt === undefined) return null;
  return {
    id, tourId, requesterUid, requestedAt,
    state: raw.state,
    message: text(raw.message),
    requestCount: requestCount as number,
    decidedAt: normalizeToISO(raw.decidedAt),
    decidedBy: text(raw.decidedBy),
    expiresAt: normalizeToISO(raw.expiresAt),
    revokedAt,
    revokedBy: text(raw.revokedBy),
    viewCount,
    lastViewedAt,
    contactId: text(raw.contactId),
  };
}

/**
 * Ο μετρητής επισκέψεων: **απών** ⇒ `0` (έγγραφα πριν το Κ3β — ιστορικά σωστό: τότε δεν υπήρχε θέαση)·
 * **παρών αλλά άκυρος** ⇒ `null` (βλάβη, όχι «καμία επίσκεψη»).
 */
function readViewCount(raw: unknown): number | null {
  if (raw === undefined || raw === null) return 0;
  return isCount(raw) ? raw : null;
}

/**
 * **Διαβάζει μια άδεια λήψης.** Άδεια χωρίς αναγνώσιμη λήξη ⇒ `null`: **κανένα** ανέβασμα (fail-closed) —
 * εδώ, αντίθετα με το αίτημα, το «σβήσιμο» σημαίνει **άρνηση**, και αυτή είναι η ασφαλής κατεύθυνση.
 */
export function tourCaptureGrantFromDocument(raw: unknown, granteeUid: string): TourCaptureGrant | null {
  if (!isRecord(raw)) return null;
  const scopes = readAll(raw.scopes, (item) => (isTourGrantScope(item) ? item : null));
  const [tourId, createdBy, reason] = [text(raw.tourId), text(raw.createdBy), text(raw.reason)];
  const [expiresAt, createdAt] = [normalizeToISO(raw.expiresAt), normalizeToISO(raw.createdAt)];
  const revokedAt = readOptionalInstant(raw.revokedAt);
  if (scopes === null || tourId === null || createdBy === null || reason === null) return null;
  if (expiresAt === null || createdAt === null || revokedAt === undefined) return null;
  return {
    granteeUid, tourId, scopes, expiresAt, createdAt, createdBy, reason, revokedAt,
    revokedBy: text(raw.revokedBy),
    invitationId: text(raw.invitationId),
  };
}

/** Οι προαιρετικές στιγμές της πρόσκλησης — `undefined` αν **οποιαδήποτε** υπάρχει αλλά δεν διαβάζεται. */
function readInvitationInstants(raw: Record<string, unknown>) {
  const [openedAt, resolvedAt, mailboxProvenAt] = [raw.openedAt, raw.resolvedAt, raw.mailboxProvenAt].map(readOptionalInstant);
  if (openedAt === undefined || resolvedAt === undefined || mailboxProvenAt === undefined) return undefined;
  return { openedAt, resolvedAt, mailboxProvenAt };
}

/**
 * **Διαβάζει μια πρόσκληση φωτογράφου** (Κ2β). Ό,τι δεν διαβάζεται ⇒ `null`, και ο πυρήνας το λέει
 * `invitation-corrupt` — **καμία** άδεια δεν γεννιέται από έγγραφο που δεν καταλάβαμε. Η κατάσταση ελέγχεται
 * εδώ **αυστηρά**· τη fail-closed ανάγνωσή της για τις αρνήσεις την κάνει ο πυρήνας (`readStoredInvitationState`).
 */
export function tourCaptureInvitationFromDocument(raw: unknown, id: string): TourCaptureInvitation | null {
  if (!isRecord(raw) || !isInvitationState(raw.state)) return null;
  const [tourId, inviteeEmail, invitedByUid, nonceHash, reason] =
    [raw.tourId, raw.inviteeEmail, raw.invitedByUid, raw.nonceHash, raw.reason].map(text);
  const [createdAt, expiresAt, grantExpiresAt] = [raw.createdAt, raw.expiresAt, raw.grantExpiresAt].map(normalizeToISO);
  const subject = readSubject(raw.subject);
  const custody = custodyScopeFromData(raw);
  const instants = readInvitationInstants(raw);
  if (!tourId || !inviteeEmail || !invitedByUid || !nonceHash || !reason || subject === null) return null;
  if (!createdAt || !expiresAt || !grantExpiresAt || instants === undefined || custody === null) return null;
  return {
    ...custodyOnly(custody),
    id, tourId, subject, inviteeEmail, invitedByUid, nonceHash, reason, createdAt, expiresAt, grantExpiresAt,
    state: raw.state,
    resolvedByUid: text(raw.resolvedByUid),
    ...instants,
  };
}
