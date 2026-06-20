/**
 * ============================================================================
 * OVERLAY → DXF PRIMITIVES — finish skin + reinforcement collector (SSoT)
 * ============================================================================
 *
 * Σοβάδες (finish) + οπλισμός (reinforcement) ΔΕΝ είναι `scene.entities` — είναι
 * derived overlays που υπολογίζονται/ζωγραφίζονται live (όπως τα διαγράμματα M/V/N).
 * Ο ADR-505 export pipeline διαβάζει `scene.entities`, άρα δεν τα πιάνει. Αυτός ο
 * collector γεφυρώνει το κενό: από τα δομικά entities παράγει **extra DXF primitives**
 * (lwpolyline/line/circle) καταναλώνοντας την ΙΔΙΑ plan-geometry SSoT με τους 2Δ
 * renderers (μηδέν διπλή γεωμετρία — «export what you draw», Revit-style).
 *
 * Gating = «export what's visible»: ο σοβάς/οπλισμός μπαίνει ΜΟΝΟ όταν το αντίστοιχο
 * `isStructuralComponentVisible('plaster'|'reinforcement', entity)` flag είναι ON
 * (per-element override → per-view). Layers (Revit subcategories): `ΣΟΒΑΣ` / `ΟΠΛΙΣΜΟΣ`.
 *
 *   - finish → `computeStructuralFinishSilhouette` → `collectFinishOutlinePlanPolylines`
 *     → extruded lwpolyline (group-39 ύψος = ζώνη σοβά), χρώμα = flat υλικό.
 *   - rebar  → `collect{Column,Beam,Footing,Slab}RebarPlanGeometry` → lwpolyline (paths)
 *     + circle (διαμήκεις κουκκίδες κολώνας), χρώμα crimson.
 *
 * Pure: η `isStructuralComponentVisible` εγχέεται (default = το SSoT predicate) ώστε ο
 * collector να είναι 100% testable χωρίς store.
 *
 * ADR-505 §C (finish/rebar phase).
 */

import type { Entity, LWPolylineEntity, CircleEntity } from '../../types/entities';
import {
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isFoundationEntity,
  isWallEntity,
} from '../../types/entities';
import type { SceneLayer } from '../../types/scene-types';
import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import {
  isStructuralComponentVisible,
  type ComponentVisibilityEntity,
} from '../../bim/visibility/structural-component-visibility';
import type { StructuralComponent } from '../../config/bim-structural-components';
import { computeStructuralFinishSilhouette } from '../../bim/finishes/structural-finish-scene';
import { isFinishActive } from '../../bim/finishes/structural-finish-types';
import { collectFinishOutlinePlanPolylines } from '../../bim/finishes/structural-finish-plan-geometry';
import { collectColumnRebarPlanGeometry } from '../../bim/structural/reinforcement/column-rebar-plan-geometry';
import { collectBeamRebarPlanGeometry } from '../../bim/structural/reinforcement/linear-member-rebar-plan-geometry';
import { collectFootingRebarPlanGeometry } from '../../bim/structural/reinforcement/footing-rebar-plan-geometry';
import { collectSlabRebarPlanGeometry } from '../../bim/structural/reinforcement/slab-rebar-plan-geometry';
import type { RebarPlanGeometry } from '../../bim/structural/reinforcement/rebar-plan-geometry-types';
import { REBAR_COLOR_HEX } from '../../bim/structural/rebar-catalog';
import type { ExtrudedLwpolyline } from './bim-to-dxf-primitives';

/** DXF layer name (Revit subcategory) — σοβάδες. */
export const FINISH_LAYER_ID = 'ΣΟΒΑΣ';
/** DXF layer name (Revit subcategory) — οπλισμός. */
export const REBAR_LAYER_ID = 'ΟΠΛΙΣΜΟΣ';

/** Neutral χρώμα layer σοβά (οι entities φέρουν δικό τους flat-υλικό χρώμα). */
const FINISH_LAYER_COLOR = '#9e9e9e';

/** Predicate ορατότητας component (εγχέσιμο → testable χωρίς store). */
export type ComponentVisibilityPredicate = (
  component: StructuralComponent,
  entity: ComponentVisibilityEntity | null | undefined,
) => boolean;

export interface OverlayCollectorOptions {
  /** Default = `isStructuralComponentVisible` (per-element override → per-view flag). */
  readonly componentVisible?: ComponentVisibilityPredicate;
}

export interface OverlayCollectResult {
  /** Extra DXF primitives (finish + rebar) έτοιμα για append στο export request. */
  readonly entities: Entity[];
  /** Layer defs που χρησιμοποιήθηκαν (ΣΟΒΑΣ/ΟΠΛΙΣΜΟΣ) — keyed by layerId. */
  readonly layers: Record<string, SceneLayer>;
}

function makeLayer(id: string, color: string): SceneLayer {
  return { id, name: id, color, visible: true, locked: false };
}

/**
 * Συλλέγει finish + reinforcement DXF primitives από μια λίστα entities. Τα entities
 * πρέπει να είναι ήδη scope-filtered (ο caller περνά `resolveExportEntities(...)`).
 */
