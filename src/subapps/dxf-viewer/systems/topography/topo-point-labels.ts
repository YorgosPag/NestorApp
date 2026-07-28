/**
 * ADR-656 M10 — survey points → native label entities (spot Ζ · number/code · boundary X,Y).
 *
 * The presentation counterpart of `topo-to-entities.ts` (contours): turn the raw survey
 * points + the parcel boundary into `text` + `point` entities that flow through
 * `completeEntity` (ADR-057) — so the labels get undo, persistence, rendering, selection and
 * export for FREE, exactly like the contours. No bespoke canvas layer.
 *
 * Big-player selectivity (Civil 3D COGO point-label styles): a ground point shows only its
 * spot elevation (a `point` node + the metre value); the full X,Y is drawn ONLY at the parcel
 * boundary vertices. X,Y is NEVER written at the ground points — that is the milestone.
 *
 * Pure: layer ids + the surface sampler are passed in (the hook owns lifecycle), so this stays
 * unit-testable and free of store side effects.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { PointEntity, TextEntity } from '../../types/entities';
import { generateEntityId } from '@/services/enterprise-id.service';
import type { TopoPoint } from './topo-types';
import type { TinSampler } from './tin-sampler';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { projectWorldPoint } from './topo-display-frame';
import { formatElevationLabel } from './topo-to-entities';
import { hasElevation } from './topo-point-elevation';
import {
  TOPO_POINT_ELEV_COLOR, TOPO_POINT_CODE_COLOR, TOPO_POINT_NUM_COLOR, TOPO_BOUNDARY_XY_COLOR,
  TOPO_POINT_TEXT_HEIGHT_MM, TOPO_POINT_LABEL_OFFSET_MM, TOPO_POINT_ELEV_DECIMALS,
  TOPO_ELEVATION_ABSENT_LABEL, TOPO_POINT_MEASURED_STYLE, TOPO_POINT_PLANIMETRIC_STYLE,
  type PointLabelOptions,
} from './topo-point-label-config';

/** Layer ids the label entities are assigned to (minted/ensured by the caller). */
export interface PointLabelLayerIds {
  readonly elevation: string;
  readonly code: string;
  readonly number: string;
  readonly boundary: string;
}

type LabelEntity = TextEntity | PointEntity;

/** A single left-aligned text label at a world position (canonical mm). */
function textAt(position: Point2D, text: string, layerId: string, color: string): TextEntity {
  return {
    id: generateEntityId(),
    type: 'text',
    layerId,
    color,
    position,
    text,
    fontSize: TOPO_POINT_TEXT_HEIGHT_MM,
    height: TOPO_POINT_TEXT_HEIGHT_MM,
    alignment: 'left',
  };
}

/**
 * Spot height: a `point` NODE at the surveyed location (the κουκίδα) plus its elevation in
 * metres, offset to the right so the glyphs sit beside the node — the Civil 3D spot-height pair.
 *
 * 🔴 **ADR-720 — the node is emitted for a planimetric point too, and that is the entire point of
 * the milestone.** A survey point without an elevation is invisible until something draws it, and
 * an invisible parcel corner cannot be snapped to — so this node is what turns «we no longer throw
 * the corner away» into «the user can trace the boundary onto it». Because it is a real scene
 * `point` entity flowing through `completeEntity` (ADR-057), it inherits rendering, selection,
 * undo, persistence, export **and OSNAP** with no snapping code written anywhere.
 *
 * The two kinds are told apart by glyph (filled vs hollow) and by label («12.47» vs «—»). Neither
 * substitutes a number: an unmeasured elevation stays unmeasured all the way to the paper.
 */
function toSpotEntities(
  p: TopoPoint, layers: PointLabelLayerIds, projector: WorldToDisplayProjector | null,
): LabelEntity[] {
  const at = projectWorldPoint({ x: p.x, y: p.y }, projector);
  const measured = hasElevation(p);
  const node: PointEntity = {
    id: generateEntityId(),
    type: 'point',
    layerId: layers.elevation,
    color: TOPO_POINT_ELEV_COLOR,
    position: at,
    style: measured ? TOPO_POINT_MEASURED_STYLE : TOPO_POINT_PLANIMETRIC_STYLE,
  };
  const label = textAt(
    { x: at.x + TOPO_POINT_LABEL_OFFSET_MM, y: at.y },
    measured
      ? formatElevationLabel(p.z, TOPO_POINT_ELEV_DECIMALS)
      : TOPO_ELEVATION_ABSENT_LABEL,
    layers.elevation,
    TOPO_POINT_ELEV_COLOR,
  );
  return [node, label];
}

