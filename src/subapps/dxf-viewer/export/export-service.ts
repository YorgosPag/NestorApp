/**
 * ============================================================================
 * EXPORT SERVICE — unified facade (orchestrator)
 * ============================================================================
 *
 * `runExport(request, deps)` routes a finished `ExportRequest` to the right
 * format adapter, packages multi-floor output, and triggers the browser
 * download. Pure orchestration over injected deps; THROWS on failure so the
 * dialog can surface the message (mirror of `print/print-service.ts`, ADR-453).
 *
 * Floor handling (DXF):
 *   active      → 1 floor      → 1 `.dxf`
 *   all-zip     → N floors     → N `.dxf` in a `.zip`
 *   all-single  → N floors     → 1 merged `.dxf` (FLnn_ layer prefixes)
 *
 * IFC / PDF adapters arrive in later slices.
 *
 * ADR-505 §C.
 */

import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { resolveExportFloors } from './core/export-floor-scope';
import { createStoredZip, blobToUint8, type ZipFile } from './core/zip-pack';
import {
  renderDxfBlob,
  buildDxfExportRequest,
  mergeFloorsToSingleDxfScene,
  buildFloorFilename,
  type DxfExportOptions,
} from './formats/dxf-export-adapter';
import { resolveImageFillsForDxf } from './core/image-fill-export';
// ADR-651 Φάση Ε — δεύτερος async pre-pass (ImageEntity, «γυμνή» εικόνα)· τρέχει ΜΕΤΑ το hatch
// image-fill pre-pass ώστε να συνθέτονται (κάθε ένα αγγίζει μόνο το δικό του entity type — μηδέν
// αλληλοεπικάλυψη marker).
import { resolveImageEntitiesForDxf } from './core/image-entity-export';
import { exportFloorToTek, type TekExportOptions } from './formats/tek-export-adapter';
import { useDrawingScaleStore } from '../state/drawing-scale-store';
import type { DxfExportSceneRequest } from '../types/dxf-export.types';
import type {
  DxfImageFillMode, DxfLineMode, ExportArtifact, ExportDeps, ExportRequest, ExportResult,
} from './types';

export async function runExport(
  request: ExportRequest,
  deps: ExportDeps,
): Promise<ExportResult> {
  switch (request.format) {
    case 'dxf':
      return runDxfExport(request, deps);
    case 'tek':
      return runTekExport(request, deps);
    case 'ifc':
    case 'pdf':
      throw new Error(`EXPORT_FORMAT_NOT_READY:${request.format}`);
    default:
      throw new Error(`EXPORT_FORMAT_UNKNOWN`);
  }
}

/**
 * Tekton `.TEK` (XML) export — ΑΡΧΙΤΕΚΤΟΝΙΚΑ (φάση 1: τοίχοι). Ένα `.tek` ανά όροφο
 * (active → 1 αρχείο· πολλοί → zip). Ενοποίηση ορόφων (`all-single`) = DEFER.
 */
async function runTekExport(
  request: ExportRequest,
  deps: ExportDeps,
): Promise<ExportResult> {
  const floors = resolveExportFloors(deps.levelScenes, deps.activeLevelId, request.floorScope);
  const opts: TekExportOptions = {
    entityScope: request.entityScope,
    baseName: deps.projectName,
    // ADR-583/608 — live annotation scale so exported symbols keep their printed size.
    drawingScale: useDrawingScaleStore.getState().drawingScale,
    // ADR-608 — native Tekton objects vs αυτούσια γεωμετρία (default native στον adapter).
    symbolMode: request.tekSymbolMode,
    // ADR-648 Στάδιο Ε — native μοτίβο (ελαφρύ) vs αποδομημένες γραμμές (πλήρης ταύτιση).
    hatchMode: request.tekHatchMode,
  };
  const warnings: string[] = [];
  if (request.floorScope === 'all-single') {
    warnings.push('TEK: ενοποίηση ορόφων σε ένα αρχείο δεν υποστηρίζεται ακόμη — ένα .tek ανά όροφο.');
  }

  const artifacts: ExportArtifact[] = [];
  for (const floor of floors) {
    const out = await exportFloorToTek(floor, opts);
    artifacts.push(out.artifact);
    warnings.push(...out.warnings);
  }

  return packageArtifacts(artifacts, deps, warnings);
}

/**
 * Deliver per-floor artifacts: a single one downloads directly; several pack into
 * one `.zip`. Shared by every multi-floor format path (DXF/TEK) so the pack/
 * download logic lives in ONE place (N.18 anti-clone).
 */
async function packageArtifacts(
  artifacts: ExportArtifact[],
  deps: ExportDeps,
  warnings: string[],
): Promise<ExportResult> {
  if (artifacts.length === 1) {
    triggerExportDownload({ blob: artifacts[0].blob, filename: artifacts[0].filename });
    return { filename: artifacts[0].filename, fileCount: 1, warnings };
  }

  const zipFiles: ZipFile[] = await Promise.all(
    artifacts.map(async (a) => ({ name: a.filename, data: await blobToUint8(a.blob) })),
  );
  const zipBlob = createStoredZip(zipFiles);
  const zipName = buildFloorFilename(deps.projectName, 'floors', 'zip');
  triggerExportDownload({ blob: zipBlob, filename: zipName });
  return { filename: zipName, fileCount: artifacts.length, warnings };
}

