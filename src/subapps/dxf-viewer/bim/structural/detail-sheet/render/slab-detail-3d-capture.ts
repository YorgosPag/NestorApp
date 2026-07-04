/**
 * ADR-476 — Slab Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar mesh cage) of a slab to a paper-resolution PNG, AND projects the W/L/H
 * dimension anchors through the SAME camera into normalised raster space — οι 3Δ
 * annotations μοιράζονται το ΙΔΙΟ dimension SSoT με την κάτοψη/τομή. Mirror του
 * `footing-detail-3d-capture.ts`, reusing the shared `detail-3d-capture-core`
 * scaffolding (camera / prism / render / dispose).
 *
 * geometry-is-SSoT: ο κλωβός από `buildSlabRebarCage` (ίδιες σχάρες με το live 3Δ),
 * prism + dims από τα `outline.vertices` (absolute metre coords) + το section-context.
 * Η πλάκα ΔΕΝ έχει rotation/anchor (το outline ΕΙΝΑΙ η γεωμετρία) → καμία
 * canonicalization· το bbox είναι ήδη axis-aligned ⇒ ορθογραφικές διαστάσεις.
 *
 * 🚨 dispose gotcha (ADR-457): dispose ΜΟΝΟ τη geometry του cage (το `REBAR_MATERIAL`
 * είναι shared singleton)· dispose πλήρως τον prism. ADR-040: fully offscreen.
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/render/slab-detail-3d-capture
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import * as THREE from 'three';
import { finiteBox3FromObject } from '../../../../bim-3d/scene/finite-bounds';
import type { SlabEntity } from '../../../types/slab-types';
import type { Point2D } from '../../../../rendering/types/Types';
import { buildSlabFoundationSectionContext } from '../../section-context';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildSlabRebarCage } from '../../../../bim-3d/converters/slab-rebar-3d';
import type { ColumnDetail3dCapture } from './column-detail-3d-capture';
import {
  MM_TO_M, SCENE_BG_HEX, CAMERA_AZIMUTH_RAD,
  buildConcretePrism, disposeOwned, disposeCageGeometry, frameCamera, projectNorm,
  renderSceneToDataUrl,
} from './detail-3d-capture-core';

/** Re-export: the capture shape is generic (raster + projected annotations). */
export type SlabDetail3dCapture = ColumnDetail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface SlabDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

/** World direction that projects to screen-right in the iso view (camera-right). */
const SCREEN_RIGHT = new THREE.Vector3(Math.cos(CAMERA_AZIMUTH_RAD), 0, -Math.sin(CAMERA_AZIMUTH_RAD)).normalize();

/** Plan dims (mm) of the slab along its axes + height (thickness). */
interface SlabPlanDimsMm { xMm: number; yMm: number; hMm: number; }

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
function dimSpecs(vertsM: readonly Point2D[], dims: SlabPlanDimsMm, heightM: number): {
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
 * Captures the slab reinforcement as an isometric PNG plus the projected W/L/H
 * dimension anchors (normalised raster space), or `null` when there is no
 * buildable cage / degenerate geometry. Disposes every GPU resource it creates.
 */
export function captureSlabDetail3d(
  slab: SlabEntity,
  options: SlabDetail3dCaptureOptions,
): SlabDetail3dCapture | null {
  const cage = buildSlabRebarCage(slab, 0);
  if (!cage) return null;

  const sceneToM = sceneUnitsToMeters(slab.params.sceneUnits ?? 'mm');
  const vertsM = scalePoints(slab.params.outline.vertices, sceneToM);
  const heightM = Math.max(0, slab.params.thickness) * MM_TO_M;
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

    const ctx = buildSlabFoundationSectionContext(slab);
    const planDims: SlabPlanDimsMm = { xMm: ctx.widthMm, yMm: ctx.lengthMm, hMm: ctx.thicknessMm };
    const dims = dimSpecs(vertsM, planDims, heightM).map((d) => ({
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
