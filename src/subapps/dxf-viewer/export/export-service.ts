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
  exportFloorToDxf,
  renderDxfBlob,
  buildDxfExportRequest,
  mergeFloorsToSingleDxfScene,
  buildFloorFilename,
  type DxfExportOptions,
} from './formats/dxf-export-adapter';
import type { ExportArtifact, ExportDeps, ExportRequest, ExportResult } from './types';

export async function runExport(
  request: ExportRequest,
  deps: ExportDeps,
): Promise<ExportResult> {
  switch (request.format) {
    case 'dxf':
      return runDxfExport(request, deps);
    case 'ifc':
    case 'pdf':
      throw new Error(`EXPORT_FORMAT_NOT_READY:${request.format}`);
    default:
      throw new Error(`EXPORT_FORMAT_UNKNOWN`);
  }
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
  };

  // all-single → one merged DXF across every floor.
  if (request.floorScope === 'all-single') {
    const merged = mergeFloorsToSingleDxfScene(floors, request.entityScope, request.dxfLineMode);
    const { request: dxfReq, warnings } = buildDxfExportRequest(merged.scene, dxfOptions);
    const blob = renderDxfBlob(dxfReq, request.dxfLineMode);
    const finalName = buildFloorFilename(deps.projectName, 'all-floors', 'dxf');
    triggerExportDownload({ blob, filename: finalName });
    return { filename: finalName, fileCount: 1, warnings: [...merged.warnings, ...warnings] };
  }

  // active / all-zip → one artifact per floor.
  const warnings: string[] = [];
  const artifacts: ExportArtifact[] = [];
  for (const floor of floors) {
    const out = exportFloorToDxf(floor, dxfOptions);
    artifacts.push(out.artifact);
    warnings.push(...out.warnings);
  }

  if (artifacts.length === 1) {
    triggerExportDownload({ blob: artifacts[0].blob, filename: artifacts[0].filename });
    return { filename: artifacts[0].filename, fileCount: 1, warnings };
  }

  // Multiple floors → zip.
  const zipFiles: ZipFile[] = await Promise.all(
    artifacts.map(async (a) => ({ name: a.filename, data: await blobToUint8(a.blob) })),
  );
  const zipBlob = createStoredZip(zipFiles);
  const zipName = buildFloorFilename(deps.projectName, 'floors', 'zip');
  triggerExportDownload({ blob: zipBlob, filename: zipName });
  return { filename: zipName, fileCount: artifacts.length, warnings };
}
