/**
 * ADR-396 Phase P7 Part B — Per-element envelope applicator (PURE SSoT).
 *
 * Παίρνει ένα `ThermalEnvelopeSpec` ορόφου + τα entities του ορόφου και
 * αποφασίζει ποιο δομικό στοιχείο παίρνει στρώση μόνωσης (per-element = source
 * of truth, Revit pattern — ADR-396 OQ-A/OQ-B):
 *   - **Z1** κολώνες/δοκάρια: εξωτερικά αν η αντιπροσωπευτική θέση τους απέχει
 *     ≤ `EXTERIOR_PROXIMITY_M` (configurable) από τη γραμμή εξωτ. όψης τοίχων.
 *   - **Z2/Z3** πλάκες: μέσω `classifyExposedSlab` (πιλοτή soffit / δώμα top).
 *   - **Z4** ανοίγματα: σε εξωτερικό host wall → reveal μόνωση περβαζιών.
 * Κάθε ζώνη gated από `spec.zones[Zx]`. Στοιχείο που δεν qualify-άρει πλέον (ή
 * ζώνη off) → **καθαρίζεται** η στρώση του (idempotent — επαναληπτικό apply
 * συγκλίνει). ΚΑΜΙΑ Firestore/scene/render — pure (test-friendly, no globals).
 *
 * ΜΟΝΑΔΕΣ: τα vertex coords (footprint/axis/face loop) είναι σε canvas units —
 * ΙΔΙΟΣ χώρος με `WallGeometry.outerEdge` (το `computeEnvelopePerimeter` τα
 * παράγει εκεί), άρα η σύγκριση απόστασης γίνεται winding/scale-consistent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §7 (P7 Part B)
 * @see ./envelope-boq-sync (καταναλώνει το ίδιο classification για BOQ rows)
 */

import { dequal } from 'dequal';

import type { AnySceneEntity } from '../../types/entities';
import {
  isWallEntity,
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isOpeningEntity,
} from '../../types/entities';
import type { ColumnEntity } from '../types/column-types';
import type { BeamEntity } from '../types/beam-types';
import type { Point3D } from '../types/bim-base';
import type {
  EnvelopeLayer,
  EnvelopeZoneId,
  ThermalEnvelopeSpec,
} from '../types/thermal-envelope-types';
import { EXTERIOR_PROXIMITY_M } from '../types/thermal-envelope-types';
import type { StoreyRef } from '../utils/bim-floor-utils';
import type { SceneUnits } from '../../utils/scene-units';
import { mmToSceneUnits } from '../../utils/scene-units';
import { computeEnvelopePerimeter, type WallForEnvelope } from '../geometry/envelope-perimeter';
import { filterExposedSlabs, type SlabForZoneClassification } from '../geometry/exposed-slab-classifier';
import { polygonCentroid } from '../geometry/shared/polygon-utils';
import { pointToSegmentDistance } from '../../systems/guides';

const MM_PER_M = 1000;

// ============================================================================
// PUBLIC TYPES
// ============================================================================

/**
 * Επιθυμητή κατάσταση μόνωσης ενός στοιχείου. `layer`/`reveal` === undefined =
 * «να μην έχει στρώση» (clear). Το πεδίο εξαρτάται από το `entityType`:
 * columns/beams/slabs → `layer` (envelopeLayer)· openings → `reveal`
 * (revealInsulation, πάντα zone Z4).
 */
export interface ElementEnvelopeAssignment {
  readonly entityId: string;
  readonly entityType: 'column' | 'beam' | 'slab' | 'opening';
  readonly layer?: EnvelopeLayer;
  readonly reveal?: EnvelopeLayer;
}

// ============================================================================
// GEOMETRY HELPERS (pure, canvas-unit space)
// ============================================================================

/** Αντιπροσωπευτικό κέντρο στοιχείου σε canvas units (κολώνα footprint / δοκάρι άξονας). */
function representativeCenter(entity: ColumnEntity | BeamEntity): Point3D | null {
  const pts = isColumnEntity(entity)
    ? entity.geometry?.footprint?.vertices
    : entity.geometry?.axisPolyline?.points;
  if (!pts || pts.length === 0) return null;
  return polygonCentroid(pts);
}

/** Ελάχιστη απόσταση σημείου από όλες τις ακμές των loops (canvas units). */
function minDistanceToLoops(point: Point3D, loops: readonly (readonly Point3D[])[]): number {
  let min = Infinity;
  for (const loop of loops) {
    const n = loop.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const d = pointToSegmentDistance(point, loop[i], loop[(i + 1) % n]);
      if (d < min) min = d;
    }
  }
  return min;
}

/** True όταν κολώνα/δοκάρι είναι εξωτερικό (κέντρο ≤ proximity από εξωτ. όψη). */
function isExteriorElement(
  entity: ColumnEntity | BeamEntity,
  loops: readonly (readonly Point3D[])[],
  proximityCanvas: number,
): boolean {
  if (loops.length === 0) return false;
  const center = representativeCenter(entity);
  if (!center) return false;
  return minDistanceToLoops(center, loops) <= proximityCanvas;
}

// ============================================================================
// PERIMETER CONTEXT (exterior face loops + exterior wall ids)
// ============================================================================