async function runDxfExport(
  request: ExportRequest,
  deps: ExportDeps,
): Promise<ExportResult> {
  const floors = resolveExportFloors(deps.levelScenes, deps.activeLevelId, request.floorScope);
  const dxfOptions: DxfExportOptions = {
    entityScope: request.entityScope,
    version: request.dxfVersion,
    unit: request.dxfUnit,
    lineMode: request.dxfLineMode,
    baseName: deps.projectName,
    // ADR-583/608 — live annotation scale so exported symbols keep their printed size.
    drawingScale: useDrawingScaleStore.getState().drawingScale,
  };
  // ADR-643 Φ5b — image-fill hatch export mode (solid-downgrade default / faithful IMAGE + zip raster).
  const imageMode: DxfImageFillMode = request.dxfImageFillMode ?? 'solid';

  // all-single → one merged DXF across every floor.
  if (request.floorScope === 'all-single') {
    const merged = mergeFloorsToSingleDxfScene(floors, request.entityScope, request.dxfLineMode);
    const { request: dxfReq, warnings } = buildDxfExportRequest(merged.scene, dxfOptions);
    const rendered = await renderDxfWithImages(dxfReq, request.dxfLineMode, imageMode);
    const finalName = buildFloorFilename(deps.projectName, 'all-floors', 'dxf');
    const allWarnings = [...merged.warnings, ...warnings, ...rendered.warnings];
    return packageDxfArtifacts(
      [{ filename: finalName, blob: rendered.blob }], rendered.rasters, deps, allWarnings, finalName,
    );
  }

  // active / all-zip → one artifact per floor.
  const warnings: string[] = [];
  const artifacts: ExportArtifact[] = [];
  const rasters: ExportArtifact[] = [];
  for (const floor of floors) {
    const { request: dxfReq, warnings: buildWarnings } = buildDxfExportRequest(floor.scene, dxfOptions);
    const rendered = await renderDxfWithImages(dxfReq, request.dxfLineMode, imageMode);
    artifacts.push({ filename: buildFloorFilename(deps.projectName, floor.level.name, 'dxf'), blob: rendered.blob });
    warnings.push(...buildWarnings, ...rendered.warnings);
    rasters.push(...rendered.rasters);
  }

  return packageDxfArtifacts(artifacts, rasters, deps, warnings);
}

/**
 * ADR-643 Φ5b / ADR-651 Φάση Ε — render a built DXF request, running BOTH async image pre-passes
 * first (composed sequentially — each only touches its own entity type, so neither drops the
 * other's markers): hatch image-fills become either a solid downgrade (avg colour) or tiled
 * `IMAGE`+`IMAGEDEF` markers; `ImageEntity` instances get a `dxfImageExport` marker (or pass
 * through unchanged on decode/fetch failure — silently skipped by the writer). Rasters from both
 * passes are deduped together into ONE list. Pure `renderDxfBlob` stays untouched — it serializes
 * whatever markers were stamped here.
 */
async function renderDxfWithImages(
  request: DxfExportSceneRequest, lineMode: DxfLineMode | undefined, mode: DxfImageFillMode,
): Promise<{ blob: Blob; rasters: ExportArtifact[]; warnings: string[] }> {
  const fillResolved = await resolveImageFillsForDxf(request.scene.entities, mode);
  const imgResolved = await resolveImageEntitiesForDxf(fillResolved.entities);
  const req2: DxfExportSceneRequest = { ...request, scene: { ...request.scene, entities: imgResolved.entities } };
  const rasters = dedupeByFilename([...fillResolved.rasters, ...imgResolved.rasters]);
  return {
    blob: renderDxfBlob(req2, lineMode),
    rasters,
    warnings: [...fillResolved.warnings, ...imgResolved.warnings],
  };
}

/**
 * ADR-643 Φ5b — deliver DXF artifacts, bundling any image-fill rasters. Zero rasters → historic
 * path (single `.dxf` download, or a floors `.zip` for multi-floor). With rasters, EVERYTHING goes
 * into ONE `.zip` (the `.dxf`(s) at root + deduped `images/*` at relative paths the IMAGEDEFs
 * reference) — AutoCAD eTransmit standard, opens with the images resolved.
 */
async function packageDxfArtifacts(
  artifacts: ExportArtifact[], rasters: ExportArtifact[], deps: ExportDeps, warnings: string[],
  singleName?: string,
): Promise<ExportResult> {
  if (rasters.length === 0) {
    if (singleName && artifacts.length === 1) {
      triggerExportDownload({ blob: artifacts[0].blob, filename: singleName });
      return { filename: singleName, fileCount: 1, warnings };
    }
    return packageArtifacts(artifacts, deps, warnings);
  }
  const deduped = dedupeByFilename(rasters);
  const files: ZipFile[] = [];
  for (const a of artifacts) files.push({ name: a.filename, data: await blobToUint8(a.blob) });
  for (const r of deduped) files.push({ name: r.filename, data: await blobToUint8(r.blob) });
  const zipName = buildFloorFilename(deps.projectName, 'dxf', 'zip');
  triggerExportDownload({ blob: createStoredZip(files), filename: zipName });
  return { filename: zipName, fileCount: files.length, warnings };
}

/** Keep the first artifact per filename (same material reused across floors → ONE bundled file). */
function dedupeByFilename(artifacts: readonly ExportArtifact[]): ExportArtifact[] {
  const byName = new Map<string, ExportArtifact>();
  for (const a of artifacts) if (!byName.has(a.filename)) byName.set(a.filename, a);
  return [...byName.values()];
}
