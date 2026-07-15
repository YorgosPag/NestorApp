/**
 * IFC4 Covering Serializer — ETICS Thermal Envelope (ADR-396 P9)
 *
 * 6ος entity serializer. Εξάγει την εξωτερική θερμοπρόσοψη (ETICS) ως
 * `IfcCovering` `PredefinedType=INSULATION`, **ένα ανά καλυπτόμενο στοιχείο**
 * (απόφαση Giorgio· §3.2a). Κάθε covering:
 *   - `IfcRelCoversBldgElements` → το στοιχείο που καλύπτει (τοίχος/κολώνα/
 *     δοκάρι/πλάκα· τα ανοίγματα → reveal covering στον host τοίχο).
 *   - `IfcMaterial` + `IfcMaterialLayer` (πάχος) + `IfcMaterialLayerSet` (1
 *     στρώση) via `IfcRelAssociatesMaterial`.
 *   - `Pset_MaterialThermal.ThermalConductivity` (λ από P8 SSoT) όταν το υλικό
 *     είναι γνωστό preset + `includePsets` ενεργό.
 *
 * **Semantic-only** (απόφαση Giorgio· OQ-P9-2): το covering ΔΕΝ έχει δική του
 * γεωμετρία (placement/representation = `$`) — μόνο υλικό/πάχος/θερμικά +
 * σχέση. → παραλείπεται το `IfcMaterialLayerSetUsage` (γεωμετρική τοποθέτηση,
 * χωρίς νόημα εδώ)· το LayerSet associate-άρεται απευθείας (valid IFC4).
 *
 * **Walls:** οι τοίχοι ΔΕΝ κουβαλούν per-element `envelopeLayer` — η Z1 facade
 * τους ορίζεται από το per-floor `ThermalEnvelopeSpec` (`params.envelopeSpecs`).
 * Εξωτ. τοίχοι = closed chains από `computeEnvelopePerimeter` (P3 SSoT).
 *
 * Σειρά: μετά walls/columns/beams/slabs/openings (χρειάζεται γεμάτα τα id-maps
 * του `SerializerContext`), πριν το per-storey containment.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-396-bim-external-thermal-envelope-etics.md §3.2(a), §7 (P9)
 */

import { generateIfcGuid } from '@/services/enterprise-id-convenience';
import {
  isWallEntity,
  isColumnEntity,
  isBeamEntity,
  isSlabEntity,
  isOpeningEntity,
  isFloorFinishEntity,
  type AnySceneEntity,
} from '@/subapps/dxf-viewer/types/entities';
import { isWallHostedOpening } from '@/subapps/dxf-viewer/bim/types/opening-types';
import {
  getEnvelopeLayer,
  getOpeningRevealInsulation,
} from '@/subapps/dxf-viewer/bim/types/envelope-contribution';
import type { EnvelopeLayer } from '@/subapps/dxf-viewer/bim/types/thermal-envelope-types';
import {
  getThermalConductivityLambda,
  getSpecificHeat,
} from '@/subapps/dxf-viewer/bim/walls/wall-material-catalog';
import {
  getFloorFinishLambda,
} from '@/subapps/dxf-viewer/bim/floor-finishes/floor-finish-material-catalog';
import { computeEnvelopePerimeter } from '@/subapps/dxf-viewer/bim/geometry/envelope-perimeter';

import {
  IfcGraph,
  enumValue,
  lbl,
  real,
  ref,
  typed,
} from '../ifc-entity-graph';
import type { SpatialHierarchyOutput } from '../ifc-spatial-hierarchy';
import type { IfcExportParams } from '../ifc-exporter.service';
import type { SceneModel } from '@/subapps/dxf-viewer/types/scene';

import type { SerializerContext } from './serializer-context';
import { pushElementForStorey } from './serializer-context';

// ─── Scene iteration SSoT ────────────────────────────────────────────────────

/**
 * Το κοινό preamble κάθε covering serializer: guard `params.scenes`, υπολογισμός
 * `includePsets`, iteration ανά (floor, scene) με resolved `storeyID` (skip
 * floors χωρίς storey). Ο caller περνά ό,τι ειδικό μέσω closure — έτσι ο
 * `serializeEnvelopeCoverings` και ο `serializeFloorFinishCoverings` δεν κρατούν
 * αντιγραμμένο boilerplate (ADR-583/N.18 anti-duplication).
 */
function forEachSceneStorey(
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  visit: (args: {
    floorId: string;
    scene: SceneModel;
    storeyID: number;
    includePsets: boolean;
  }) => void,
): void {
  if (!params.scenes) return;
  const includePsets = params.includePsets ?? true;
  for (const [floorId, scene] of params.scenes) {
    const storeyID = spatial.storeyIDs.get(floorId);
    if (storeyID == null) continue;
    visit({ floorId, scene, storeyID, includePsets });
  }
}

