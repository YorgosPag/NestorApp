/**
 * @fileoverview **ΤΟ ΣΧΕΔΙΟ-ΔΕΙΓΜΑ ΤΗΣ ΠΥΛΗΣ PIXELS** — ένα στοιχείο από κάθε τύπο, το καθένα στο δικό του κελί (CHECK 3.101).
 * @related ADR-909 §6.7 · rendering/contract/renderable-entity-type · ./measure-public-floorplan-pixels
 * @module subapps/dxf-viewer/print/public-floorplan/pixel-gate/pixel-gate-samples
 *
 * 🔑 **`Record` πάνω στο `RenderableEntityType`**: νέος τύπος στοιχείου χωρίς γραμμή εδώ **δεν μεταγλωττίζεται**.
 * Η γραμμή είναι είτε εργοστάσιο δείγματος είτε `null` = «δεν έχει δείγμα ακόμη» — και το `null` **δεν περνά
 * σιωπηλά**: η κρίση το βγάζει `K4:no-sample` (μηδενική ανοχή). Ο τύπος που δεν μετριέται έχει όνομα.
 *
 * 🔑 Κάθε δείγμα χτίζεται με το **εργοστάσιο της παραγωγής** (`buildDefault…Params` + `build…Entity`), ώστε η πύλη
 * να κρίνει το στοιχείο όπως το γεννά το εργαλείο — με τα προεπιλεγμένα χρώματα και πάχη του, εκεί όπου ζουν
 * τα ωμά `strokeStyle`. Μόνο τα σκέτα DXF πρωτογενή (που δεν έχουν εργοστάσιο) γράφονται ως αντικείμενα.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { RenderableEntityType } from '../../../rendering/contract/renderable-entity-type';
import { RENDERABLE_ENTITY_TYPES } from '../../../rendering/contract/renderable-entity-type';
import type { Entity, SceneModel } from '../../../types/entities';
import { createSceneLayer } from '../../../types/scene-types';
import { generateEntityId } from '../../../systems/entity-creation/utils';
import { convertSceneToDxf } from '../../../hooks/canvas/useDxfSceneConversion';
import { buildHatchEntityFromBoundary } from '../../../bim/hatch/hatch-completion';
import { buildScaleBarEntity } from '../../../bim/scale-bar/build-scale-bar-entity';
import { buildOpeningInfoTagEntity } from '../../../bim/opening-info-tag/build-opening-info-tag-entity';
import { buildDefaultWallParams, buildWallEntity } from '../../../hooks/drawing/wall-completion';
import { buildDefaultOpeningParams, buildOpeningEntity } from '../../../hooks/drawing/opening-completion';
import { buildDefaultSlabParams, buildSlabEntity } from '../../../hooks/drawing/slab-completion';
import { buildDefaultSlabOpeningParams, buildSlabOpeningEntity } from '../../../hooks/drawing/slab-opening-completion';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { buildDefaultBeamParams, buildBeamEntity } from '../../../hooks/drawing/beam-completion';
import { buildDefaultFoundationParams, buildFoundationEntity } from '../../../hooks/drawing/foundation-completion';
import { buildDefaultStairParams, buildStairEntity } from '../../../hooks/drawing/stair-completion';
import { buildDefaultRailingParams, buildRailingEntity } from '../../../hooks/drawing/railing-completion';
import { buildDefaultRoofParams, buildRoofEntity } from '../../../hooks/drawing/roof-completion';
import { buildDefaultFloorFinishParams, buildFloorFinishEntity } from '../../../hooks/drawing/floor-finish-completion';
import { buildDefaultThermalSpaceParams, buildThermalSpaceEntity } from '../../../hooks/drawing/thermal-space-completion';
import {
  buildDefaultSpaceSeparatorParams,
  buildSpaceSeparatorEntity,
} from '../../../hooks/drawing/space-separator-completion';
import { buildDefaultFurnitureParams, buildFurnitureEntity } from '../../../hooks/drawing/furniture-completion';
import {
  buildDefaultFloorplanSymbolParams,
  buildFloorplanSymbolEntity,
} from '../../../hooks/drawing/floorplan-symbol-completion';
import { buildDefaultMepFixtureParams, buildMepFixtureEntity } from '../../../hooks/drawing/mep-fixture-completion';
import {
  buildDefaultElectricalPanelParams,
  buildElectricalPanelEntity,
} from '../../../hooks/drawing/electrical-panel-completion';
import { buildDefaultMepManifoldParams, buildMepManifoldEntity } from '../../../hooks/drawing/mep-manifold-completion';
import { buildDefaultMepRadiatorParams, buildMepRadiatorEntity } from '../../../hooks/drawing/mep-radiator-completion';
import { buildDefaultMepBoilerParams, buildMepBoilerEntity } from '../../../hooks/drawing/mep-boiler-completion';
import {
  buildDefaultMepWaterHeaterParams,
  buildMepWaterHeaterEntity,
} from '../../../hooks/drawing/mep-water-heater-completion';
import { buildDefaultMepSegmentParams, buildMepSegmentEntity } from '../../../hooks/drawing/mep-segment-completion';
import {
  buildDefaultMepUnderfloorParams,
  buildMepUnderfloorEntity,
} from '../../../hooks/drawing/mep-underfloor-completion';
import {
  buildDefaultGenericSolidParams,
  buildGenericSolidEntity,
} from '../../../hooks/drawing/generic-solid-completion';
import { publicFloorplanRuleOf } from '../public-floorplan-profile';
import type { PixelGateSampleCell } from './measure-public-floorplan-pixels';

/** Πλευρά κελιού σε mm σχεδίου. Αρκετή για τοίχο 3 m με πόρτα, και για σκάλα. */
const CELL_MM = 5000;
/** Κενό από την άκρη του κελιού: κανένα δείγμα δεν αγγίζει το διπλανό του. */
const INSET_MM = 1000;
const COLUMNS = 8;
const LAYER_ID = 'pixel-gate-layer';

