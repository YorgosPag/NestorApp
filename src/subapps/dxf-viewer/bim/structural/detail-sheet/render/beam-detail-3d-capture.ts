/**
 * ADR-471 — Beam Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) of a beam to a paper-resolution PNG, AND projects the L/b/h
 * dimension anchors through the SAME camera into normalised raster space. The
 * perspective region then draws those projections as ordinary 2D `dim` primitives
 * → the 3D annotations share the EXACT dimension SSoT with the elevation/section
 * views. Mirror του `footing-detail-3d-capture.ts`, reusing the shared
 * `detail-3d-capture-core` scaffolding (camera / prism / render / dispose).
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

import * as THREE from 'three';
import { finiteBox3FromObject } from '../../../../bim-3d/scene/finite-bounds';
import type { BeamEntity, BeamParams } from '../../../types/beam-types';
import type { Point2D } from '../../../../rendering/types/Types';
import { computeBeamGeometry } from '../../../geometry/beam-geometry';
import { buildBeamSectionContext } from '../../section-context';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildBeamRebarCage } from '../../../../bim-3d/converters/beam-rebar-3d';
import type { ColumnDetail3dCapture } from './column-detail-3d-capture';
import {
  MM_TO_M, SCENE_BG_HEX, CAMERA_AZIMUTH_RAD,
  buildConcretePrism, disposeOwned, disposeCageGeometry, frameCamera, projectNorm,
  renderSceneToDataUrl,
} from './detail-3d-capture-core';

/** Re-export: the capture shape is generic (raster + projected annotations). */
export type BeamDetail3dCapture = ColumnDetail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface BeamDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** World direction that projects to screen-right in the iso view (camera-right). */
const SCREEN_RIGHT = new THREE.Vector3(Math.cos(CAMERA_AZIMUTH_RAD), 0, -Math.sin(CAMERA_AZIMUTH_RAD)).normalize();

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

/** Bounding box (metre coords) of a plan vertex set (XY footprint). */
function planBbox(verts: readonly Point2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
  }
  return { minX, maxX, minY, maxY };
}

/** L/b/h dimension specs as measured 3D points (world metres) + value text (mm). */
function dimSpecs(vertsM: readonly Point2D[], dims: BeamPlanDimsMm, heightM: number): {
  a: THREE.Vector3; b: THREE.Vector3; text: string;
}[] {
  const bb = planBbox(vertsM);
  // AXIS_FLIP: plan (x, y) → three (x, 0, −y). Base corners of the footprint bbox.
  const bl = new THREE.Vector3(bb.minX, 0, -bb.minY);
  const br = new THREE.Vector3(bb.maxX, 0, -bb.minY);
  const tr = new THREE.Vector3(bb.maxX, 0, -bb.maxY);
  const tl = new THREE.Vector3(bb.minX, 0, -bb.maxY);
  const rightCorner = [bl, br, tr, tl].reduce(
    (best, p) => (p.dot(SCREEN_RIGHT) > best.dot(SCREEN_RIGHT) ? p : best), bl,
  );
  return [
    { a: bl, b: br, text: String(Math.round(dims.spanMm)) },
    { a: br, b: tr, text: String(Math.round(dims.widthMm)) },
    { a: rightCorner.clone(), b: rightCorner.clone().setY(heightM), text: String(Math.round(dims.depthMm)) },
  ];
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
  const prism = buildConcretePrism(vertsM, heightM);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG_HEX);
  if (prism) scene.add(prism);
  scene.add(cage);

  const { widthPx, heightPx } = options;
  try {
    const box = finiteBox3FromObject(scene);
    if (!box) return null;
    const camera = frameCamera(box, widthPx / heightPx);
    const dataUrl = renderSceneToDataUrl(scene, camera, widthPx, heightPx);
    if (!dataUrl) return null;

    const dims = dimSpecs(vertsM, planDimsMm(beam), heightM).map((d) => ({
      a: projectNorm(d.a, camera), b: projectNorm(d.b, camera), text: d.text,
    }));
    return {
      dataUrl, widthPx, heightPx,
      centroid: projectNorm(box.getCenter(new THREE.Vector3()), camera),
      dims, marks: [],
    };
  } finally {
    disposeOwned(prism);
    disposeCageGeometry(cage);
  }
}
