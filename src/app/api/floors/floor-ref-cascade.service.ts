import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { FIELDS } from '@/config/firestore-field-constants';
import { flushInBatches, type BatchUpdate } from '@/lib/admin-batch-utils';
import { createModuleLogger } from '@/lib/telemetry';
import { hostedCopyDrift, hostedCopyOf, type HostedFloorCopy, type HostFloorSource } from '@/lib/floor/hosted-floor';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditEntityType, AuditFieldChange } from '@/types/audit-trail';
import type { PropertyLevel } from '@/types/property';

const logger = createModuleLogger('FloorRefCascade');

/**
 * ADR-903 §6 — **«Home Story»**: αλλάζει ο όροφος ⇒ ό,τι φιλοξενεί **ακολουθεί** (ArchiCAD/Revit).
 *
 * Τα ακίνητα, οι θέσεις και οι αποθήκες κρατούν `floorId` (αυθεντία) + αντίγραφο `floor`/`floorKind`
 * (Firestore χωρίς join). Ως τις 2026-10-03 **κανείς** δεν ενημέρωνε το αντίγραφο όταν ο όροφος
 * αναριθμούνταν ⇒ λάθος όροφος σε λίστες, φίλτρα, αγγελίες, email.
 *
 * - **Ιδεμποτικό**: ρωτά το ίδιο `hostedCopyDrift` με τη μετανάστευση — συμφωνεί ⇒ καμία γραφή.
 * - **Παρτίδες** `flushInBatches` (450)· αποτυχημένη παρτίδα μετριέται (`failed`), δεν κρύβεται.
 * - **Ενοικιαστής**: κάθε ερώτημα με `companyId` (CHECK 3.10/3.35) — ισότητες μόνο ⇒ κανένας σύνθετος δείκτης.
 * - **Ίχνος** ADR-195: `recordChange` ανά έγγραφο που άλλαξε.
 * - Μεζονέτες (ADR-236): το `levels[]` κρατά δικό του αντίγραφο (`floorNumber`, `name`) — ενημερώνεται κι αυτό.
 */
export interface FloorRefCascadeResult {
  readonly properties: number;
  readonly parking: number;
  readonly storage: number;
  /** Έγγραφα σε παρτίδες που απέτυχαν — > 0 ⇒ ο καλών προειδοποιεί. */
  readonly failed: number;
}

/** Ο όροφος όπως είναι **μετά** την αλλαγή. */
export interface CascadeFloor extends HostFloorSource {
  readonly buildingId: string;
  readonly name?: string;
}

interface HostedTarget {
  readonly collection: string;
  readonly entityType: Extract<AuditEntityType, 'property' | 'parking' | 'storage'>;
}

const HOSTED_TARGETS: readonly HostedTarget[] = [
  { collection: COLLECTIONS.PROPERTIES, entityType: ENTITY_TYPES.PROPERTY },
  { collection: COLLECTIONS.PARKING_SPACES, entityType: 'parking' },
  { collection: COLLECTIONS.STORAGE, entityType: ENTITY_TYPES.STORAGE },
];

interface PlannedWrite {
  readonly entityType: HostedTarget['entityType'];
  readonly doc: QueryDocumentSnapshot;
  readonly fields: Record<string, unknown>;
  readonly changes: AuditFieldChange[];
}

export async function cascadeFloorRefToHosted(
  db: Firestore,
  floor: CascadeFloor,
  companyId: string,
  updatedBy: string,
): Promise<FloorRefCascadeResult> {
  const expected = hostedCopyOf(floor);
  const planned = await planHostedWrites(db, floor, expected, companyId);

  const updatedAt = FieldValue.serverTimestamp();
  const updates: BatchUpdate[] = planned.map((p) => ({
    ref: p.doc.ref,
    data: { ...p.fields, updatedBy, updatedAt },
  }));
  const flush = await flushInBatches(db, updates);
  // Το ίχνος γράφεται μόνο για ό,τι **σίγουρα** γράφτηκε. Σε αποτυχία ο καλών προειδοποιεί·
  // η επανάληψη (ιδεμποτική) ξαναβρίσκει μόνο την απόκλιση που έμεινε και την καταγράφει τότε.
  if (flush.errors.length > 0) {
    logger.error('[FloorRefCascade] Batch failures', { floorId: floor.id, errors: flush.errors });
  } else {
    await recordCascadeAudit(planned, companyId, updatedBy);
  }
  const result = summarise(planned, updates.length - flush.written);
  logger.info('[FloorRefCascade] Complete', { floorId: floor.id, ...result });
  return result;
}

