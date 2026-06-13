import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { DEFAULT_FLOOR_HEIGHT_M } from '@/utils/floor-naming';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuditFieldChange } from '@/types/audit-trail';
import { cascadeFloorElevations } from './floor-elevation-cascade.service';
import { cascadeFloorHeightToEntities } from './floor-height-cascade.service';

const logger = createModuleLogger('FloorStackReconcile');

/** Metres — heights/elevations compared with this tolerance (sub-millimetre). */
const RECONCILE_EPSILON_M = 1e-4;

// ─── Re-export so this module is the single home for stack-reconcile logic ────
export { cascadeFloorElevations } from './floor-elevation-cascade.service';

/** One derived storey height (metres) the elevation-edit re-derived and persisted. */
export interface HeightDerivation {
  readonly floorId: string;
  readonly newHeightMetres: number;
}

export interface ElevationEditReconcileResult {
  /** Storeys whose derived height changed → caller re-stretches their entities. */
  readonly heightsUpdated: readonly HeightDerivation[];
  /** Candidate storeys already at their derived height (idempotent no-op). */
  readonly skipped: number;
}

export interface FloorStackReconcileResult {
  readonly mode: 'elevation' | 'height' | 'none';
  /** Upper floors whose FFL was pushed (height-edit branch, ADR-450 §1). */
  readonly elevationsPushed: number;
  /** Storeys whose derived height was re-written (elevation-edit branch). */
  readonly heightsDerived: readonly HeightDerivation[];
}

/** Minimal floor shape the reconcile reasons over. */
interface FloorRow {
  readonly id: string;
  readonly name: string;
  readonly number: number;
  readonly elevation: number | null;
  readonly height: number;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function readBuildingFloors(
  db: Firestore,
  buildingId: string,
  companyId: string,
): Promise<{ rows: FloorRow[]; refById: Map<string, FirebaseFirestore.DocumentReference> }> {
  const snap = await db.collection(COLLECTIONS.FLOORS)
    .where('companyId', '==', companyId)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .get();

  const refById = new Map(snap.docs.map((d) => [d.id, d.ref] as const));
  const rows: FloorRow[] = snap.docs
    .map((d) => ({
      id: d.id,
      name: (d.data().name as string) ?? d.id,
      number: finite(d.data().number, 0),
      elevation: finiteOrNull(d.data().elevation),
      height: finite(d.data().height, DEFAULT_FLOOR_HEIGHT_M),
    }))
    .sort((a, b) => a.number - b.number);

  return { rows, refById };
}

/**
 * ADR-451 §«elevation-branch» — Revit «move a Level» (FULL-SSoT self-heal).
 *
 * Triggered when `floor.elevation` changes (the SSoT — the absolute Level truth).
 * Because `height[i] = elevation[i+1] − elevation[i]` is a **derived projection**,
 * this normalises the WHOLE stored stack so every persisted `height` equals the
 * gap to the floor above — never a value that can drift from the elevations the
 * columns/beams/3D read (ADR-450 §2). In practice only the moved floor's two
 * adjacent storeys differ; the rest are already consistent and skip (idempotent).
 * But walking the full stack ALSO self-heals any pre-existing stale heights in one
 * pass, so the table, the 3D model and the consumers can never disagree.
 *
 * The topmost floor keeps its **explicit** height (no floor above to derive from).
 *
 * - Self-healing (absolute, not delta): recomputes from stored elevations.
 * - Idempotent: a storey already at its derived height → no write, no audit.
 * - ADR-195: each re-derived storey gets an EntityAuditService.recordChange entry.
 *
 * All heights/elevations in METRES (ADR-369 §1). Returns the storeys whose height
 * changed so the caller can re-stretch their entities ({@link cascadeFloorHeightToEntities}).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
 */
export async function deriveAdjacentHeightsFromElevation(
  db: Firestore,
  buildingId: string,
  changedFloorId: string,
  companyId: string,
  updatedBy: string,
): Promise<ElevationEditReconcileResult> {
  const { rows, refById } = await readBuildingFloors(db, buildingId, companyId);
  if (rows.length === 0) return { heightsUpdated: [], skipped: 0 };

  const derivations: HeightDerivation[] = [];
  const audits: { row: FloorRow; oldValue: number; newValue: number }[] = [];
  let skipped = 0;

  // Normalise EVERY storey's height to the gap above it (`elev[i+1] − elev[i]`).
  // Consistent storeys no-op; only the genuinely changed (or stale) ones are
  // re-written — full-stack self-heal so stored heights can never drift from the
  // SSoT elevations. The top floor (no floor above) keeps its explicit height.
  for (let idx = 0; idx < rows.length - 1; idx++) {
    const storey = rows[idx];
    const above = rows[idx + 1];
    if (storey.elevation === null || above.elevation === null) { skipped++; continue; }
    const derived = above.elevation - storey.elevation;
    if (Math.abs(storey.height - derived) <= RECONCILE_EPSILON_M) { skipped++; continue; }
    audits.push({ row: storey, oldValue: storey.height, newValue: derived });
    derivations.push({ floorId: storey.id, newHeightMetres: derived });
  }
  void changedFloorId; // kept for caller signature + logging context

  if (audits.length > 0) {
    const batch = db.batch();
    const updatedAt = FieldValue.serverTimestamp();
    for (const a of audits) {
      const ref = refById.get(a.row.id);
      if (ref) batch.update(ref, { height: a.newValue, updatedBy, updatedAt });
    }
    await batch.commit();
    await recordHeightAudit(audits, companyId, updatedBy);
  }

  logger.info('[FloorStackReconcile] Elevation-edit derived heights', {
    buildingId, changedFloorId, derived: derivations.length, skipped,
  });
  return { heightsUpdated: derivations, skipped };
}

async function recordHeightAudit(
  audits: ReadonlyArray<{ row: FloorRow; oldValue: number; newValue: number }>,
  companyId: string,
  performedBy: string,
): Promise<void> {
  await Promise.all(
    audits.map((a) => {
      const change: AuditFieldChange = {
        field: 'height',
        oldValue: a.oldValue,
        newValue: a.newValue,
        label: 'height',
      };
      return EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.FLOOR,
        entityId: a.row.id,
        entityName: a.row.name,
        action: 'updated',
        changes: [change],
        performedBy,
        performedByName: null,
        companyId,
      });
    }),
  );
}