// ─── Public entry point ─────────────────────────────────────────────────────

export function serializeEnvelopeCoverings(
  graph: IfcGraph,
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  ctx: SerializerContext,
): void {
  forEachSceneStorey(spatial, params, ({ floorId, scene, storeyID, includePsets }) => {
    const w: CoveringWriteContext = { storeyID, includePsets, ctx };
    writeWallCoverings(graph, scene.entities, floorId, params, w);
    writeElementCoverings(graph, scene.entities, w);
  });
}

// ─── Write context ──────────────────────────────────────────────────────────

interface CoveringWriteContext {
  readonly storeyID: number;
  readonly includePsets: boolean;
  readonly ctx: SerializerContext;
}

// ─── Z1 facade walls (driven by per-floor spec) ─────────────────────────────

function writeWallCoverings(
  graph: IfcGraph,
  entities: readonly AnySceneEntity[],
  floorId: string,
  params: IfcExportParams,
  w: CoveringWriteContext,
): void {
  const spec = params.envelopeSpecs?.get(floorId);
  if (!spec || !spec.zones.Z1) return;

  const walls = entities.filter(isWallEntity);
  if (walls.length === 0) return;

  const units = walls[0]?.params.sceneUnits ?? 'mm';
  const { chains } = computeEnvelopePerimeter(walls, spec.thickness_m, units);
  const closed = chains.filter((c) => c.closed);
  const active = closed.length > 0 ? closed : chains;
  const exteriorWallIds = new Set(active.flatMap((c) => c.wallIds));

  const layer: EnvelopeLayer = {
    materialId: spec.materialId,
    thickness_m: spec.thickness_m,
    zone: 'Z1',
  };
  for (const wallId of exteriorWallIds) {
    const coveredID = w.ctx.wallIDs.get(wallId);
    if (coveredID == null) continue;
    writeCovering(graph, coveredID, layer, w);
  }
}

// ─── Per-element coverings (Z1 columns/beams · Z2/Z3 slabs · Z4 openings) ────

function writeElementCoverings(
  graph: IfcGraph,
  entities: readonly AnySceneEntity[],
  w: CoveringWriteContext,
): void {
  for (const e of entities) {
    if (isColumnEntity(e) || isBeamEntity(e) || isSlabEntity(e)) {
      const layer = getEnvelopeLayer(e.params);
      if (!layer) continue;
      const coveredID = lookupElementID(w.ctx, e);
      if (coveredID != null) writeCovering(graph, coveredID, layer, w);
    } else if (isOpeningEntity(e)) {
      const reveal = getOpeningRevealInsulation(e.params);
      if (!reveal) continue;
      // Z4 reveal lines the host wall around the opening — relate to the wall
      // (IfcOpeningElement is not an IfcBuildingElement, cannot be covered).
      // ADR-615 — a self-hosted opening has no host wall to line.
      if (!isWallHostedOpening(e)) continue;
      const coveredID = w.ctx.wallIDs.get(e.params.wallId);
      if (coveredID != null) writeCovering(graph, coveredID, reveal, w);
    }
  }
}

function lookupElementID(ctx: SerializerContext, e: AnySceneEntity): number | undefined {
  if (isColumnEntity(e)) return ctx.columnIDs.get(e.id);
  if (isBeamEntity(e)) return ctx.beamIDs.get(e.id);
  if (isSlabEntity(e)) return ctx.slabIDs.get(e.id);
  return undefined;
}

// ─── Per-covering emission ──────────────────────────────────────────────────

function coveringName(layer: EnvelopeLayer): string {
  return `Thermal Envelope ${layer.zone}`;
}

function writeCovering(
  graph: IfcGraph,
  coveredID: number,
  layer: EnvelopeLayer,
  w: CoveringWriteContext,
): void {
  // Semantic-only: placement (#6) + representation (#7) = $.
  const coveringID = graph.add('IFCCOVERING', [
    lbl(generateIfcGuid()),
    null,
    lbl(coveringName(layer)),
    null,
    null,
    null,
    null,
    null,
    enumValue('INSULATION'),
  ]);

  graph.add('IFCRELCOVERSBLDGELEMENTS', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    ref(coveredID),
    [ref(coveringID)],
  ]);

  appendCoveringMaterial(graph, coveringID, layer, w.includePsets);
  pushElementForStorey(w.ctx, w.storeyID, coveringID);
}

// ─── Material + thermal property set ────────────────────────────────────────

