/**
 * ADR-463 — Footing Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) of a footing to a paper-resolution PNG, AND projects the W/L/H
 * dimension anchors through the SAME camera into normalised raster space. The
 * perspective region then draws those projections as ordinary 2D `dim` primitives
 * → the 3D annotations share the EXACT dimension SSoT with the plan/section views.
 * Mirror του `column-detail-3d-capture.ts`, reusing the shared
 * `detail-3d-capture-core` scaffolding (camera / prism / render / dispose).
 *
 * geometry-is-SSoT: cage from `buildFootingRebarCage`, prism + dims from a
 * CANONICAL un-rotated copy of the footing (rotation/anchor/axis zeroed) so the
 * isometric is orthographic + the dims read true (Revit/Tekla footing detail).
 *
 * 🚨 dispose gotcha (ADR-457): dispose ΜΟΝΟ τη geometry του cage (το `REBAR_MATERIAL`
 * είναι shared singleton)· dispose πλήρως τον prism· ο renderer disposes μέσα στο core.
 * ADR-040: fully offscreen — never touches the live renderer/scene.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/footing-detail-3d-capture
 * @see docs/centralized-systems/reference/adrs/ADR-463-foundation-reinforcement-ux.md
 */

import * as THREE from 'three';
import type {
  FoundationEntity,
  FoundationParams,
  PadFootingParams,
  StripFootingParams,
  TieBeamParams,
} from '../../../types/foundation-types';
import type { Point2D } from '../../../../rendering/types/Types';
import { computeFoundationGeometry } from '../../../geometry/foundation-geometry';
import { buildFootingSectionContext } from '../../section-context';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildFootingRebarCage } from '../../../../bim-3d/converters/footing-rebar-3d';
import type { ColumnDetail3dCapture } from './column-detail-3d-capture';
import {
  MM_TO_M, SCENE_BG_HEX, CAMERA_AZIMUTH_RAD,
  buildConcretePrism, disposeOwned, disposeCageGeometry, frameCamera, projectNorm,
  renderSceneToDataUrl,
} from './detail-3d-capture-core';

/** Re-export: the capture shape is generic (raster + projected annotations). */
export type FootingDetail3dCapture = ColumnDetail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface FootingDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** World direction that projects to screen-right in the iso view (camera-right). */
const SCREEN_RIGHT = new THREE.Vector3(Math.cos(CAMERA_AZIMUTH_RAD), 0, -Math.sin(CAMERA_AZIMUTH_RAD)).normalize();

/** Plan dims (mm) of the footing along its canonical X / Y axes + height. */
interface FootingPlanDimsMm { xMm: number; yMm: number; hMm: number; }

/** Un-rotated copy of the footing (rotation/anchor/axis-angle zeroed) → orthographic. */
function canonicalFooting(foundation: FoundationEntity): FoundationEntity {
  const p = foundation.params;
  let params: FoundationParams;
  if (p.kind === 'pad') {
    const pad: PadFootingParams = { ...p, position: { x: 0, y: 0, z: 0 }, rotation: 0, anchor: 'center' };
    params = pad;
  } else {
    const dist = Math.hypot(p.end.x - p.start.x, p.end.y - p.start.y);
    const line: StripFootingParams | TieBeamParams = {
      ...p, start: { x: 0, y: 0, z: 0 }, end: { x: dist, y: 0, z: 0 }, justification: 'center',
    };
    params = line;
  }
  return { ...foundation, params, geometry: computeFoundationGeometry(params) };
}

/** True footing dims (mm) along its canonical axes from the section-context SSoT. */
function planDimsMm(foundation: FoundationEntity): FootingPlanDimsMm {
  const ctx = buildFootingSectionContext(foundation);
  if (ctx.kind === 'pad') return { xMm: ctx.widthMm, yMm: ctx.lengthMm, hMm: ctx.thicknessMm };
  if (ctx.kind === 'strip') return { xMm: ctx.spanMm, yMm: ctx.widthMm, hMm: ctx.thicknessMm };
  return { xMm: ctx.spanMm, yMm: ctx.widthMm, hMm: ctx.depthMm };
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

/** W/L/H dimension specs as measured 3D points (world metres) + value text (mm). */
function dimSpecs(vertsM: readonly Point2D[], dims: FootingPlanDimsMm, heightM: number): {
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
    { a: bl, b: br, text: String(Math.round(dims.xMm)) },
    { a: br, b: tr, text: String(Math.round(dims.yMm)) },
    { a: rightCorner.clone(), b: rightCorner.clone().setY(heightM), text: String(Math.round(dims.hMm)) },
  ];
}

/**
 * Captures the footing reinforcement as an isometric PNG plus the projected
 * W/L/H dimension anchors (normalised raster space), or `null` when there is no
 * buildable cage / degenerate geometry. Disposes every GPU resource it creates.
 */
export function captureFootingDetail3d(
  foundation: FoundationEntity,
  options: FootingDetail3dCaptureOptions,
): FootingDetail3dCapture | null {
  const canonical = canonicalFooting(foundation);
  const cage = buildFootingRebarCage(canonical, 0);
  if (!cage) return null;

  const sceneToM = sceneUnitsToMeters(canonical.params.sceneUnits ?? 'mm');
  const vertsM = scalePoints(canonical.geometry.footprint.vertices, sceneToM);
  const heightM = Math.max(0, canonical.params.thicknessMm) * MM_TO_M;
  const prism = buildConcretePrism(vertsM, heightM);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG_HEX);
  if (prism) scene.add(prism);
  scene.add(cage);

  const { widthPx, heightPx } = options;
  try {
    const box = new THREE.Box3().setFromObject(scene);
    if (box.isEmpty()) return null;
    const camera = frameCamera(box, widthPx / heightPx);
    const dataUrl = renderSceneToDataUrl(scene, camera, widthPx, heightPx);
    if (!dataUrl) return null;

    const dims = dimSpecs(vertsM, planDimsMm(foundation), heightM).map((d) => ({
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
