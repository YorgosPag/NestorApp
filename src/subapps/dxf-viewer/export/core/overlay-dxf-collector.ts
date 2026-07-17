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
 *   - finish → `computeStructuralFinishSilhouette` → `mergeSilhouetteBandsToStrips` → `collectFinishStripPlanPolylines`
 *     → extruded lwpolyline (group-39 ύψος = ζώνη σοβά), χρώμα = flat υλικό.
 *   - rebar  → `collect{Column,Beam,Footing,Slab}RebarPlanGeometry` → lwpolyline (paths)
 *     + circle (διαμήκεις κουκκίδες κολώνας), χρώμα crimson.
 *
 * Pure: η `isStructuralComponentVisible` εγχέεται (default = το SSoT predicate) ώστε ο
 * collector να είναι 100% testable χωρίς store.
 *
 * ADR-505 §C (finish/rebar phase).
 */

import type { Entity, LWPolylineEntity, CircleEntity, LineEntity, HatchEntity } from '../../types/entities';
import {
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isFoundationEntity,
  isWallEntity,
  isOpeningEntity,
} from '../../types/entities';
import { isWallHostedOpening, type OpeningEntity } from '../../bim/types/opening-types';
import type { SceneLayer } from '../../types/scene-types';
import type { Point2D } from '../../rendering/types/Types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { projectVerticesTo2D } from '../../bim/geometry/shared/polygon-utils';
import {
  isStructuralComponentVisible,
  type ComponentVisibilityEntity,
} from '../../bim/visibility/structural-component-visibility';
import type { BimElementStyleOverride } from '../../config/bim-object-styles';
import type { StructuralComponent } from '../../config/bim-structural-components';
import { computeStructuralFinishSilhouette } from '../../bim/finishes/structural-finish-scene';
import { isFinishActive } from '../../bim/finishes/structural-finish-types';
import { collectFinishStripPlanPolylines } from '../../bim/finishes/structural-finish-plan-geometry';
import { mergeSilhouetteBandsToStrips } from '../../bim/finishes/structural-finish-vertical-merge';
import { collectColumnRebarPlanGeometry } from '../../bim/structural/reinforcement/column-rebar-plan-geometry';
import { collectBeamRebarPlanGeometry } from '../../bim/structural/reinforcement/linear-member-rebar-plan-geometry';
import { collectFootingRebarPlanGeometry } from '../../bim/structural/reinforcement/footing-rebar-plan-geometry';
import { collectSlabRebarPlanGeometry } from '../../bim/structural/reinforcement/slab-rebar-plan-geometry';
import {
  collectColumnRebarSegments3D,
  collectBeamRebarSegments3D,
} from '../../bim/structural/reinforcement/rebar-segments-3d-linear';
import {
  collectFootingRebarSegments3D,
  collectSlabRebarSegments3D,
} from '../../bim/structural/reinforcement/rebar-segments-3d-grid';
import type { RebarPlanGeometry, RebarSeg3D } from '../../bim/structural/reinforcement/rebar-plan-geometry-types';
import { REBAR_COLOR_HEX } from '../../bim/structural/rebar-catalog';
import type { ExtrudedLwpolyline } from './bim-to-dxf-primitives';
import { extractEntityFootprintRing, extractHeightMm } from './bim-to-dxf-primitives';
import { buildPrismFaces, type Fill3DFace } from './solid-fill-geometry';
import { resolveDxfFillLayer, CATEGORY_LAYER_DEFS } from './dxf-category-layers';
import type { DxfLineMode } from '../types';

// DXF layer names (Revit subcategories) — ASCII ΕΠΙΤΗΔΕΣ: ο writer βγάζει bare DXF
// χωρίς HEADER/$DWGCODEPAGE, οπότε ο AutoCAD υποθέτει ANSI και ΣΚΑΛΩΝΕΙ σε non-ASCII
// (UTF-8 ελληνικά) layer names — ο Τέκτονας τα διαβάζει χαλαρά, ο AutoCAD «κολλάει».
/** DXF layer name (Revit subcategory) — σοβάδες (περίγραμμα). */
export const FINISH_LAYER_ID = 'FINISH';
/** DXF layer name (Revit subcategory) — σοβάδες (συμπαγές γέμισμα 3DFACE, ADR-505 §C). */
export const FINISH_FILL_LAYER_ID = 'FINISH_FILL';
/** DXF layer name (Revit subcategory) — οπλισμός. */
export const REBAR_LAYER_ID = 'REBAR';

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
  /**
   * DXF geometry mode. `'polyline'` (AutoCAD, default) → **3Δ** οπλισμός (πραγματικός
   * κλωβός, LINE με Z). `'lines'` (Τέκτονας/FESPA, 2Δ parser) → **2Δ** κάτοψη οπλισμού.
   * Mirror του body extrusion (3Δ μόνο σε polyline mode).
   */
  readonly lineMode?: DxfLineMode;
}

