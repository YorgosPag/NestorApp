/**
 * ADR-476 — Slab Reinforcement Detail Sheet · 3D perspective capture.
 *
 * Renders a SELF-CONTAINED offscreen mini-scene (faint concrete prism + crimson
 * rebar mesh cage) of a slab to a paper-resolution PNG, AND projects the W/L/H
 * dimension anchors through the SAME camera into normalised raster space — οι 3Δ
 * annotations μοιράζονται το ΙΔΙΟ dimension SSoT με την κάτοψη/τομή. Mirror του
 * `footing-detail-3d-capture.ts`, reusing the shared `detail-3d-capture-core`
 * scaffolding (camera / prism / bbox dims / capture flow).
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

import type { SlabEntity } from '../../../types/slab-types';
import { buildSlabFoundationSectionContext } from '../../section-context';
import { sceneUnitsToMeters } from '../../../../utils/scene-units';
import { scalePoints } from '../../../../rendering/entities/shared/geometry-vector-utils';
import { buildSlabRebarCage } from '../../../../bim-3d/converters/slab-rebar-3d';
import type { ColumnDetail3dCapture } from './column-detail-3d-capture';
import {
  MM_TO_M,
  bboxDimSpecs,
  buildConcretePrism,
  captureDetail3d,
  projectDims,
} from './detail-3d-capture-core';

/** Re-export: the capture shape is generic (raster + projected annotations). */
export type SlabDetail3dCapture = ColumnDetail3dCapture;

/** Options controlling the offscreen raster resolution. */
export interface SlabDetail3dCaptureOptions {
  readonly widthPx: number;
  readonly heightPx: number;
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
  const ctx = buildSlabFoundationSectionContext(slab);

  return captureDetail3d(
    { cage, prism: buildConcretePrism(vertsM, heightM) },
    options.widthPx,
    options.heightPx,
    (camera) => ({
      dims: projectDims(
        bboxDimSpecs(vertsM, { x: ctx.widthMm, y: ctx.lengthMm, h: ctx.thicknessMm }, heightM),
        camera,
      ),
      marks: [],
    }),
  );
}
