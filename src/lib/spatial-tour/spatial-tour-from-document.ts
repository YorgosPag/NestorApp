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
  isTourCaptureAudience,
  isTourCaptureProvenance,
  isTourCaptureSource,
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
import { custodyScopeFromData } from '@/lib/workspace/custody-scope';
import type {
  FloorPlanRecord,
  SpatialTour,
  TourCapture,
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