/** LINE με προαιρετικό Z ανά άκρο (mm σχετικό με βάση) — 3Δ rebar segment για DXF. */
interface Rebar3DLine extends LineEntity {
  readonly dxfStartZMm?: number;
  readonly dxfEndZMm?: number;
}

/** HatchEntity carrier (patternType:'solid') + προ-υπολογισμένα 3D faces (ADR-505 §C). */
interface SolidFillHatch extends HatchEntity {
  readonly dxfFaces: readonly Fill3DFace[];
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
 * Το `ComponentVisibilityEntity` view ενός entity (μόνο το `styleOverride` — το μόνο
 * που χρειάζεται ο visibility resolver). Το πλήρες `Entity` union δεν είναι structurally
 * assignable· εξάγουμε το optional field με inline cast (idiomatic, μηδέν `any`).
 */
function visibilityOf(e: Entity): ComponentVisibilityEntity {
  return { styleOverride: (e as { styleOverride?: BimElementStyleOverride }).styleOverride };
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

  // ── Σοβάς (ενιαία silhouette, ίδια SSoT με 2Δ/3Δ): περίγραμμα + γέμισμα 3DFACE ──
  collectFinishEntities(entities, componentVisible, out, layers);

  // ── Συμπαγές γέμισμα δομικών σωμάτων (κολώνες/δοκάρια/πλάκες/πέδιλα), 3DFACE ──
  collectBodyFillEntities(entities, componentVisible, out, layers);

  // ── Οπλισμός: 3Δ κλωβός (AutoCAD/polyline) ή 2Δ κάτοψη (Τέκτονας/lines) ──
  const want3D = options.lineMode !== 'lines';
  collectReinforcementEntities(entities, componentVisible, want3D, out, layers);

  return { entities: out, layers };
}

/** Χτίζει SolidFillHatch carrier (footprint+ύψος → 3D faces). `null` αν degenerate. */
function makeFillHatch(
  id: string, layerId: string, color: string,
  ring: readonly Point2D[], baseZMm: number, heightMm: number,
): SolidFillHatch | null {
  const faces = buildPrismFaces(ring, baseZMm, heightMm);
  if (faces.length === 0) return null;
  return {
    id, type: 'hatch', layerId, color, fillColor: color, visible: true,
    patternType: 'solid', patternName: 'SOLID',
    boundaryPaths: [projectVerticesTo2D(ring)],
    dxfFaces: faces,
  };
}

/**
 * Συμπαγές γέμισμα (3DFACE) των δομικών σωμάτων που ζήτησε ο Giorgio: κολώνες,
 * δοκάρια, πλάκες, πέδιλα. Boundary = το ΙΔΙΟ footprint με το outline (reuse
 * `extractEntityFootprintRing`)· ύψος = `extractHeightMm` (ίδιο με το body extrusion,
 * base z=0). Gated από το structural 'core' (Revit: κρύψε core → σβήνει το γέμισμα).
 * Χρώμα = το resolved χρώμα του στοιχείου (ο caller περνά ήδη-χρωματισμένα entities).
 */
function collectBodyFillEntities(
  entities: readonly Entity[],
  componentVisible: ComponentVisibilityPredicate,
  out: Entity[],
  layers: Record<string, SceneLayer>,
): void {
  const used = new Set<string>();
  for (const entity of entities) {
    const fillLayer = resolveDxfFillLayer(entity.type);
    if (!fillLayer) continue;
    if (!componentVisible('core', visibilityOf(entity))) continue;
    const ring = extractEntityFootprintRing(entity);
    if (!ring) continue;
    const color = entity.color ?? CATEGORY_LAYER_DEFS[fillLayer]?.color ?? FINISH_LAYER_COLOR;
    const fill = makeFillHatch(
      `${entity.id}__fill`, fillLayer, color,
      projectVerticesTo2D(ring), 0, extractHeightMm(entity),
    );
    if (!fill) continue;
    out.push(fill);
    used.add(fillLayer);
  }
  for (const id of used) {
    const def = CATEGORY_LAYER_DEFS[id];
    layers[id] = def ?? makeLayer(id, FINISH_LAYER_COLOR);
  }
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
  // ADR-534 Φ6c — η κατακόρυφη περιμετρική «φάσα» πλάκας εξάγεται ΚΑΙ στο DXF (parity με 2Δ κάτοψη &
  // 3Δ scene). Tilted/legacy πλάκες → φιλτράρονται εσωτερικά (slabIsFinishMember). Ένας όροφος-δώμα
  // (μόνο πλάκα, χωρίς κολόνες/δοκάρια) → παράγει φάσα → κράτα slabs στο early-return guard.
  const slabs = entities
    .filter(isSlabEntity)
    .filter((e) => isFinishActive(e.params?.finish) && componentVisible('plaster', e));
  if (columns.length === 0 && beams.length === 0 && slabs.length === 0) return;
  const walls = entities.filter(isWallEntity); // obstacles — ανεξάρτητα από δικό τους finish

  // ADR-449 §opening-bands — ο εξαγόμενος σοβάς σέβεται τα κουφώματα, ΟΠΩΣ στην οθόνη (αλλιώς το DXF
  // θα διέφερε από το 2Δ viewport). Το `componentVisible` gating έχει ήδη γίνει στα μέλη· εδώ αρκεί ο
  // ADR-615 guard (self-hosted → κανένας host τοίχος να κόψει).
  const openingsByWallId = new Map<string, OpeningEntity[]>();
  for (const o of entities.filter(isOpeningEntity)) {
    if (!isWallHostedOpening(o)) continue;
    const arr = openingsByWallId.get(o.params.wallId);
    if (arr) arr.push(o);
    else openingsByWallId.set(o.params.wallId, [o]);
  }

  // floorElevationMm=0 + legacy extents (params.height): plan-view export path (mirror
  // του unit-test path του silhouette· storey-ceiling band optimization = DEFER).
  const bands = computeStructuralFinishSilhouette({
    columns, beams, walls, floorElevationMm: 0,
    dropPlanHiddenFaces: true,
    openingsByWallId,
    slabs,
  });
  if (bands.length === 0) return;
  const sceneUnits = columns[0]?.params.sceneUnits ?? beams[0]?.params.sceneUnits ?? slabs[0]?.params.sceneUnits ?? 'mm';

  // ADR-449 Slice X6 — κάθετος band-merge: μία extrusion ανά συνεχή όψη (τα z-γειτονικά ταυτόσημα
  // quads ενώνονται) → μηδέν στοιβαγμένες per-band extrusions/ραφή στο εξαγόμενο μοντέλο. ΙΔΙΟ SSoT
  // με το 3Δ viewport. (base z=0 = υπάρχον plan-view export convention· storey stacking = DEFER.)
  let n = 0;
  let fills = 0;
  for (const pl of collectFinishStripPlanPolylines(mergeSilhouetteBandsToStrips(bands, sceneUnits))) {
    if (pl.points.length < 2) continue;
    const poly: ExtrudedLwpolyline = {
      id: `__finish_${n++}`,
      type: 'lwpolyline',
      layerId: FINISH_LAYER_ID,
      color: pl.colorHex,
      visible: true,
      vertices: projectVerticesTo2D(pl.points),
      // closed quad (aCore→aOuter→bOuter→bCore→aCore) → καθαρό extruded prism, ΙΔΙΟ
      // verified μονοπάτι με το σώμα (AutoCAD-friendly· όχι open-poly-with-thickness).
      closed: true,
      dxfThicknessMm: pl.heightMm > 0 ? pl.heightMm : undefined,
    };
    out.push(poly);

    // ADR-505 §C — συμπαγές γέμισμα 3DFACE της ζώνης σοβά (base z=0, ίδιο με το
    // outline extrude· χρώμα = flat υλικό σοβά) σε ΞΕΧΩΡΙΣΤΟ layer FINISH_FILL.
    const fill = makeFillHatch(
      `__finish_fill_${fills}`, FINISH_FILL_LAYER_ID, pl.colorHex,
      pl.points, 0, pl.heightMm,
    );
    if (fill) { out.push(fill); fills++; }
  }
  if (n > 0) layers[FINISH_LAYER_ID] = makeLayer(FINISH_LAYER_ID, FINISH_LAYER_COLOR);
  if (fills > 0) layers[FINISH_FILL_LAYER_ID] = makeLayer(FINISH_FILL_LAYER_ID, FINISH_LAYER_COLOR);
}

/** Οπλισμός κάθε ορατού δομικού μέλους → DXF primitives (3Δ LINEs ή 2Δ lwpolylines/circles). */
function collectReinforcementEntities(
  entities: readonly Entity[],
  componentVisible: ComponentVisibilityPredicate,
  want3D: boolean,
  out: Entity[],
  layers: Record<string, SceneLayer>,
): void {
  let count = 0;
  for (const entity of entities) {
    if (!componentVisible('reinforcement', visibilityOf(entity))) continue;
    count += want3D
      ? emitRebarSegments3D(rebarSegments3DFor(entity), entity.id, out)
      : emitRebarGeometry(rebarPlanGeometryFor(entity), entity.id, planSceneUnits(entity), out);
  }
  if (count > 0) layers[REBAR_LAYER_ID] = makeLayer(REBAR_LAYER_ID, REBAR_COLOR_HEX);
}

/** 2Δ plan-geometry του οπλισμού ανά τύπο μέλους (`null` αν δεν εφαρμόζεται). */
function rebarPlanGeometryFor(entity: Entity): RebarPlanGeometry | null {
  if (isColumnEntity(entity)) return collectColumnRebarPlanGeometry(entity.params, entity.id);
  if (isBeamEntity(entity)) return collectBeamRebarPlanGeometry(entity);
  if (isFoundationEntity(entity)) return collectFootingRebarPlanGeometry(entity.params);
  if (isSlabEntity(entity)) return collectSlabRebarPlanGeometry(entity);
  return null;
}

/** 3Δ segments του οπλισμού ανά τύπο μέλους (κενό αν δεν εφαρμόζεται). */
function rebarSegments3DFor(entity: Entity): readonly RebarSeg3D[] {
  if (isColumnEntity(entity)) {
    const heightMm = entity.geometry?.height ?? entity.params.height;
    return collectColumnRebarSegments3D(entity, heightMm);
  }
  if (isBeamEntity(entity)) return collectBeamRebarSegments3D(entity);
  if (isFoundationEntity(entity)) return collectFootingRebarSegments3D(entity);
  if (isSlabEntity(entity)) return collectSlabRebarSegments3D(entity);
  return [];
}

function planSceneUnits(entity: Entity): SceneUnits | undefined {
  if (isColumnEntity(entity) || isBeamEntity(entity) || isFoundationEntity(entity) || isSlabEntity(entity)) {
    return entity.params.sceneUnits;
  }
  return undefined;
}

/** 3Δ segments → DXF LINEs με Z (group 30/31). Επιστρέφει το πλήθος. */
function emitRebarSegments3D(segs: readonly RebarSeg3D[], ownerId: string, out: Entity[]): number {
  let n = 0;
  for (const seg of segs) {
    const line: Rebar3DLine = {
      id: `__rebar_${ownerId}_${n++}`,
      type: 'line',
      layerId: REBAR_LAYER_ID,
      color: REBAR_COLOR_HEX,
      visible: true,
      start: { x: seg.a.x, y: seg.a.y },
      end: { x: seg.b.x, y: seg.b.y },
      dxfStartZMm: seg.a.zMm,
      dxfEndZMm: seg.b.zMm,
    };
    out.push(line);
  }
  return n;
}

/** Μετατρέπει μια `RebarPlanGeometry` σε DXF primitives. Επιστρέφει το πλήθος που μπήκε. */
function emitRebarGeometry(
  geo: RebarPlanGeometry | null,
  ownerId: string,
  sceneUnits: SceneUnits | undefined,
  out: Entity[],
): number {
  if (!geo) return 0;
  let n = 0;
  for (const path of geo.paths) {
    if (path.points.length < 2) continue;
    const poly: LWPolylineEntity = {
      id: `__rebar_${ownerId}_${n++}`,
      type: 'lwpolyline',
      layerId: REBAR_LAYER_ID,
      color: REBAR_COLOR_HEX,
      visible: true,
      vertices: projectVerticesTo2D(path.points),
      closed: path.closed,
    };
    out.push(poly);
  }
  const s = mmToSceneUnits(sceneUnits ?? 'mm');
  for (const dot of geo.dots) {
    const radius = (dot.diameterMm / 2) * s;
    if (!(radius > 1e-6)) continue; // degenerate circle = INVALID στον AutoCAD (audit hang)
    const circle: CircleEntity = {
      id: `__rebar_${ownerId}_${n++}`,
      type: 'circle',
      layerId: REBAR_LAYER_ID,
      color: REBAR_COLOR_HEX,
      visible: true,
      center: { x: dot.center.x, y: dot.center.y },
      radius, // mm → scene units (φυσική ακτίνα ράβδου)
    };
    out.push(circle);
  }
  return n;
}