/** Τα σημεία αναφοράς ενός κελιού — κάθε εργοστάσιο παίρνει από εδώ, ποτέ δικές του συντεταγμένες. */
interface CellGeometry {
  readonly centre: Point2D;
  /** Οριζόντιο τμήμα στη μέση του κελιού (τοίχος, δοκός, σωλήνας). */
  readonly from: Point2D;
  readonly to: Point2D;
  /** Τετράγωνο μέσα στο κελί, αριστερόστροφα (πλάκα, δάπεδο, γραμμοσκίαση). */
  readonly ring: Point2D[];
}

type SampleFactory = (cell: CellGeometry) => Entity[];

type Built<E> = { readonly ok: true; readonly entity: E } | { readonly ok: false; readonly hardErrors: readonly string[] };

/** Δείγμα που το ίδιο το εργοστάσιο αρνείται είναι σφάλμα του **δείγματος** — δυνατά, όχι άδειο κελί. */
function built<E>(type: RenderableEntityType, result: Built<E>): E {
  if (!result.ok) throw new Error(`pixel-gate: sample "${type}" rejected: ${result.hardErrors.join(', ')}`);
  return result.entity;
}

function primitive<T extends Entity['type']>(type: T): { id: string; type: T; layerId: string; visible: true } {
  return { id: generateEntityId(), type, layerId: LAYER_ID, visible: true };
}

function wallOf(cell: CellGeometry) {
  return built('wall', buildWallEntity(buildDefaultWallParams(cell.from, cell.to), LAYER_ID));
}

function slabOf(cell: CellGeometry) {
  return built('slab', buildSlabEntity(buildDefaultSlabParams(cell.ring), LAYER_ID));
}

function hatchOf(cell: CellGeometry): Entity[] {
  const hatch = buildHatchEntityFromBoundary(cell.ring, generateEntityId(), LAYER_ID);
  if (hatch === null) throw new Error('pixel-gate: the "hatch" sample was not built');
  return [hatch];
}

