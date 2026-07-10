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

import { stripUndefinedDeep } from '@/utils/firestore-sanitize';
import type { BOQItem } from '@/types/boq';
import { buildBoqBaseRow } from './boq-base-row';
import { syncManagedBoqRow } from './boq-firestore-sync';

import type { AnySceneEntity } from '../../types/entities';
import {
  isWallEntity,
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isOpeningEntity,
} from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import type { StoreyRef } from '../utils/bim-floor-utils';
import type { EnvelopeZoneId, ThermalEnvelopeSpec } from '../types/thermal-envelope-types';
import { computeEnvelopeShell, collectEnvelopeOverrides } from '../geometry/envelope-shell';
import type { SlabRegionFootprint } from '../geometry/footprint-region-classifier';
import type { EnvelopeChain } from '../geometry/envelope-perimeter';
import { resolveWallTopProfile } from '../geometry/wall-top-profile';
import { resolveWallBaseProfile } from '../geometry/wall-base-profile';
import { buildWallHostInputs, makeWallTopContext, makeWallBaseContext } from '../geometry/wall-host-plan-builder';
import {
  resolveEnvelopeEdgeTops,
  chainProfileAreaM2,
  type WallTopRef,
} from '../geometry/envelope-wall-top';
import {
  resolveEnvelopeEdgeBases,
  chainBaseAreaM2,
  type WallBaseRef,
} from '../geometry/envelope-wall-base';
import type { BeamEntity } from '../types/beam-types';
import type { SlabEntity } from '../types/slab-types';
import type { WallEntity } from '../types/wall-types';
import { filterExposedSlabs, type SlabForZoneClassification } from '../geometry/exposed-slab-classifier';
import { computeRevealContributionArea } from '../types/envelope-contribution';
import { resolveMaterialAtoeMapping, type MaterialAtoeMapping } from '../config/material-to-atoe-mapping';

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

/** `WallTopRef` ανά top-attached τοίχο (active-level scene → floorElevationMm 0). */
function boqTopRefs(
  walls: readonly WallEntity[],
  hostInputs: ReturnType<typeof buildWallHostInputs>,
): Map<string, WallTopRef> {
  const refs = new Map<string, WallTopRef>();
  for (const w of walls) {
    const start = { x: w.params.start.x, y: w.params.start.y };
    const end = { x: w.params.end.x, y: w.params.end.y };
    const profile = resolveWallTopProfile(w.params, makeWallTopContext(start, end, hostInputs, { floorElevationMm: 0 }));
    refs.set(w.id, { start, end, profile });
  }
  return refs;
}

/** `WallBaseRef` ανά base-attached τοίχο (ADR-401 (γ), floorElevationMm 0). */
function boqBaseRefs(
  walls: readonly WallEntity[],
  hostInputs: ReturnType<typeof buildWallHostInputs>,
): Map<string, WallBaseRef> {
  const refs = new Map<string, WallBaseRef>();
  for (const w of walls) {
    const start = { x: w.params.start.x, y: w.params.start.y };
    const end = { x: w.params.end.x, y: w.params.end.y };
    const profile = resolveWallBaseProfile(w.params, makeWallBaseContext(start, end, hostInputs, { floorElevationMm: 0 }));
    refs.set(w.id, { start, end, profile });
  }
  return refs;
}

/**
 * ADR-401 B3b / (γ) — Z1 facade area (m²). Όταν υπάρχει ≥1 top- ή base-`attached`
 * τοίχος, το κατακόρυφο εύρος είναι σκαλωτό/κεκλιμένο → integration ανά ακμή:
 * **area = topArea − baseArea** (`chainProfileAreaM2` − `chainBaseAreaM2`, μήκος ×
 * μέσο εύρος). Επειδή η βάση μπορεί να είναι αρνητική (θεμέλιο κάτω από το floor),
 * η αφαίρεση **μεγαλώνει** σωστά το κέλυφος. Χωρίς attach (flat) → `Σ perimeterM ×
 * maxWallHeightM` (ΑΜΕΤΑΒΛΗΤΟ). `floorElevationMm = 0`: active level scene =
 * floor-relative (mirror `wall-boq-feed`). Flat chain → identical και στα δύο paths.
 */
