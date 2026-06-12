import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore, QuerySnapshot, WriteBatch } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditEntityType, AuditFieldChange } from '@/types/audit-trail';

const logger = createModuleLogger('FloorHeightCascade');

export interface CascadeResult {
  readonly wallsUpdated: number;
  readonly columnsUpdated: number;
  readonly slabsUpdated: number;
  readonly beamsUpdated: number;
  readonly skipped: number;
}

/** Storey-driven params read across every cascade target (super-set, all optional). */
interface CascadeParams {
  readonly topBinding?: string;
  readonly baseOffset?: number;
  readonly topOffset?: number;
  readonly height?: number;
  readonly kind?: string;
  readonly levelElevation?: number;
  // ── Beam storey linkage (ADR-448 Phase 4b) ──
  readonly topElevation?: number;
  readonly topElevationEnd?: number;
  readonly offsetFromStorey?: number;
}

interface CascadeDoc {
  readonly params?: CascadeParams;
}

interface CascadedEntry {
  readonly docId: string;
  readonly field: string;
  readonly oldValue: number | null;
  readonly newValue: number;
}

interface TargetResult {
  readonly entityType: AuditEntityType;
  readonly entries: CascadedEntry[];
  readonly skipped: number;
}

/**
 * One cascade target = one floor-scoped collection + how its storey-bound
 * entities re-stretch when `floor.height` changes. Adding a new storey-driven
 * entity kind = one entry here (Boy-Scout SSoT — no duplicated per-collection
 * loop).
 */
interface CascadeTarget {
  readonly collection: string;
  readonly entityType: AuditEntityType;
  /** The Firestore field path that holds the storey-driven value. */
  readonly field: string;
  /** Whether this entity follows the storey ceiling (skip otherwise). */
  readonly shouldCascade: (params: CascadeParams) => boolean;
  /** Current persisted value (for audit + idempotent no-op detection). */
  readonly readValue: (params: CascadeParams) => number | null;
  /** New value derived from the new floor height (mm). */
  readonly derive: (params: CascadeParams, newHeightMm: number) => number;
  /**
   * Optional extra field updates beyond `field`, batched on the same doc when the
   * primary field changes (ADR-448 Phase 4b — sloped-beam `topElevationEnd`, slope
   * preserved). `newValue` = the just-derived primary value.
   */
  readonly extraUpdates?: (params: CascadeParams, newValue: number) => Record<string, number> | null;
}

/**
 * Storey-driven cascade derivation for vertically-extruded structure
 * (walls + columns): `params.height = floor.height*1000 + topOffset − baseOffset`.
 *
 * Gate (ADR-448 Phase 4b): cascades both `storey-ceiling` AND `attached` tops —
 * in grid-first construction (ADR-441/401) columns/walls become `attached` to a
 * beam/slab host. The derived nominal rises; the render-time lower-envelope then
 * clips to the host face (which also rose via the beam/slab cascade) → the whole
 * frame stretches consistently. `absolute`/`unconnected` = user-pinned → skipped.
 */
const STRETCH_TARGET = {
  field: 'params.height',
  shouldCascade: (p: CascadeParams) =>
    p.topBinding === 'storey-ceiling' || p.topBinding === 'attached',
  readValue: (p: CascadeParams) => p.height ?? null,
  derive: (p: CascadeParams, mm: number) => mm + (p.topOffset ?? 0) - (p.baseOffset ?? 0),
} as const;

const CASCADE_TARGETS: readonly CascadeTarget[] = [
  { collection: COLLECTIONS.FLOORPLAN_WALLS, entityType: 'wall', ...STRETCH_TARGET },
  { collection: COLLECTIONS.FLOORPLAN_COLUMNS, entityType: 'column', ...STRETCH_TARGET },
  {
    // ADR-448 Phase 4b — beams define the storey ceiling via `params.topElevation`
    // (top face, ADR-369 §2.2). All beams are storey-driven (offsetFromStorey,
    // no pinned/absolute flag today) → cascade all. Sloped beams (topElevationEnd,
    // ADR-401) keep their slope span via `extraUpdates`. `zOffset` stays untouched
    // (drop-from-ceiling, applied render-side, ADR-369 §854).
    collection: COLLECTIONS.FLOORPLAN_BEAMS,
    entityType: 'beam',
    field: 'params.topElevation',
    shouldCascade: () => true,
    readValue: (p) => p.topElevation ?? null,
    derive: (p, mm) => mm + (p.offsetFromStorey ?? 0),
    extraUpdates: (p, newTop) =>
      p.topElevationEnd === undefined
        ? null
        : { 'params.topElevationEnd': newTop + (p.topElevationEnd - (p.topElevation ?? newTop)) },
  },
  {
    // ADR-448 Phase 4 — ceiling/roof slabs carry the floor-relative storey
    // ceiling FFL in `params.levelElevation` (mirror slab-completion.ts +
    // resolveStoreyCeilingElevationMm). floor/ground/foundation slabs are not
    // storey-height-driven → skipped.
    collection: COLLECTIONS.FLOORPLAN_SLABS,
    entityType: 'slab',
    field: 'params.levelElevation',
    shouldCascade: (p) => p.kind === 'ceiling' || p.kind === 'roof',
    readValue: (p) => p.levelElevation ?? null,
    derive: (_p, mm) => mm,
  },
];