export const PIXEL_GATE_SAMPLES: Readonly<Record<RenderableEntityType, SampleFactory | null>> = {
  // ── Σκέτο DXF ──────────────────────────────────────────────────────────────
  line: (c) => [{ ...primitive('line'), start: c.from, end: c.to }],
  polyline: (c) => [{ ...primitive('polyline'), vertices: c.ring, closed: true }],
  lwpolyline: (c) => [{ ...primitive('lwpolyline'), vertices: c.ring, closed: true }],
  circle: (c) => [{ ...primitive('circle'), center: c.centre, radius: 1200 }],
  arc: (c) => [{ ...primitive('arc'), center: c.centre, radius: 1200, startAngle: 0, endAngle: 180 }],
  ellipse: (c) => [{ ...primitive('ellipse'), center: c.centre, majorAxis: 1400, minorAxis: 800 }],
  rectangle: (c) => [{ ...primitive('rectangle'), x: c.ring[0].x, y: c.ring[0].y, width: 3000, height: 3000 }],
  rect: (c) => [{ ...primitive('rect'), x: c.ring[0].x, y: c.ring[0].y, width: 3000, height: 3000 }],
  point: (c) => [{ ...primitive('point'), position: c.centre }],
  hatch: hatchOf,
  'scale-bar': (c) => [buildScaleBarEntity(c.from, c.to, { layerId: LAYER_ID })],
  'opening-info-tag': (c) => [buildOpeningInfoTagEntity(c.centre, {}, generateEntityId(), LAYER_ID)],
  // Χωρίς δείγμα ακόμη — το Κ4 τα ονομάζει ένα-ένα.
  text: null,
  mtext: null,
  spline: null,
  dimension: null,
  'angle-measurement': null,
  xline: null,
  ray: null,
  leader: null,
  'annotation-symbol': null,
  table: null,
  image: null,
  'topo-surface': null,

  // ── BIM ────────────────────────────────────────────────────────────────────
  wall: (c) => [wallOf(c)],
  opening: (c) => {
    const host = wallOf(c);
    return [host, built('opening', buildOpeningEntity(buildDefaultOpeningParams(host, c.centre), host, LAYER_ID))];
  },
  slab: (c) => [slabOf(c)],
  'slab-opening': (c) => {
    const host = slabOf(c);
    const params = buildDefaultSlabOpeningParams(host, c.centre);
    return [host, built('slab-opening', buildSlabOpeningEntity(params, host, LAYER_ID))];
  },
  column: (c) => [built('column', buildColumnEntity(buildDefaultColumnParams(c.centre), LAYER_ID))],
  beam: (c) => [built('beam', buildBeamEntity(buildDefaultBeamParams(c.from, c.to), LAYER_ID))],
  foundation: (c) => [built('foundation', buildFoundationEntity(buildDefaultFoundationParams(c.centre), LAYER_ID))],
  stair: (c) => [{ ...buildStairEntity(buildDefaultStairParams(c.from, 0), LAYER_ID), layerId: LAYER_ID }],
  railing: (c) => [built('railing', buildRailingEntity(buildDefaultRailingParams(c.from, c.to), LAYER_ID))],
  roof: (c) => [built('roof', buildRoofEntity(buildDefaultRoofParams(c.ring), LAYER_ID))],
  'floor-finish': (c) => [
    built('floor-finish', buildFloorFinishEntity(buildDefaultFloorFinishParams(c.ring), LAYER_ID)),
  ],
  'thermal-space': (c) => [
    built('thermal-space', buildThermalSpaceEntity(buildDefaultThermalSpaceParams(c.ring), LAYER_ID)),
  ],
  'space-separator': (c) => [
    built('space-separator', buildSpaceSeparatorEntity(buildDefaultSpaceSeparatorParams(c.from, c.to), LAYER_ID)),
  ],
  furniture: (c) => [built('furniture', buildFurnitureEntity(buildDefaultFurnitureParams(c.centre), LAYER_ID))],
  'floorplan-symbol': (c) => [
    built('floorplan-symbol', buildFloorplanSymbolEntity(buildDefaultFloorplanSymbolParams(c.centre), LAYER_ID)),
  ],
  'mep-fixture': (c) => [
    built('mep-fixture', buildMepFixtureEntity(buildDefaultMepFixtureParams(c.centre), LAYER_ID)),
  ],
  'electrical-panel': (c) => [
    built('electrical-panel', buildElectricalPanelEntity(buildDefaultElectricalPanelParams(c.centre), LAYER_ID)),
  ],
  'mep-manifold': (c) => [
    built('mep-manifold', buildMepManifoldEntity(buildDefaultMepManifoldParams(c.centre), LAYER_ID)),
  ],
  'mep-radiator': (c) => [
    built('mep-radiator', buildMepRadiatorEntity(buildDefaultMepRadiatorParams(c.centre), LAYER_ID)),
  ],
  'mep-boiler': (c) => [built('mep-boiler', buildMepBoilerEntity(buildDefaultMepBoilerParams(c.centre), LAYER_ID))],
  'mep-water-heater': (c) => [
    built('mep-water-heater', buildMepWaterHeaterEntity(buildDefaultMepWaterHeaterParams(c.centre), LAYER_ID)),
  ],
  'mep-segment': (c) => [
    built('mep-segment', buildMepSegmentEntity(buildDefaultMepSegmentParams(c.from, c.to), LAYER_ID)),
  ],
  'mep-underfloor': (c) => [
    built('mep-underfloor', buildMepUnderfloorEntity(buildDefaultMepUnderfloorParams(c.ring), LAYER_ID)),
  ],
  'generic-solid': (c) => [
    built('generic-solid', buildGenericSolidEntity(buildDefaultGenericSolidParams(c.centre), LAYER_ID)),
  ],
  // Χωρίς δείγμα ακόμη: θέλουν ξενιστή / υπολογισμένη γεωμετρία / αρχείο 3Δ.
  'wall-covering': null,
  'mep-fitting': null,
  'imported-mesh': null,
};