/**
 * The point's identity above the node: number on the NUM layer, feature code on the CODE
 * layer — each its own label so a surveyor can freeze either independently. Both optional.
 */
function toIdentityEntities(
  p: TopoPoint, layers: PointLabelLayerIds, projector: WorldToDisplayProjector | null,
): TextEntity[] {
  const at = projectWorldPoint({ x: p.x, y: p.y }, projector);
  const out: TextEntity[] = [];
  if (p.pointNumber) {
    out.push(textAt(
      { x: at.x + TOPO_POINT_LABEL_OFFSET_MM, y: at.y + TOPO_POINT_LABEL_OFFSET_MM },
      p.pointNumber, layers.number, TOPO_POINT_NUM_COLOR,
    ));
  }
  if (p.code) {
    out.push(textAt(
      { x: at.x + TOPO_POINT_LABEL_OFFSET_MM, y: at.y + 2 * TOPO_POINT_LABEL_OFFSET_MM },
      p.code, layers.code, TOPO_POINT_CODE_COLOR,
    ));
  }
  return out;
}

/**
 * Boundary vertex: the vertex number + full X, Y and sampled Z, in metres — the legal parcel
 * corner label. This is the ONLY place X,Y is ever written. Z is sampled from the ONE derived
 * surface (same `zAtMm` primitive `buildPlotMeasurements` uses); `null` outside → omitted.
 *
 * ⚠️ ADR-650 §M10f — η **ΤΙΜΗ** X,Y μένει ΕΓΣΑ (νομικό μέγεθος: αυτό γράφει ο πίνακας
 * συντεταγμένων του τοπογράφου)· προβάλλεται μόνο η **ΘΕΣΗ** του κειμένου. Προβολή της τιμής
 * θα τύπωνε τοπικές συντεταγμένες με ετικέτα ΕΓΣΑ — σιωπηλό, και λάθος στο συμβόλαιο.
 */
function toBoundaryVertexLabels(
  v: Point2D, index: number, sampler: TinSampler, layers: PointLabelLayerIds,
  projector: WorldToDisplayProjector | null,
): TextEntity[] {
  const d = TOPO_POINT_ELEV_DECIMALS;
  const x = formatElevationLabel(v.x, d);
  const y = formatElevationLabel(v.y, d);
  const z = sampler.zAtMm(v.x, v.y);
  const coordText = z === null
    ? `Κ${index + 1}  Χ${x} Υ${y}`
    : `Κ${index + 1}  Χ${x} Υ${y} Ζ${formatElevationLabel(z, d)}`;
  const at = projectWorldPoint(v, projector);
  return [textAt({ x: at.x + TOPO_POINT_LABEL_OFFSET_MM, y: at.y }, coordText, layers.boundary, TOPO_BOUNDARY_XY_COLOR)];
}

/**
 * Build the label entities for a survey, honouring the three independent toggles. Ground
 * points get a spot node + Ζ (and optionally number/code); the boundary vertices get X,Y(+Z).
 * X,Y is never emitted for a ground point.
 *
 * `projector` (ADR-650 §M10f) is **υποχρεωτικό, όχι optional**: κάθε νέος καλών οφείλει να
 * απαντήσει «σε ποιο σύστημα κάθεται αυτό;». Το `null` σημαίνει ρητά «μη-γεωαναφερμένο έργο ⇒
 * WORLD ≡ DISPLAY», ενώ μια παραλειπόμενη παράμετρος θα σήμαινε «κανείς δεν το σκέφτηκε» —
 * που είναι ακριβώς πώς γεννήθηκε αυτό το bug.
 */
export function buildSurveyPointLabelEntities(
  points: readonly TopoPoint[],
  boundaryVertices: readonly Point2D[] | null,
  sampler: TinSampler,
  layers: PointLabelLayerIds,
  opts: PointLabelOptions,
  projector: WorldToDisplayProjector | null,
): LabelEntity[] {
  const entities: LabelEntity[] = [];

  for (const p of points) {
    if (opts.showElevation) entities.push(...toSpotEntities(p, layers, projector));
    if (opts.showPointNumberCode) entities.push(...toIdentityEntities(p, layers, projector));
  }

  if (opts.showBoundaryXy && boundaryVertices) {
    boundaryVertices.forEach((v, i) => {
      entities.push(...toBoundaryVertexLabels(v, i, sampler, layers, projector));
    });
  }

  return entities;
}
