/**
 * ADR-453 — Print/Export engine · facade (SSoT orchestrator).
 *
 * Orchestrates capture → assemble → output. Both 2D and 3D sources converge on
 * the SAME assembler (`assemblePrintPdf`) and the SAME output primitives
 * (`triggerExportDownload` / `openBlobInNewTab`), which is the SSoT guarantee.
 *
 * @module subapps/dxf-viewer/print/print-service
 */

import { createModuleLogger } from '@/lib/telemetry';
import { triggerExportDownload, openBlobInNewTab } from '@/lib/exports/trigger-export-download';
import type { SceneModel } from '../types/entities';
import type { SceneUnits } from '../utils/scene-units';
import type { PrintRequest, RasterTargetPx } from './config/paper-types';
import { EXPORT_DPI, DEFAULT_PAGE_MARGIN_MM } from './config/paper-constants';
import { computePaperRasterPx } from './config/paper-math';
import type { CaptureResult } from './capture/capture-types';
import { captureCurrent2dView } from './capture/capture-2d';
import { captureCurrent2dViewVector } from './capture/capture-2d-vector';
import { assemblePrintPdf } from './assemble/pdf-assembler';
import type { TitleBlockContent, TitleBlockInput } from './assemble/title-block-types';
import { buildPrintFilename } from './print-filename';

const logger = createModuleLogger('DXF_PRINT');

export interface PrintDeps {
  /** Active 2D scene (required for source='2d'). */
  scene: SceneModel | null;
  userDrawingUnits?: SceneUnits;
  /** Project/drawing name for the filename + (Slice 4) title block. */
  projectName: string;
  /** Injected ISO date string (nowISO().slice(0,10)) — keeps the service pure. */
  dateStr: string;
  /**
   * Slice 3 — 3D snapshot provider, wired by PrintHost when a 3D scene is
   * mounted. Decouples this service from Three.js.
   */
  capture3d?: (raster: RasterTargetPx) => Promise<CaptureResult>;
  /** Slice 4 — title block project name + translated labels (from PrintHost). */
  titleBlock?: TitleBlockInput;
}

/** Compose the render-ready title block from request + capture (or undefined). */
function buildTitleBlock(
  request: PrintRequest,
  deps: PrintDeps,
  capture: CaptureResult,
): TitleBlockContent | undefined {
  if (!request.includeTitleBlock || !deps.titleBlock) return undefined;
  const { project, labels } = deps.titleBlock;
  const scaleText = capture.appliedScaleDenominator
    ? `1:${capture.appliedScaleDenominator}`
    : '—';
  return {
    heading: project,
    fields: [
      { label: labels.scale, value: scaleText },
      { label: labels.date, value: deps.dateStr },
      { label: labels.sheet, value: `${request.paper.size} · ${request.paper.orientation}` },
    ],
  };
}

/** Route to the correct capture adapter by source. */
async function captureSource(
  request: PrintRequest,
  deps: PrintDeps,
  raster: RasterTargetPx,
): Promise<CaptureResult> {
  if (request.source === '3d') {
    if (!deps.capture3d) {
      throw new Error('3D capture provider unavailable');
    }
    // 3D has no vector representation (real materials/shading) → always raster.
    return deps.capture3d(raster);
  }
  const capture2dInput = {
    scene: deps.scene,
    userDrawingUnits: deps.userDrawingUnits,
    raster,
    fitMode: request.fitMode,
    scaleDenominator: request.scaleDenominator,
    plotStyle: request.plotStyle,
  };
  // ADR-608 — vector is the 2D default (selectable entities, zoom-safe); raster
  // fallback stays byte-for-byte the previous behaviour.
  return request.outputMode === 'raster'
    ? captureCurrent2dView(capture2dInput)
    : captureCurrent2dViewVector(capture2dInput);
}

/** Route the assembled blob to download or OS print dialog. */
function routeOutput(blob: Blob, request: PrintRequest, deps: PrintDeps): void {
  if (request.target === 'open-print') {
    openBlobInNewTab(blob, { onLoad: (w) => w.print() });
    return;
  }
  triggerExportDownload({
    blob,
    filename: buildPrintFilename(deps.projectName, request.paper.size, deps.dateStr),
  });
}

/**
 * Run a full print job. Throws on capture/assembly failure so the dialog can
 * surface an error to the user.
 */
export async function runPrint(request: PrintRequest, deps: PrintDeps): Promise<void> {
  const marginMm = DEFAULT_PAGE_MARGIN_MM;
  const raster = computePaperRasterPx(request.paper, EXPORT_DPI, marginMm);
  const capture = await captureSource(request, deps, raster);
  const blob = await assemblePrintPdf({
    capture,
    paper: request.paper,
    marginMm,
    includeTitleBlock: request.includeTitleBlock,
    titleBlock: buildTitleBlock(request, deps, capture),
    scaleText: capture.appliedScaleDenominator ? `1:${capture.appliedScaleDenominator}` : null,
  });
  routeOutput(blob, request, deps);
  logger.info('Print job completed', {
    source: request.source,
    paper: `${request.paper.size}/${request.paper.orientation}`,
    fitMode: request.fitMode,
    target: request.target,
  });
}
