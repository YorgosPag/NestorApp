/**
 * ADR-471 — Beam Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) of a beam to a paper-resolution PNG, AND projects the L/b/h
 * dimension anchors through the SAME camera into normalised raster space. The
 * perspective region then draws those projections as ordinary 2D `dim` primitives
 * → the 3D annotations share the EXACT dimension SSoT with the elevation/section
 * views. Mirror του `footing-detail-3d-capture.ts`, reusing the shared
 * `detail-3d-capture-core` scaffolding (camera / prism / bbox dims / capture flow).
 *
 * geometry-is-SSoT: cage from `buildBeamRebarCage`, prism + dims from a CANONICAL
 * straight copy of the beam (axis laid along X from origin, rotation/elevation/slope
 * zeroed) so the isometric is orthographic + the dims read true (Revit beam detail).
 *
 * 🚨 dispose gotcha (ADR-457): dispose ΜΟΝΟ τη geometry του cage (το `REBAR_MATERIAL`
 * είναι shared singleton)· dispose πλήρως τον prism· ο renderer disposes μέσα στο core.
 * ADR-040: fully offscreen — never touches the live renderer/scene.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/beam-detail-3d-capture
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §3
 */

import type { BeamEntity, BeamParams } from '../../../types/beam-types';
import { computeBeamGeometry } from '../../../geometry/beam-geometry';
import { buildBeamSectionContext } from '../../section-context';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildBeamRebarCage } from '../../../../bim-3d/converters/beam-rebar-3d';
import type { ColumnDetail3dCapture } from './column-detail-3d-capture';
import {
  MM_TO_M,
  bboxDimSpecs,
  buildConcretePrism,
  captureDetail3d,
  projectDims,
} from './detail-3d-capture-core';

/** Re-export: the capture shape is generic (raster + projected annotations). */
export type BeamDetail3dCapture = ColumnDetail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface BeamDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** Plan dims (mm) of the beam along its canonical axes + section depth. */
interface BeamPlanDimsMm { spanMm: number; widthMm: number; depthMm: number; }

/** Straight, un-rotated, flat copy of the beam (axis along +X from origin) → orthographic. */
function canonicalBeam(beam: BeamEntity): BeamEntity {
  const p = beam.params;
  const dist = Math.hypot(p.endPoint.x - p.startPoint.x, p.endPoint.y - p.startPoint.y);
  // Drop curve/slope so the iso is a clean orthographic straight beam.
  const { curveControl: _curveControl, topElevationEnd: _topElevationEnd, ...rest } = p;
  const params: BeamParams = {
    ...rest,
    kind: 'straight',
    startPoint: { x: 0, y: 0, z: 0 },
    endPoint: { x: dist, y: 0, z: 0 },
  };
  return { ...beam, params, geometry: computeBeamGeometry(params) };
}

/** True beam dims (mm) along its canonical axes from the section-context SSoT. */
function planDimsMm(beam: BeamEntity): BeamPlanDimsMm {
  const ctx = buildBeamSectionContext(beam);
  return { spanMm: ctx.spanMm, widthMm: ctx.widthMm, depthMm: ctx.depthMm };
}

/**
 * Captures the beam reinforcement as an isometric PNG plus the projected L/b/h
 * dimension anchors (normalised raster space), or `null` when there is no
 * buildable cage / degenerate geometry. Disposes every GPU resource it creates.
 */
export function captureBeamDetail3d(
  beam: BeamEntity,
  options: BeamDetail3dCaptureOptions,
): BeamDetail3dCapture | null {
  const canonical = canonicalBeam(beam);
  const cage = buildBeamRebarCage(canonical, 0);
  if (!cage) return null;

  const sceneToM = sceneUnitsToMeters(canonical.params.sceneUnits ?? 'mm');
  const vertsM = scalePoints(canonical.geometry.outline.vertices, sceneToM);
  const heightM = Math.max(0, canonical.params.depth) * MM_TO_M;
  const dims = planDimsMm(beam);

  return captureDetail3d(
    { cage, prism: buildConcretePrism(vertsM, heightM) },
    options.widthPx,
    options.heightPx,
    (camera) => ({
      dims: projectDims(bboxDimSpecs(vertsM, { x: dims.spanMm, y: dims.widthMm, h: dims.depthMm }, heightM), camera),
      marks: [],
    }),
  );
}
