import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { createModuleLogger } from '@/lib/telemetry';
import { ENTITY_TYPES, SYSTEM_IDENTITY } from '@/config/domain-constants';
import { derivedChange, recordDerivedWrites, type FloorCascadeActor } from './_shared/floor-cascade-audit';
import { isSpecialLevel, readFloorStack, type FloorStackRow } from './_shared/floor-stack-rows';
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

/** The floor shape the reconcile reasons over — ADR-461: special levels keep explicit heights. */
type FloorRow = FloorStackRow;

/** Round to millimetre precision (normalising −0 → 0) to avoid float drift. */
function roundM(value: number): number {
  const r = Math.round(value * 1000) / 1000;
  return r === 0 ? 0 : r;
}

function approxEqOrNull(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) <= RECONCILE_EPSILON_M;
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
 * - ADR-195: each re-derived storey gets its own audit entry — performed by the machine
 *   (`system:floor-stack`), caused by the human edit (`actor.cause`).
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
  actor: FloorCascadeActor,
): Promise<ElevationEditReconcileResult> {
  const { updatedBy } = actor;
  const { rows, refById } = await readFloorStack(db, buildingId, companyId);
  if (rows.length === 0) return { heightsUpdated: [], skipped: 0 };

  const derivations: HeightDerivation[] = [];
  const audits: { row: FloorRow; oldValue: number; newValue: number }[] = [];
  let skipped = 0;

  // Normalise every COUNTED storey's height to the gap up to the next COUNTED
  // storey (`elev[next] − elev[i]`). Consistent storeys no-op; only the genuinely
  // changed (or stale) ones are re-written — full-stack self-heal so stored heights
  // can never drift from the SSoT elevations.
  //
  // ADR-461 — special levels (foundation depth, stair-penthouse / roof height) keep
  // their EXPLICIT height: a foundation depth is not a derived inter-floor gap, so
  // it is never overwritten here. The derivation also reaches OVER an intervening
  // special level to the next counted storey, so a penthouse between two counted
  // storeys would not distort the lower storey's derived height. The top counted
  // storey (no counted floor above) keeps its explicit height.
  for (let idx = 0; idx < rows.length; idx++) {
    const storey = rows[idx];
    if (isSpecialLevel(storey)) { skipped++; continue; }
    let above: FloorRow | null = null;
    for (let j = idx + 1; j < rows.length; j++) {
      if (!isSpecialLevel(rows[j])) { above = rows[j]; break; }
    }
    if (above === null) { skipped++; continue; }
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
    await recordHeightAudit(audits, companyId, actor);
  }

  logger.info('[FloorStackReconcile] Elevation-edit derived heights', {
    buildingId, changedFloorId, derived: derivations.length, skipped,
  });
  return { heightsUpdated: derivations, skipped };
}