interface PerimeterContext {
  readonly loops: readonly (readonly Point3D[])[];
  readonly exteriorWallIds: ReadonlySet<string>;
  readonly proximityCanvas: number;
}

/** Χτίζει το exterior-face context μία φορά (κλειστές αλυσίδες· fallback σε όλες). */
function buildPerimeterContext(
  walls: readonly WallForEnvelope[],
  thickness_m: number,
  units: SceneUnits,
): PerimeterContext {
  const { chains } = computeEnvelopePerimeter(walls, thickness_m, units);
  const closed = chains.filter((c) => c.closed);
  const active = closed.length > 0 ? closed : chains;
  return {
    loops: active.map((c) => c.exteriorFaceLoop.points),
    exteriorWallIds: new Set(active.flatMap((c) => c.wallIds)),
    proximityCanvas: EXTERIOR_PROXIMITY_M * MM_PER_M * mmToSceneUnits(units),
  };
}

// ============================================================================
// ASSIGNMENT COMPUTATION
// ============================================================================

function facadeLayer(spec: ThermalEnvelopeSpec, zone: EnvelopeZoneId): EnvelopeLayer {
  return { materialId: spec.materialId, thickness_m: spec.thickness_m, zone };
}

/**
 * Υπολογίζει την επιθυμητή κατάσταση μόνωσης ΟΛΩΝ των candidate στοιχείων του
 * ορόφου (όχι μόνο όσων αλλάζουν — το dequal-filtering γίνεται στο
 * `applyAssignmentsToEntities`). Pure.
 */
export function computeEnvelopeAssignments(
  spec: ThermalEnvelopeSpec,
  entities: readonly AnySceneEntity[],
  storeys: readonly StoreyRef[],
  sceneUnits?: SceneUnits,
): ElementEnvelopeAssignment[] {
  const walls = entities.filter(isWallEntity);
  const units = sceneUnits ?? walls[0]?.params.sceneUnits ?? 'mm';
  const needPerimeter = spec.zones.Z1 || spec.zones.Z4;
  const ctx = needPerimeter
    ? buildPerimeterContext(walls, spec.thickness_m, units)
    : { loops: [], exteriorWallIds: new Set<string>(), proximityCanvas: 0 };

  const out: ElementEnvelopeAssignment[] = [];

  for (const e of entities) {
    if (isColumnEntity(e) || isBeamEntity(e)) {
      const want = spec.zones.Z1 && isExteriorElement(e, ctx.loops, ctx.proximityCanvas);
      out.push({
        entityId: e.id,
        entityType: e.type,
        layer: want ? facadeLayer(spec, 'Z1') : undefined,
      });
    }
  }

  const slabs = entities.filter(isSlabEntity);
  const exposed = new Map(
    filterExposedSlabs(slabs as unknown as SlabForZoneClassification[], storeys).map(
      (r) => [(r.slab as unknown as { id: string }).id, r.zone] as const,
    ),
  );
  for (const slab of slabs) {
    const zone = exposed.get(slab.id);
    const want = zone !== undefined && spec.zones[zone];
    out.push({
      entityId: slab.id,
      entityType: 'slab',
      layer: want && zone ? facadeLayer(spec, zone) : undefined,
    });
  }

  for (const op of entities.filter(isOpeningEntity)) {
    const want = spec.zones.Z4 && ctx.exteriorWallIds.has(op.params.wallId);
    out.push({
      entityId: op.id,
      entityType: 'opening',
      reveal: want
        ? { materialId: spec.materialId, thickness_m: spec.revealThickness_m, zone: 'Z4' }
        : undefined,
    });
  }

  return out;
}

// ============================================================================
// APPLY (dequal-filtered patch)
// ============================================================================

/** Patch ενός optional param field· επιστρέφει το ίδιο entity αν δεν αλλάζει (dequal). */
function patchEntityField<T extends AnySceneEntity>(
  entity: T,
  field: 'envelopeLayer' | 'revealInsulation',
  value: EnvelopeLayer | undefined,
): T {
  const params = entity.params as Readonly<Record<string, unknown>>;
  if (dequal(params[field], value)) return entity;
  const nextParams: Record<string, unknown> = { ...params };
  if (value === undefined) delete nextParams[field];
  else nextParams[field] = value;
  return { ...entity, params: nextParams } as T;
}

/**
 * Εφαρμόζει τα assignments στα scene entities. Επιστρέφει το νέο entity array +
 * ΜΟΝΟ όσα entities πραγματικά άλλαξαν (`changed`) ώστε ο caller να persist-άρει
 * + audit-άρει + emit-άρει αποκλειστικά αυτά (zero περιττές εγγραφές). Pure.
 */
export function applyAssignmentsToEntities(
  entities: readonly AnySceneEntity[],
  assignments: readonly ElementEnvelopeAssignment[],
): { entities: AnySceneEntity[]; changed: AnySceneEntity[] } {
  const byId = new Map(assignments.map((a) => [a.entityId, a] as const));
  const changed: AnySceneEntity[] = [];
  const next = entities.map((e) => {
    const a = byId.get(e.id);
    if (!a) return e;
    const updated =
      a.entityType === 'opening'
        ? patchEntityField(e, 'revealInsulation', a.reveal)
        : patchEntityField(e, 'envelopeLayer', a.layer);
    if (updated !== e) changed.push(updated);
    return updated;
  });
  return { entities: next, changed };
}
