'use client';

/**
 * ADR-396 Phase P7 Part B — Thermal envelope (ETICS) → BOQ sync (Firestore I/O).
 *
 * Η θερμοπρόσοψη ΔΕΝ είναι single-entity row: παράγει **μία γραμμή ανά ζώνη +
 * όροφο** (D5), με deterministic id ώστε το detach guard + orphan cleanup να
 * δουλεύουν per row (mirror `stair-boq-sync` / `opening-boq-sync`):
 *   - `boq_env_<floorId>_Z1` — όψη (perimeter × ύψος ορόφου)
 *   - `boq_env_<floorId>_Z2` — πιλοτή soffit (Σ εκτεθειμένων πλακών)
 *   - `boq_env_<floorId>_Z3` — δώμα top (Σ εκτεθειμένων πλακών)
 *   - `boq_env_<floorId>_Z4` — περβάζια κουφωμάτων (Σ reveal strips)
 * Όλες ΑΤΟΕ `OIK-10.05` (μονώσεις, m²) μέσω `resolveMaterialAtoeMapping`.
 *
 * **Ξεχωριστές γραμμές** από το per-element structural BOQ (κολώνα/πλάκα m³):
 * additive — το per-element persist (BimToBoqBridge) γράφει το σκυρόδεμα, αυτό
 * τη μόνωση. Z1 = συνεχές κέλυφος τοίχων (perimeter × ύψος)· ΟΧΙ άθροισμα
 * per-element column/beam facade (θα ήταν double-count με το perimeter skin —
 * οι εξωτ. κολώνες είναι κάτω από το συνεχές κέλυφος· οι per-element layers
 * υπάρχουν για audit/IFC/override, ADR-396 §3).
 *
 * Contract (mirror stair-boq-sync): deterministic IDs · `source/sourceType:
 * 'bim-auto'` · `sourceEntityType: 'envelope'` · detach guard · zero-area →
 * delete (orphan cleanup όταν ζώνη off) · createdAt preserved · fire-and-forget.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P7 Part B), D5
 * @see ./stair-boq-sync (mirror multi-row deterministic pattern)
 */

import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { BOQItem } from '@/types/boq';