/**
 * ADR-451 §«ΕΝΑ ενοποιημένο cascade» — single server-authoritative entry point for
 * the floor-stack invariant `height[i] = elevation[i+1] − elevation[i]`, with
 * `elevation` the SSoT and `height` the derived projection.
 *
 * Dispatch by which field the user actually changed (elevation wins when both):
 *   - **elevation** edit → {@link deriveAdjacentHeightsFromElevation} (re-derive the
 *     two adjacent storey heights, persist them) + re-stretch only those storeys'
 *     entities. Nobody else moves.
 *   - **height** edit → ADR-450 §1 push: re-stretch the changed floor's entities
 *     ({@link cascadeFloorHeightToEntities}) + shift every upper floor's FFL
 *     ({@link cascadeFloorElevations}). Used for the top floor's explicit height and
 *     all programmatic/DXF height changes.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-451-building-vertical-setup-floor-ssot.md
 */
export async function reconcileFloorStackAfterEdit(
  db: Firestore,
  buildingId: string,
  floorId: string,
  companyId: string,
  updatedBy: string,
  edit: { elevationChanged: boolean; heightChanged: boolean; newHeightMetres: number | null },
): Promise<FloorStackReconcileResult> {
  if (edit.elevationChanged) {
    const res = await deriveAdjacentHeightsFromElevation(db, buildingId, floorId, companyId, updatedBy);
    for (const d of res.heightsUpdated) {
      await cascadeFloorHeightToEntities(db, d.floorId, companyId, d.newHeightMetres, updatedBy);
    }
    return { mode: 'elevation', elevationsPushed: 0, heightsDerived: res.heightsUpdated };
  }

  if (edit.heightChanged && edit.newHeightMetres !== null) {
    await cascadeFloorHeightToEntities(db, floorId, companyId, edit.newHeightMetres, updatedBy);
    const pushed = await cascadeFloorElevations(db, buildingId, floorId, companyId, updatedBy);
    return { mode: 'height', elevationsPushed: pushed.floorsUpdated, heightsDerived: [] };
  }

  return { mode: 'none', elevationsPushed: 0, heightsDerived: [] };
}