/** Όλες οι γραφές που χρειάζονται — ανά έγγραφο, συγχωνευμένες (μονό + μεζονέτα στο ίδιο ακίνητο). */
async function planHostedWrites(
  db: Firestore,
  floor: CascadeFloor,
  expected: HostedFloorCopy,
  companyId: string,
): Promise<PlannedWrite[]> {
  const [direct, maisonettes] = await Promise.all([
    Promise.all(HOSTED_TARGETS.map((t) => queryHosted(db, t.collection, companyId, floor.id))),
    queryMaisonettes(db, companyId, floor.buildingId),
  ]);

  const byPath = new Map<string, PlannedWrite>();
  HOSTED_TARGETS.forEach((target, i) => {
    for (const doc of direct[i]) {
      const drift = hostedCopyDrift(doc.data(), expected);
      if (drift) mergeWrite(byPath, target.entityType, doc, drift as Record<string, unknown>);
    }
  });
  for (const doc of maisonettes) {
    const levels = syncLevels(doc.data().levels, floor, expected);
    if (levels) mergeWrite(byPath, ENTITY_TYPES.PROPERTY, doc, { levels });
  }
  return [...byPath.values()];
}

async function queryHosted(
  db: Firestore,
  collection: string,
  companyId: string,
  floorId: string,
): Promise<QueryDocumentSnapshot[]> {
  const snap = await db.collection(collection)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where(FIELDS.FLOOR_ID, '==', floorId)
    .get();
  return snap.docs;
}

/** Οι μεζονέτες του κτιρίου — λίγες· το `levels[]` δεν ερωτάται με `floorId` (πίνακας αντικειμένων). */
async function queryMaisonettes(db: Firestore, companyId: string, buildingId: string): Promise<QueryDocumentSnapshot[]> {
  const snap = await db.collection(COLLECTIONS.PROPERTIES)
    .where(FIELDS.COMPANY_ID, '==', companyId)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .where('isMultiLevel', '==', true)
    .get();
  return snap.docs;
}

/** Το `levels[]` με το αντίγραφο του ορόφου ενημερωμένο, ή `null` όταν ήδη συμφωνεί. */
function syncLevels(raw: unknown, floor: CascadeFloor, expected: HostedFloorCopy): PropertyLevel[] | null {
  if (!Array.isArray(raw)) return null;
  const levels = raw as PropertyLevel[];
  let changed = false;
  const next = levels.map((level) => {
    if (level.floorId !== floor.id) return level;
    const name = floor.name ?? level.name;
    if (level.floorNumber === expected.floor && level.name === name) return level;
    changed = true;
    return { ...level, floorNumber: expected.floor ?? level.floorNumber, name };
  });
  return changed ? next.sort((a, b) => a.floorNumber - b.floorNumber) : null;
}

function mergeWrite(
  byPath: Map<string, PlannedWrite>,
  entityType: HostedTarget['entityType'],
  doc: QueryDocumentSnapshot,
  fields: Record<string, unknown>,
): void {
  const previous = byPath.get(doc.ref.path);
  const data = doc.data();
  const changes = Object.entries(fields).map(([field, newValue]): AuditFieldChange => ({
    field,
    oldValue: (data[field] ?? null) as AuditFieldChange['oldValue'],
    newValue: newValue as AuditFieldChange['newValue'],
    label: field,
  }));
  byPath.set(doc.ref.path, {
    entityType,
    doc,
    fields: { ...previous?.fields, ...fields },
    changes: [...(previous?.changes ?? []), ...changes],
  });
}

function summarise(planned: readonly PlannedWrite[], failed: number): FloorRefCascadeResult {
  const count = (type: HostedTarget['entityType']) => planned.filter((p) => p.entityType === type).length;
  return { properties: count(ENTITY_TYPES.PROPERTY), parking: count('parking'), storage: count(ENTITY_TYPES.STORAGE), failed };
}

async function recordCascadeAudit(planned: readonly PlannedWrite[], companyId: string, performedBy: string): Promise<void> {
  await Promise.all(planned.map((p) => EntityAuditService.recordChange({
    entityType: p.entityType,
    entityId: p.doc.id,
    entityName: (p.doc.data().name as string | undefined) ?? (p.doc.data().number as string | undefined) ?? p.doc.id,
    action: 'updated',
    changes: p.changes,
    performedBy,
    performedByName: null,
    companyId,
  })));
}
