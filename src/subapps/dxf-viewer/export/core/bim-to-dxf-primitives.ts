/**
 * ============================================================================
 * BIM → DXF PRIMITIVES — composite decomposition (SSoT)
 * ============================================================================
 *
 * Converts BIM composite entities (wall/column/slab/beam) into native-DXF
 * primitive entities (`lwpolyline`) so the ezdxf microservice can serialize
 * them (the service maps BIM types → null, see ENTITY_TYPE_MAPPING).
 *
 * The geometry is read from each entity's cached `geometry` field — the SAME
 * derived geometry the 2D renderer draws (`BimEntity.geometry`, source of truth
 * = params). The export therefore matches exactly what the user sees on screen
 * (Revit-style "export what you draw"). NO geometry is re-derived here.
 *
 * Unknown / not-yet-supported BIM types are skipped with a warning rather than
 * throwing — the rest of the drawing still exports.
 *
 * ADR-505 §A.
 */

import type { Entity, LWPolylineEntity } from '../../types/entities';
import { isBimEntity } from '../../types/entities';
import type { Point3D } from '../../bim/types/bim-base';
import type { Point2D } from '../../rendering/types/Types';
import type { DxfFlattenResult } from '../types';
import { resolveDxfBodyLayer } from './dxf-category-layers';

/**
 * Flatten a scope-filtered entity list into entities the DXF writer accepts:
 *   - native-DXF entities pass through untouched,
 *   - BIM entities are decomposed to `lwpolyline` primitives,
 *   - undecomposable BIM types are dropped and reported in `warnings`.
 */
export function flattenSceneEntitiesForDxf(
  entities: readonly Entity[],
): DxfFlattenResult {
  const out: Entity[] = [];
  const warnings: string[] = [];

  for (const entity of entities) {
    if (!isBimEntity(entity)) {
      out.push(entity);
      continue;
    }
    const primitives = decomposeBimEntityToDxfPrimitives(entity);
    if (primitives.length === 0) {
      warnings.push(
        `Δεν υποστηρίζεται ακόμη εξαγωγή DXF για τύπο "${entity.type}" (id: ${entity.id}) — παραλείφθηκε.`,
      );
      continue;
    }
    out.push(...primitives);
  }

  return { entities: out, warnings };
}

/**
 * Decompose a single BIM entity into native-DXF primitives. Returns `[]` for
 * BIM types that have no DXF representation yet (caller decides to warn/skip).
 */
export function decomposeBimEntityToDxfPrimitives(entity: Entity): Entity[] {
  // Wall is special — its plan footprint is the outer face + reversed inner
  // face joined into one closed loop (a hollow band, not a single polygon).
  if (entity.type === 'wall') {
    const outer = entity.geometry.outerEdge.points;
    const inner = entity.geometry.innerEdge.points;
    const loop = [...outer, ...[...inner].reverse()];
    return [makeClosedLwpolyline(entity, loop, 'wall', extractHeightMm(entity))];
  }

  // Every other BIM type (column/slab/beam/foundation/opening/roof/furniture/
  // floorplan-symbol + ALL MEP fixtures/segments/fittings/manifolds/panels) caches
  // a plan polygon under `footprint` / `outline` / `polygon`. One generic extractor
  // covers them all — and any future BIM type that follows the same convention.
  const ring = extractFootprintVertices(readGeometry(entity));
  return ring ? [makeClosedLwpolyline(entity, ring, entity.type, extractHeightMm(entity))] : [];
}

/** Candidate height fields on a BIM `params` object, in priority order (all mm). */
const HEIGHT_KEYS = ['height', 'depth', 'thickness', 'thicknessMm', 'bodyHeightMm'] as const;

/**
 * Vertical extent (mm) of a BIM element, for pseudo-3D extrusion. Heights live
 * in `params` (SSoT stores dimensions in mm) — NOT in the 2D plan bbox.
 *   wall/column → params.height · slab/foundation → thickness · beam → depth ·
 *   MEP → bodyHeightMm. column also caches geometry.height. Returns 0 (→ flat 2D)
 *   when nothing matches.
 */
export function extractHeightMm(entity: Entity): number {
  const geomHeight = (readGeometry(entity) as { height?: number } | undefined)?.height;
  if (typeof geomHeight === 'number' && geomHeight > 0) return geomHeight;

  const params = (entity as { params?: Record<string, unknown> }).params;
  if (params) {
    for (const key of HEIGHT_KEYS) {
      const v = params[key];
      if (typeof v === 'number' && v > 0) return v;
    }
  }
  return 0;
}

// ─── Geometry extraction (generic, convention-based) ──────────────────────────

/** Read an entity's cached `geometry` without per-type narrowing. */
function readGeometry(entity: Entity): unknown {
  return (entity as { geometry?: unknown }).geometry;
}

/**
 * Pull the plan polygon ring from a BIM geometry object, trying the three field
 * names the codebase uses (`footprint`, `outline`, `polygon`). Returns null when
 * none is present (e.g. path-based railings, stair stringers — future work).
 */
function extractFootprintVertices(geometry: unknown): readonly Point3D[] | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as Record<string, unknown>;
  return (
    polygonVertices(g.footprint) ??
    polygonVertices(g.outline) ??
    polygonVertices(g.polygon) ??
    null
  );
}

/**
 * Public reuse (ADR-505 §C fill) — το plan footprint ring ενός BIM entity
 * (`footprint`/`outline`/`polygon`), ΙΔΙΟ με αυτό που γίνεται outline. `null` όταν
 * δεν υπάρχει (π.χ. path-based). Ο overlay collector το καταναλώνει για το γέμισμα.
 */
export function extractEntityFootprintRing(entity: Entity): readonly Point3D[] | null {
  return extractFootprintVertices(readGeometry(entity));
}

/** Extract `.vertices` (≥2 points) from a `Polygon3D`-shaped value. */
function polygonVertices(value: unknown): readonly Point3D[] | null {
  if (!value || typeof value !== 'object' || !('vertices' in value)) return null;
  const verts = (value as { vertices: unknown }).vertices;
  if (Array.isArray(verts) && verts.length >= 2) return verts as readonly Point3D[];
  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** lwpolyline carrying an optional extrusion height in MM (DXF group 39). */
export interface ExtrudedLwpolyline extends LWPolylineEntity {
  /** Vertical extent in millimetres; the writer scales it to the output unit. */
  readonly dxfThicknessMm?: number;
}

/** Build a closed `lwpolyline` primitive from a 3D point ring. Layer = per-category
 *  (ADR-505 §C, `resolveDxfBodyLayer`) so each category lands on its own DXF layer;
 *  colour inherited from the source. When `thicknessMm > 0`, the primitive carries
 *  it so the writer can extrude the polyline into pseudo-3D (AutoCAD polyline mode). */
function makeClosedLwpolyline(
  source: Entity,
  ring: readonly Point3D[],
  suffix: string,
  thicknessMm = 0,
): ExtrudedLwpolyline {
  return {
    id: `${source.id}__dxf_${suffix}`,
    type: 'lwpolyline',
    // ADR-505 §C — re-layer κάθε BIM body σε per-category layer (COLUMNS/WALLS/…).
    // Άγνωστη κατηγορία → κράτα το αρχικό DXF layer (zero-break).
    layerId: resolveDxfBodyLayer(source.type) ?? source.layerId,
    color: source.color,
    visible: source.visible ?? true,
    vertices: ring.map(to2D),
    closed: true,
    dxfThicknessMm: thicknessMm > 0 ? thicknessMm : undefined,
  };
}

function to2D(p: Point3D): Point2D {
  return { x: p.x, y: p.y };
}