function computeZ1FacadeArea(
  chains: readonly EnvelopeChain[],
  walls: readonly WallEntity[],
  beams: readonly BeamEntity[],
  slabs: readonly SlabEntity[],
  units: SceneUnits,
): number {
  const fallbackHeightM = maxWallHeightM(walls);
  const topAttached = walls.filter((w) => w.params.topBinding === 'attached');
  const baseAttached = walls.filter((w) => w.params.baseBinding === 'attached');
  if (topAttached.length === 0 && baseAttached.length === 0) {
    return chains.reduce((s, c) => s + c.perimeterM, 0) * fallbackHeightM;
  }
  const sceneScale = mmToSceneUnits(units);
  const hostInputs = buildWallHostInputs(beams, slabs);
  const topRefs = boqTopRefs(topAttached, hostInputs);
  const baseRefs = boqBaseRefs(baseAttached, hostInputs);
  let area = 0;
  for (const c of chains) {
    const edgeTops = topRefs.size > 0 ? resolveEnvelopeEdgeTops(c, topRefs, 0) : [];
    area += chainProfileAreaM2(c, edgeTops, fallbackHeightM, sceneScale);
    if (baseRefs.size > 0) {
      area -= chainBaseAreaM2(c, resolveEnvelopeEdgeBases(c, baseRefs, 0), sceneScale);
    }
  }
  return area;
}

/**
 * Υπολογίζει την επιφάνεια μόνωσης (m²) ανά ζώνη από τα entities ενός ορόφου +
 * το spec. Pure (test-friendly). Ζώνες off → 0.
 */
export function computeEnvelopeZoneAreas(
  entities: readonly AnySceneEntity[],
  storeys: readonly StoreyRef[],
  spec: ThermalEnvelopeSpec,
  slabsAbove: readonly SlabRegionFootprint[] = [],
  sceneUnits?: SceneUnits,
): EnvelopeZoneAreas {
  const walls = entities.filter(isWallEntity);
  const columns = entities.filter(isColumnEntity);
  const beams = entities.filter(isBeamEntity);
  const slabs = entities.filter(isSlabEntity);
  const units = sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  // ADR-396 v2 (Φ5B): πηγή = footprint shell (κολώνες/δοκάρια συνεισφέρουν στην
  // περίμετρο → «τα δοκάρια μετράνε»). Όλα τα chains = μονωμένα (engine authoritative).
  // Φ5C: `slabsAbove` → ο classifier ξεχωρίζει αίθριο (μονώνεται γύρω) από δωμάτιο.
  const overrides = collectEnvelopeOverrides([...walls, ...columns, ...beams]);
  const { chains } = computeEnvelopeShell(walls, columns, beams, spec, overrides, slabsAbove, {
    sceneUnits: units,
  });
  const exteriorWallIds = new Set(chains.flatMap((c) => c.wallIds));

  // ADR-401 B3b — profile-aware όταν υπάρχουν attached τοίχοι (σκαλωτό κέλυφος).
  const z1 = spec.zones.Z1 ? computeZ1FacadeArea(chains, walls, beams, slabs, units) : 0;

  let z2 = 0;
  let z3 = 0;
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
  const base = buildBoqBaseRow(id, context, id, 'envelope', existingCreatedAt);
  const payload: BOQItem = {
    ...base,
    // Envelope zones are always floor-scoped (per-floor thermal aggregation).
    scope: 'floor',
    linkedFloorId: context.floorId,
    categoryCode: mapping.categoryCode,
    // `(${zone})` = ζώνη discriminator· ΟΧΙ νέο hardcoded Greek (zone codes).
    title: `${mapping.titleEL} (${zone})`,
    unit: mapping.unit,
    estimatedQuantity: area,
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
  await syncManagedBoqRow({
    id,
    quantity: area,
    buildPayload: (existingCreatedAt) =>
      buildEnvelopeZonePayload(id, zone, area, spec, context, mapping, existingCreatedAt),
    logLabel: 'EnvelopeBoqSync',
    logContext: { zone },
  });
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
  slabsAbove: readonly SlabRegionFootprint[] = [],
): Promise<void> {
  if (!context.companyId || !context.projectId || !context.buildingId || !context.floorId) return;
  const mapping = resolveMaterialAtoeMapping(spec.materialId);
  if (!mapping) return;
  const areas = computeEnvelopeZoneAreas(entities, storeys, spec, slabsAbove);
  await Promise.all(ZONES.map((zone) => syncZoneRow(zone, areas[zone], spec, context, mapping)));
}