async function recordHeightAudit(
  audits: ReadonlyArray<{ row: FloorRow; oldValue: number; newValue: number }>,
  companyId: string,
  actor: FloorCascadeActor,
): Promise<void> {
  await recordDerivedWrites(
    SYSTEM_IDENTITY.FLOOR_STACK_ID,
    audits.map((a) => ({
      entityType: ENTITY_TYPES.FLOOR,
      entityId: a.row.id,
      entityName: a.row.name,
      changes: [derivedChange('height', a.oldValue, a.newValue)],
    })),
    actor,
    companyId,
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
  actor: FloorCascadeActor,
  edit: { elevationChanged: boolean; heightChanged: boolean; newHeightMetres: number | null },
): Promise<FloorStackReconcileResult> {
  if (edit.elevationChanged) {
    const res = await deriveAdjacentHeightsFromElevation(db, buildingId, floorId, companyId, actor);
    for (const d of res.heightsUpdated) {
      await cascadeFloorHeightToEntities(db, d.floorId, companyId, d.newHeightMetres, actor);
    }
    return { mode: 'elevation', elevationsPushed: 0, heightsDerived: res.heightsUpdated };
  }

  if (edit.heightChanged && edit.newHeightMetres !== null) {
    await cascadeFloorHeightToEntities(db, floorId, companyId, edit.newHeightMetres, actor);
    const pushed = await cascadeFloorElevations(db, buildingId, floorId, companyId, actor);
    return { mode: 'height', elevationsPushed: pushed.floorsUpdated, heightsDerived: [] };
  }

  return { mode: 'none', elevationsPushed: 0, heightsDerived: [] };
}

/**
 * ADR-461 — Revit-true SATELLITE PLACEMENT: special levels always sit at the
 * extremes of the counted backbone, in BOTH `number` and `elevation`.
 *   - foundation → ΠΑΝΤΑ κάτω: `number = lowestCounted.number − 1`,
 *     `elevation = lowestCounted.elevation − depth (its own height)`.
 *   - roof / stair-penthouse → ΠΑΝΤΑ πάνω: stacked above `topCounted`
 *     (`number = prev.number + 1`, `elevation = prev.elevation + prev.height`).
 *
 * Idempotent: a special already in place → no write. Called after a counted storey
 * is created/deleted so adding a basement pushes the foundation further down, and
 * adding a top floor pushes the penthouse further up — the special never ends up
 * sandwiched inside the occupied stack. Multiple specials on a side are stacked in
 * their current relative order.
 *
 * All metres (ADR-369). Returns how many special levels were re-placed.
 */
export async function reconcileSpecialLevelPlacement(
  db: Firestore,
  buildingId: string,
  companyId: string,
  actor: FloorCascadeActor,
): Promise<number> {
  const { updatedBy } = actor;
  const { rows, refById } = await readFloorStack(db, buildingId, companyId);
  const counted = rows.filter((r) => !isSpecialLevel(r));
  if (counted.length === 0) return 0; // nothing to anchor against (degenerate)

  const minCounted = counted[0];
  const maxCounted = counted[counted.length - 1];

  interface Placement { row: FloorRow; number: number; elevation: number | null; }
  const placements: Placement[] = [];

  // Below-grade specials (foundation) — stacked UNDER minCounted, deepest last.
  const below = rows.filter((r) => r.kind === 'foundation').sort((a, b) => b.number - a.number);
  let belowNum = minCounted.number;
  let belowElev = minCounted.elevation;
  for (const f of below) {
    const num = belowNum - 1;
    const elev = belowElev !== null ? roundM(belowElev - f.height) : null;
    if (f.number !== num || !approxEqOrNull(f.elevation, elev)) placements.push({ row: f, number: num, elevation: elev });
    belowNum = num;
    belowElev = elev;
  }

  // Above specials (roof, stair-penthouse) — stacked ABOVE maxCounted, in order.
  const above = rows
    .filter((r) => r.kind === 'roof' || r.kind === 'stair-penthouse')
    .sort((a, b) => a.number - b.number);
  let topNum = maxCounted.number;
  let topElev = maxCounted.elevation;
  let topHeight = maxCounted.height;
  for (const s of above) {
    const num = topNum + 1;
    const elev = topElev !== null ? roundM(topElev + topHeight) : null;
    if (s.number !== num || !approxEqOrNull(s.elevation, elev)) placements.push({ row: s, number: num, elevation: elev });
    topNum = num;
    topElev = elev;
    topHeight = s.height;
  }

  if (placements.length === 0) return 0;

  const batch = db.batch();
  const updatedAt = FieldValue.serverTimestamp();
  for (const p of placements) {
    const ref = refById.get(p.row.id);
    if (ref) batch.update(ref, { number: p.number, elevation: p.elevation, updatedBy, updatedAt });
  }
  await batch.commit();

  await recordDerivedWrites(
    SYSTEM_IDENTITY.FLOOR_STACK_ID,
    placements.map((p) => ({
      entityType: ENTITY_TYPES.FLOOR,
      entityId: p.row.id,
      entityName: p.row.name,
      changes: [
        derivedChange('number', p.row.number, p.number),
        derivedChange('elevation', p.row.elevation, p.elevation),
      ],
    })),
    actor,
    companyId,
  );

  logger.info('[FloorStackReconcile] Re-placed special levels', { buildingId, placed: placements.length });
  return placements.length;
}