function appendCoveringMaterial(
  graph: IfcGraph,
  coveringID: number,
  layer: EnvelopeLayer,
  includePsets: boolean,
): void {
  const materialID = graph.add('IFCMATERIAL', [lbl(layer.materialId), null, null]);
  const matLayerID = graph.add('IFCMATERIALLAYER', [
    ref(materialID),
    real(layer.thickness_m),
    null,
    null,
    null,
    null,
    null,
  ]);
  const layerSetID = graph.add('IFCMATERIALLAYERSET', [
    [ref(matLayerID)],
    lbl(coveringName(layer)),
    null,
  ]);
  graph.add('IFCRELASSOCIATESMATERIAL', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    [ref(coveringID)],
    ref(layerSetID),
  ]);

  if (includePsets) appendThermalPset(graph, materialID, layer.materialId);
}

// ─── Floor Finish coverings (ADR-419) ─────────────────────────────────────────

/**
 * Serialize `FloorFinishEntity` instances as `IfcCovering` `FLOORING`.
 *
 * Contrast with ETICS (INSULATION, semantic-only):
 *   - `PredefinedType=FLOORING`
 *   - `Pset_CoveringCommon`: Thickness (m) + ThermalTransmittance (U = λ/d)
 *   - Contained directly in storey (no host element relationship needed)
 *
 * Geometry: semantic-only in this revision (placement/representation = $).
 * Full extruded polygon geometry can be added in a subsequent slice.
 */
export function serializeFloorFinishCoverings(
  graph: IfcGraph,
  spatial: SpatialHierarchyOutput,
  params: IfcExportParams,
  ctx: SerializerContext,
): void {
  forEachSceneStorey(spatial, params, ({ scene, storeyID, includePsets }) => {
    for (const entity of scene.entities) {
      if (!isFloorFinishEntity(entity)) continue;

      const coveringID = graph.add('IFCCOVERING', [
        lbl(generateIfcGuid()),
        null,
        lbl(entity.params.name ?? 'Floor Finish'),
        null,
        null,
        null,
        null,
        null,
        enumValue('FLOORING'),
      ]);

      if (includePsets) {
        appendFloorFinishPset(graph, coveringID, entity.params.materialId, entity.params.thicknessMm);
      }

      pushElementForStorey(ctx, storeyID, coveringID);
    }
  });
}

function appendFloorFinishPset(
  graph: IfcGraph,
  coveringID: number,
  materialId: string,
  thicknessMm: number,
): void {
  const thicknessM = thicknessMm / 1000;
  const thicknessPropID = graph.add('IFCPROPERTYSINGLEVALUE', [
    lbl('Thickness'),
    null,
    typed('IfcLengthMeasure', real(thicknessM)),
    null,
  ]);

  const propIDs: number[] = [thicknessPropID];

  const lambda = getFloorFinishLambda(materialId);
  if (lambda !== undefined && thicknessM > 0) {
    const U = lambda / thicknessM;
    propIDs.push(graph.add('IFCPROPERTYSINGLEVALUE', [
      lbl('ThermalTransmittance'),
      null,
      typed('IfcThermalTransmittanceMeasure', real(U)),
      null,
    ]));
  }

  const psetID = graph.add('IFCPROPERTYSET', [
    lbl(generateIfcGuid()),
    null,
    lbl('Pset_CoveringCommon'),
    null,
    propIDs.map((id) => ref(id)),
  ]);

  graph.add('IFCRELDEFINESBYPROPERTIES', [
    lbl(generateIfcGuid()),
    null,
    null,
    null,
    [ref(coveringID)],
    ref(psetID),
  ]);
}

// ─── Material + thermal property set ────────────────────────────────────────

/**
 * `Pset_MaterialThermal` via `IfcMaterialProperties` (IFC4 Name/Description/
 * Properties/Material). λ + cp (αν γνωστά) από τον P8/P10 SSoT.
 * custom/άγνωστο λ → skip (covering + material μένουν χωρίς θερμική ιδιότητα).
 */
function appendThermalPset(graph: IfcGraph, materialID: number, materialId: string): void {
  const lambda = getThermalConductivityLambda(materialId);
  if (lambda === undefined) return;

  const lambdaPropID = graph.add('IFCPROPERTYSINGLEVALUE', [
    lbl('ThermalConductivity'),
    null,
    typed('IfcThermalConductivityMeasure', real(lambda)),
    null,
  ]);

  const propIDs: number[] = [lambdaPropID];

  const cp = getSpecificHeat(materialId);
  if (cp !== undefined) {
    propIDs.push(graph.add('IFCPROPERTYSINGLEVALUE', [
      lbl('SpecificHeatCapacity'),
      null,
      typed('IfcSpecificHeatCapacityMeasure', real(cp)),
      null,
    ]));
  }

  graph.add('IFCMATERIALPROPERTIES', [
    lbl('Pset_MaterialThermal'),
    null,
    propIDs.map((id) => ref(id)),
    ref(materialID),
  ]);
}
