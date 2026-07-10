/**
 * ADR-463 — Footing Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar cage) of a footing to a paper-resolution PNG, AND projects the W/L/H
 * dimension anchors through the SAME camera into normalised raster space. The
 * perspective region then draws those projections as ordinary 2D `dim` primitives
 * → the 3D annotations share the EXACT dimension SSoT with the plan/section views.
 * Mirror του `column-detail-3d-capture.ts`, reusing the shared
 * `detail-3d-capture-core` scaffolding (camera / prism / bbox dims / capture flow).
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

import type {
  FoundationEntity,
  FoundationParams,
  PadFootingParams,
  StripFootingParams,
  TieBeamParams,
} from '../../../types/foundation-types';
import { computeFoundationGeometry } from '../../../geometry/foundation-geometry';
import { buildFootingSectionContext } from '../../section-context';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildFootingRebarCage } from '../../../../bim-3d/converters/footing-rebar-3d';
import type { ColumnDetail3dCapture } from './column-detail-3d-capture';
import {
  MM_TO_M,
  bboxDimSpecs,
  buildConcretePrism,
  captureDetail3d,
  projectDims,
} from './detail-3d-capture-core';

/** Re-export: the capture shape is generic (raster + projected annotations). */
export type FootingDetail3dCapture = ColumnDetail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface FootingDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
}

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
  const dims = planDimsMm(foundation);

  return captureDetail3d(
    { cage, prism: buildConcretePrism(vertsM, heightM) },
    options.widthPx,
    options.heightPx,
    (camera) => ({
      dims: projectDims(bboxDimSpecs(vertsM, { x: dims.xMm, y: dims.yMm, h: dims.hMm }, heightM), camera),
      marks: [],
    }),
  );
}