import type { AnySceneEntity } from '../../types/entities';
import { isWallEntity, isSlabEntity, isOpeningEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type { StoreyRef } from '../utils/bim-floor-utils';
import type { EnvelopeZoneId, ThermalEnvelopeSpec } from '../types/thermal-envelope-types';
import { computeEnvelopePerimeter } from '../geometry/envelope-perimeter';
import { filterExposedSlabs, type SlabForZoneClassification } from '../geometry/exposed-slab-classifier';
import { computeRevealContributionArea } from '../types/envelope-contribution';
import { resolveMaterialAtoeMapping, type MaterialAtoeMapping } from '../config/material-to-atoe-mapping';

const logger = createModuleLogger('EnvelopeBoqSync');
const MM_PER_M = 1000;
const ZONES: readonly EnvelopeZoneId[] = ['Z1', 'Z2', 'Z3', 'Z4'];

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface EnvelopeBoqContext {
  readonly companyId: string;
  readonly projectId: string;
  readonly buildingId: string;
  /** Required — μέρος του deterministic id + per-floor grouping (D5). */
  readonly floorId: string;
}

/** Επιφάνεια κελύφους (m²) ανά ζώνη — BOQ-ready aggregation. */
export interface EnvelopeZoneAreas {
  readonly Z1: number;
  readonly Z2: number;
  readonly Z3: number;
  readonly Z4: number;
}

// ============================================================================
// PURE AGGREGATION
// ============================================================================

/** Μέγιστο ύψος τοίχου (m) ως ύψος ορόφου για το Z1 facade area (mirror P5). */
function maxWallHeightM(walls: readonly { params: { height?: number } }[]): number {
  let max = 0;
  for (const w of walls) {
    const h = w.params.height ?? 0;
    if (h > max) max = h;
  }
  return max / MM_PER_M;
}

/**
 * Υπολογίζει την επιφάνεια μόνωσης (m²) ανά ζώνη από τα entities ενός ορόφου +
 * το spec. Pure (test-friendly). Ζώνες off → 0.
 */
export function computeEnvelopeZoneAreas(
  entities: readonly AnySceneEntity[],
  storeys: readonly StoreyRef[],
  spec: ThermalEnvelopeSpec,
  sceneUnits?: SceneUnits,
): EnvelopeZoneAreas {
  const walls = entities.filter(isWallEntity);
  const units = sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  const { chains } = computeEnvelopePerimeter(walls, spec.thickness_m, units);
  const closed = chains.filter((c) => c.closed);
  const active = closed.length > 0 ? closed : chains;
  const exteriorWallIds = new Set(active.flatMap((c) => c.wallIds));

  const z1 = spec.zones.Z1
    ? active.reduce((s, c) => s + c.perimeterM, 0) * maxWallHeightM(walls)
    : 0;

  let z2 = 0;
  let z3 = 0;
  const slabs = entities.filter(isSlabEntity);
  for (const { slab, zone } of filterExposedSlabs(
    slabs as unknown as SlabForZoneClassification[],
    storeys,
  )) {
    if (!spec.zones[zone]) continue;
    const area = (slab as unknown as { geometry?: { netArea?: number; area?: number } }).geometry;
    const a = area?.netArea ?? area?.area ?? 0;
    if (zone === 'Z2') z2 += a;
    else z3 += a;
  }

  let z4 = 0;
  if (spec.zones.Z4) {
    const thicknessById = new Map(walls.map((w) => [w.id, (w.params.thickness ?? 0) / MM_PER_M]));
    for (const op of entities.filter(isOpeningEntity)) {
      if (!exteriorWallIds.has(op.params.wallId)) continue;
      const t = thicknessById.get(op.params.wallId) ?? 0;
      z4 += computeRevealContributionArea(
        op.params.width / MM_PER_M,
        op.params.height / MM_PER_M,
        t,
      );
    }
  }

  return { Z1: z1, Z2: z2, Z3: z3, Z4: z4 };
}

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

/** Deterministic BOQ row id για μία ζώνη κελύφους ενός ορόφου. */
export function envelopeZoneBoqId(floorId: string, zone: EnvelopeZoneId): string {
  return `boq_env_${floorId}_${zone}`;
}

function buildEnvelopeZonePayload(
  id: string,
  zone: EnvelopeZoneId,
  area: number,
  spec: ThermalEnvelopeSpec,
  context: EnvelopeBoqContext,
  mapping: MaterialAtoeMapping,
  existingCreatedAt: string | null,
): Record<string, unknown> {
  const now = nowISO();
  const payload: BOQItem = {
    id,
    companyId: context.companyId,
    projectId: context.projectId,
    buildingId: context.buildingId,
    scope: 'floor',
    linkedFloorId: context.floorId,
    linkedUnitId: null,
    linkedUnitIds: null,
    costAllocationMethod: 'by_area',
    customAllocations: null,
    categoryCode: mapping.categoryCode,
    subCategoryCode: null,
    // `(${zone})` = ζώνη discriminator· ΟΧΙ νέο hardcoded Greek (zone codes).
    title: `${mapping.titleEL} (${zone})`,
    description: null,
    unit: mapping.unit,
    estimatedQuantity: area,
    actualQuantity: null,
    wasteFactor: 0,
    wastePolicy: 'inherited',
    materialUnitCost: 0,
    laborUnitCost: 0,
    equipmentUnitCost: 0,
    priceAuthority: 'master',
    linkedPhaseId: null,
    linkedTaskId: null,
    linkedInvoiceId: null,
    linkedContractorId: null,
    source: 'bim-auto',
    measurementMethod: 'bim',
    status: 'draft',
    qaStatus: 'pending',
    notes: null,
    createdBy: null,
    approvedBy: null,
    createdAt: existingCreatedAt ?? now,
    updatedAt: now,
    sourceType: 'bim-auto',
    sourceEntityId: id,
    sourceEntityType: 'envelope',
    detached: null,
    parentBoqItemId: null,
    isGroupParent: null,
    layerIndex: null,
    materialId: spec.materialId,
  };
  return stripUndefinedDeep(payload as unknown as Record<string, unknown>);
}

/** Upsert/delete μίας ζώνης: detach guard · zero-area → orphan cleanup. */
async function syncZoneRow(
  zone: EnvelopeZoneId,
  area: number,
  spec: ThermalEnvelopeSpec,
  context: EnvelopeBoqContext,
  mapping: MaterialAtoeMapping,
): Promise<void> {
  const id = envelopeZoneBoqId(context.floorId, zone);
  const ref = doc(db, COLLECTIONS.BOQ_ITEMS, id);

  const snap = await getDoc(ref).catch(() => null);
  if (snap === null) return;
  if (snap.exists() && (snap.data() as Record<string, unknown>).detached === true) return;

  if (area <= 0) {
    if (snap.exists()) {
      try {
        await deleteDoc(ref);
      } catch (err) {
        logger.error('EnvelopeBoqSync: zero-area delete failed', { rowId: id, err });
      }
    }
    return;
  }

  const existingCreatedAt = snap.exists()
    ? ((snap.data() as Record<string, unknown>).createdAt as string | undefined) ?? null
    : null;
  const payload = buildEnvelopeZonePayload(id, zone, area, spec, context, mapping, existingCreatedAt);

  try {
    await setDoc(ref, payload);
  } catch (err) {
    logger.error('EnvelopeBoqSync: zone upsert failed', { rowId: id, zone, err });
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Συγχρονίζει τις 4 BOQ γραμμές κελύφους ενός ορόφου μετά από «Εφαρμογή
 * Θερμοπρόσοψης». Idempotent. Fire-and-forget (callers MUST `void`).
 */
export async function syncEnvelopeBoq(
  entities: readonly AnySceneEntity[],
  storeys: readonly StoreyRef[],
  spec: ThermalEnvelopeSpec,
  context: EnvelopeBoqContext,
): Promise<void> {
  if (!context.companyId || !context.projectId || !context.buildingId || !context.floorId) return;
  const mapping = resolveMaterialAtoeMapping(spec.materialId);
  if (!mapping) return;
  const areas = computeEnvelopeZoneAreas(entities, storeys, spec);
  await Promise.all(ZONES.map((zone) => syncZoneRow(zone, areas[zone], spec, context, mapping)));
}