export function collectOverlayDxfEntities(
  entities: readonly Entity[],
  options: OverlayCollectorOptions = {},
): OverlayCollectResult {
  const componentVisible = options.componentVisible ?? isStructuralComponentVisible;
  const out: Entity[] = [];
  const layers: Record<string, SceneLayer> = {};

  // ── Σοβάς (ενιαία silhouette, ίδια SSoT με 2Δ/3Δ) ──
  collectFinishEntities(entities, componentVisible, out, layers);

  // ── Οπλισμός (per-element, ίδια plan-geometry SSoT με τους 2Δ renderers) ──
  collectReinforcementEntities(entities, componentVisible, out, layers);

  return { entities: out, layers };
}

/** Σοβάς → extruded lwpolylines (μία πηγή με 2Δ/3Δ silhouette). */
function collectFinishEntities(
  entities: readonly Entity[],
  componentVisible: ComponentVisibilityPredicate,
  out: Entity[],
  layers: Record<string, SceneLayer>,
): void {
  // isFinishActive guard ΠΡΩΤΑ → μόνο finish-active μέλη τροφοδοτούν τη silhouette
  // (+ ασφάλεια έναντι malformed entities χωρίς params, ίδιο spirit με flattenSceneEntitiesForDxf).
  const columns = entities
    .filter(isColumnEntity)
    .filter((e) => isFinishActive(e.params?.finish) && componentVisible('plaster', e));
  const beams = entities
    .filter(isBeamEntity)
    .filter((e) => isFinishActive(e.params?.finish) && componentVisible('plaster', e));
  if (columns.length === 0 && beams.length === 0) return;
  const walls = entities.filter(isWallEntity); // obstacles — ανεξάρτητα από δικό τους finish

  // floorElevationMm=0 + legacy extents (params.height): plan-view export path (mirror
  // του unit-test path του silhouette· storey-ceiling band optimization = DEFER).
  const bands = computeStructuralFinishSilhouette(columns, beams, walls, 0, undefined, true);
  if (bands.length === 0) return;
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? 'mm';

  let n = 0;
  for (const band of bands) {
    const heightMm = Math.max(0, band.zTopMm - band.zBottomMm);
    for (const pl of collectFinishOutlinePlanPolylines(band.faces, sceneUnits, heightMm)) {
      if (pl.points.length < 2) continue;
      const poly: ExtrudedLwpolyline = {
        id: `__finish_${n++}`,
        type: 'lwpolyline',
        layerId: FINISH_LAYER_ID,
        color: pl.colorHex,
        visible: true,
        vertices: pl.points.map(toVertex),
        closed: false,
        dxfThicknessMm: pl.heightMm > 0 ? pl.heightMm : undefined,
      };
      out.push(poly);
    }
  }
  if (n > 0) layers[FINISH_LAYER_ID] = makeLayer(FINISH_LAYER_ID, FINISH_LAYER_COLOR);
}

/** Οπλισμός κάθε ορατού δομικού μέλους → lwpolylines + circles (crimson). */
function collectReinforcementEntities(
  entities: readonly Entity[],
  componentVisible: ComponentVisibilityPredicate,
  out: Entity[],
  layers: Record<string, SceneLayer>,
): void {
  let count = 0;
  for (const entity of entities) {
    if (!componentVisible('reinforcement', entity)) continue;
    let geo: RebarPlanGeometry | null = null;
    let sceneUnits: SceneUnits | undefined;
    if (isColumnEntity(entity)) {
      geo = collectColumnRebarPlanGeometry(entity.params, entity.id);
      sceneUnits = entity.params.sceneUnits;
    } else if (isBeamEntity(entity)) {
      geo = collectBeamRebarPlanGeometry(entity);
      sceneUnits = entity.params.sceneUnits;
    } else if (isFoundationEntity(entity)) {
      geo = collectFootingRebarPlanGeometry(entity.params);
      sceneUnits = entity.params.sceneUnits;
    } else if (isSlabEntity(entity)) {
      geo = collectSlabRebarPlanGeometry(entity);
      sceneUnits = entity.params.sceneUnits;
    }
    if (!geo) continue;
    count += emitRebarGeometry(geo, entity.id, sceneUnits, out);
  }
  if (count > 0) layers[REBAR_LAYER_ID] = makeLayer(REBAR_LAYER_ID, REBAR_COLOR_HEX);
}

/** Μετατρέπει μια `RebarPlanGeometry` σε DXF primitives. Επιστρέφει το πλήθος που μπήκε. */
function emitRebarGeometry(
  geo: RebarPlanGeometry,
  ownerId: string,
  sceneUnits: SceneUnits | undefined,
  out: Entity[],
): number {
  let n = 0;
  for (const path of geo.paths) {
    if (path.points.length < 2) continue;
    const poly: LWPolylineEntity = {
      id: `__rebar_${ownerId}_${n++}`,
      type: 'lwpolyline',
      layerId: REBAR_LAYER_ID,
      color: REBAR_COLOR_HEX,
      visible: true,
      vertices: path.points.map(toVertex),
      closed: path.closed,
    };
    out.push(poly);
  }
  const s = mmToSceneUnits(sceneUnits ?? 'mm');
  for (const dot of geo.dots) {
    const circle: CircleEntity = {
      id: `__rebar_${ownerId}_${n++}`,
      type: 'circle',
      layerId: REBAR_LAYER_ID,
      color: REBAR_COLOR_HEX,
      visible: true,
      center: { x: dot.center.x, y: dot.center.y },
      radius: Math.max(0, (dot.diameterMm / 2) * s), // mm → scene units (φυσική ακτίνα ράβδου)
    };
    out.push(circle);
  }
  return n;
}

function toVertex(p: Point2D): Point2D {
  return { x: p.x, y: p.y };
}