function cellGeometry(index: number): { geometry: CellGeometry; minX: number; minY: number } {
  const minX = (index % COLUMNS) * CELL_MM;
  const minY = Math.floor(index / COLUMNS) * CELL_MM;
  const lo = INSET_MM;
  const hi = CELL_MM - INSET_MM;
  const mid = CELL_MM / 2;
  return {
    minX,
    minY,
    geometry: {
      centre: { x: minX + mid, y: minY + mid },
      from: { x: minX + lo, y: minY + mid },
      to: { x: minX + hi, y: minY + mid },
      ring: [
        { x: minX + lo, y: minY + lo },
        { x: minX + hi, y: minY + lo },
        { x: minX + hi, y: minY + hi },
        { x: minX + lo, y: minY + hi },
      ],
    },
  };
}

function sceneOf(entities: Entity[], bounds: SceneModel['bounds']): SceneModel {
  const layer = createSceneLayer({ id: LAYER_ID, name: 'pixel-gate' });
  return { entities, layersById: { [LAYER_ID]: layer }, bounds, units: 'mm' };
}

/**
 * «Φτάνει στην εικόνα, και το δείχνει το προφίλ με **όλες** τις ομάδες αναμμένες;» — ρωτιούνται η ίδια η
 * μετατροπή και το ίδιο το προφίλ. `unconvertible` = η μετατροπή δεν έδωσε **τίποτα**: ο τύπος δεν έχει δρόμο
 * προς την εικόνα, ό,τι κι αν λέει ο πίνακας του προφίλ.
 */
function reachOf(entities: Entity[], bounds: SceneModel['bounds']): { shown: boolean; unconvertible: boolean } {
  const converted = convertSceneToDxf(sceneOf(entities, bounds)).entities;
  const shown = converted.some((entity) => {
    const rule = publicFloorplanRuleOf(entity);
    return rule !== null && rule !== 'hide';
  });
  return { shown, unconvertible: converted.length === 0 };
}

export interface PixelGateSampleScene {
  readonly scene: SceneModel;
  readonly cells: readonly PixelGateSampleCell[];
  /** Οι τύποι που **έχουν** δείγμα — ό,τι λείπει το ονομάζει η κρίση (Κ4). */
  readonly sampleTypes: readonly string[];
}

/** Το σχέδιο-δείγμα: ένα κελί ανά τύπο, με τη σειρά του `RENDERABLE_ENTITY_TYPES`. */
export function buildPixelGateSampleScene(): PixelGateSampleScene {
  const entities: Entity[] = [];
  const cells: PixelGateSampleCell[] = [];
  const sampled = RENDERABLE_ENTITY_TYPES.filter((type) => PIXEL_GATE_SAMPLES[type] !== null);

  sampled.forEach((type, index) => {
    const { geometry, minX, minY } = cellGeometry(index);
    const maxX = minX + CELL_MM;
    const maxY = minY + CELL_MM;
    const own = PIXEL_GATE_SAMPLES[type]?.(geometry) ?? [];
    const bounds = { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
    entities.push(...own);
    cells.push({ sample: type, ...reachOf(own, bounds), minX, minY, maxX, maxY });
  });

  const rows = Math.ceil(sampled.length / COLUMNS);
  const bounds = { min: { x: 0, y: 0 }, max: { x: COLUMNS * CELL_MM, y: rows * CELL_MM } };
  return { scene: sceneOf(entities, bounds), cells, sampleTypes: sampled };
}
