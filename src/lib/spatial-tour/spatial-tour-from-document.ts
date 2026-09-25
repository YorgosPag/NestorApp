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
  isTourGrantScope,
  isTourLinkVia,
  isTourMilestone,
  isTourTilesetState,
} from '@/constants/spatial-tour-vocabulary';
import { text } from '@/lib/agency/showcase-read-primitives';
import { normalizeToISO } from '@/lib/date-local';
import { readSignatory } from '@/lib/listings/model-declaration-metadata';
import { readMediaRights } from '@/lib/media-rights/media-rights-read';
import { readProfessionalAttestation } from '@/lib/professional/professional-attestation';
import { isRecord } from '@/lib/type-guards';
import { custodyOnly, custodyScopeFromData } from '@/lib/workspace/custody-scope';
import { isInvitationState } from '@/types/invitation-core';
import type {
  FloorPlanRecord,
  SpatialTour,
  TourAccessRequest,
  TourCapture,
  TourCaptureGrant,
  TourCaptureInvitation,
  TourCaptureSignatory,
  TourCaptureTileset,
  TourLevel,
  TourLevelKey,
  TourLink,
  TourNode,
  TourPoint,
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

function readLevelKey(raw: unknown): TourLevelKey | null {
  if (!isRecord(raw)) return null;
  if (raw.kind === 'floor') {
    const floorId = text(raw.floorId);
    return floorId === null ? null : { kind: 'floor', floorId };
  }
  if (raw.kind === 'local' && Number.isInteger(raw.ordinal)) return { kind: 'local', ordinal: raw.ordinal as number };
  return null;
}

function readFloorPlan(raw: unknown): FloorPlanRecord | null {
  if (!isRecord(raw) || !isFloorPlanSource(raw.source) || !isFloorPlanRecordState(raw.state)) return null;
  return {
    source: raw.source,
    state: raw.state,
    fileId: text(raw.fileId),
    approvedBy: text(raw.approvedBy),
    approvedAt: normalizeToISO(raw.approvedAt),
  };
}

function readLevel(raw: unknown): TourLevel | null {
  if (!isRecord(raw)) return null;
  const key = readLevelKey(raw.key);
  const floorPlans = readAll(raw.floorPlans, readFloorPlan);
  return key === null || floorPlans === null ? null : { key, floorPlans };
}

function readPoint(raw: unknown): TourPoint | null | undefined {
  if (raw === null) return null;
  if (!isRecord(raw) || !isFiniteNumber(raw.x) || !isFiniteNumber(raw.y) || !isFiniteNumber(raw.z)) return undefined;
  return { x: raw.x, y: raw.y, z: raw.z };
}

function readLink(raw: unknown): TourLink | null {
  if (!isRecord(raw) || !isTourLinkVia(raw.via)) return null;
  const toNodeId = text(raw.toNodeId);
  return toNodeId === null ? null : { toNodeId, via: raw.via };
}

function readNode(raw: unknown): TourNode | null {
  if (!isRecord(raw)) return null;
  const id = text(raw.id);
  const levelKey = readLevelKey(raw.levelKey);
  // `undefined` ⇒ υπάρχει θέση αλλά δεν διαβάζεται· `null` ⇒ δηλωμένα χωρίς θέση (όροφος χωρίς κάτοψη).
  const position = readPoint(raw.position ?? null);
  const links = readAll(raw.links ?? [], readLink);
  if (id === null || levelKey === null || position === undefined || links === null) return null;
  return { id, levelKey, position, links };
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
  return {
    id, custody, subject, levels, nodes,
    visibility: raw.visibility,
    lifecycle: raw.lifecycle,
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
  return { state: raw.state, contentHash: text(raw.contentHash) };
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

/** **Διαβάζει ένα αποθηκευμένο έγγραφο ως λήψη.** Λήψη χωρίς αναγνώσιμα δικαιώματα ⇒ `null` (Φ0.14). */
export function tourCaptureFromDocument(raw: unknown, id: string): TourCapture | null {
  if (!isRecord(raw)) return null;
  const vocabulary = readCaptureVocabulary(raw);
  const signatory = readCaptureSignatory(raw.signatory);
  const rights = readMediaRights(raw.rights);
  const tileset = readTileset(raw.tileset);
  const [tourId, nodeId, originalFileId, uploadedBy] = [raw.tourId, raw.nodeId, raw.originalFileId, raw.uploadedBy].map(text);
  const [capturedAt, createdAt] = [normalizeToISO(raw.capturedAt), normalizeToISO(raw.createdAt)];
  if (vocabulary === null || signatory === undefined || rights === null || tileset === null) return null;
  if (tourId === null || nodeId === null || originalFileId === null || uploadedBy === null) return null;
  if (capturedAt === null || createdAt === null || !isFiniteNumber(raw.headingRad)) return null;
  return {
    id, tourId, nodeId, capturedAt, createdAt, originalFileId, uploadedBy, rights, tileset, signatory,
    ...vocabulary,
    headingRad: raw.headingRad,
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
  };
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