/**
 * ADR-369 §9 Q5 + ADR-448 Phase 4 — Auto-stretch cascade (service layer).
 *
 * Triggered when `floor.height` changes. Re-stretches every storey-bound entity
 * of that floor so the WHOLE frame follows (Revit «άλλαξε ύψος ορόφου → τοίχοι +
 * κολώνες + δοκάρια + οροφή ξανα-τεντώνονται»):
 *   - walls + columns with `topBinding ∈ {storey-ceiling, attached}` → `params.height`
 *   - beams → `params.topElevation` (+sloped `topElevationEnd`) (ADR-448 Phase 4b)
 *   - ceiling/roof slabs → `params.levelElevation` (ADR-448 Phase 4)
 *
 * Skipped: `absolute`/`unconnected` structure, non-ceiling/roof slabs, and any
 * entity already at the derived value (idempotent no-op). Absolute/self-healing
 * (not delta) → corrects stale state on the next height change.
 *
 * - Idempotent: same floor.height → same value → no write, no audit.
 * - Belt-and-suspenders: no-op batch when nothing changed.
 * - ADR-195: each updated entity gets an EntityAuditService.recordChange entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5
 * @see docs/centralized-systems/reference/adrs/ADR-448-storey-aware-dxf-viewer.md §6 Phase 4 + 4b
 */
export async function cascadeFloorHeightToEntities(
  db: Firestore,
  floorId: string,
  companyId: string,
  newHeightMetres: number,
  updatedBy: string,
): Promise<CascadeResult> {
  const snaps = await Promise.all(
    CASCADE_TARGETS.map((target) =>
      queryStoreyEntities(db, target.collection, companyId, floorId)),
  );

  const batch = db.batch();
  const newHeightMm = newHeightMetres * 1000;
  const updatedAt = FieldValue.serverTimestamp();
  const perTarget = CASCADE_TARGETS.map((target, i) =>
    collectCascade(snaps[i], target, newHeightMm, batch, updatedBy, updatedAt));

  const updated = perTarget.reduce((n, t) => n + t.entries.length, 0);
  if (updated > 0) {
    await batch.commit();
    await recordCascadeAudit(perTarget, companyId, updatedBy);
  }

  const result = summarise(perTarget);
  logger.info('[FloorHeightCascade] Complete', { floorId, newHeightMetres, ...result });
  return result;
}

function queryStoreyEntities(
  db: Firestore,
  collection: string,
  companyId: string,
  floorId: string,
): Promise<QuerySnapshot> {
  return db.collection(collection)
    .where('companyId', '==', companyId)
    .where('floorId', '==', floorId)
    .get();
}

/**
 * Apply one target's derivation across its snapshot: queue batch updates for the
 * entities that changed, skip the rest (gated-out + idempotent no-ops).
 */
function collectCascade(
  snap: QuerySnapshot,
  target: CascadeTarget,
  newHeightMm: number,
  batch: WriteBatch,
  updatedBy: string,
  updatedAt: FieldValue,
): TargetResult {
  const entries: CascadedEntry[] = [];
  let skipped = 0;
  for (const doc of snap.docs) {
    const params = (doc.data() as CascadeDoc).params;
    if (!params || !target.shouldCascade(params)) { skipped++; continue; }
    const newValue = target.derive(params, newHeightMm);
    const oldValue = target.readValue(params);
    if (oldValue === newValue) { skipped++; continue; }
    const extra = target.extraUpdates?.(params, newValue) ?? {};
    batch.update(doc.ref, { [target.field]: newValue, ...extra, updatedBy, updatedAt });
    entries.push({ docId: doc.id, field: target.field, oldValue, newValue });
  }
  return { entityType: target.entityType, entries, skipped };
}

function summarise(perTarget: readonly TargetResult[]): CascadeResult {
  const count = (type: AuditEntityType) =>
    perTarget.find((t) => t.entityType === type)?.entries.length ?? 0;
  return {
    wallsUpdated: count('wall'),
    columnsUpdated: count('column'),
    slabsUpdated: count('slab'),
    beamsUpdated: count('beam'),
    skipped: perTarget.reduce((n, t) => n + t.skipped, 0),
  };
}

async function recordCascadeAudit(
  perTarget: readonly TargetResult[],
  companyId: string,
  performedBy: string,
): Promise<void> {
  const tasks = perTarget.flatMap((target) =>
    target.entries.map((entry) => {
      const change: AuditFieldChange = {
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        label: entry.field,
      };
      return EntityAuditService.recordChange({
        entityType: target.entityType,
        entityId: entry.docId,
        entityName: entry.docId,
        action: 'updated',
        changes: [change],
        performedBy,
        performedByName: null,
        companyId,
      });
    }),
  );
  await Promise.all(tasks);
}
