/**
 * ============================================================================
 * GLB EXPORT — PROOF OF CONCEPT (Cinema 4D interop probe)
 * ============================================================================
 *
 * Throwaway probe answering ONE question: does Cinema 4D ingest a GLB produced
 * from our live Three.js scene cleanly (geometry, hierarchy, materials, scale)?
 *
 * NOT the real export path. The production implementation belongs in
 * `export/formats/gltf-export-adapter.ts` behind the `ExportFormat` union
 * (ADR-505 §C), routed through `runExport()` like DXF/TEK. This file exists so
 * we can validate the C4D round-trip BEFORE committing to that design.
 *
 * WHY GLB and not `.c4d`: the Cinema 4D native format is closed and undocumented
 * — the only writer is Maxon's C++ SDK, unreachable from a browser app. glTF 2.0
 * is C4D's native import path (R2024+ reads `.glb` with materials).
 *
 * UNITS: no conversion here, deliberately. The Three.js world is already in
 * METRES by construction (`sceneUnitsToMeters`, ADR-462) and glTF's unit is the
 * metre — the two agree. If C4D shows a wrong scale, the bug is upstream in a
 * converter, not in this file.
 *
 * Usage (browser dev console, 3D viewport mounted):
 *   await __nestorExportGlb()                      // BIM entities only
 *   await __nestorExportGlb({ scope: 'full-scene' }) // + grid/helpers/lights
 *
 * @module subapps/dxf-viewer/debug/glb-export-poc
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { getActiveSceneManager } from '../bim-3d/scene/active-scene-manager-registry';

const logger = createModuleLogger('GLB_EXPORT_POC');

/**
 * `bim`        → only the `bim-entities` group (walls/slabs/stairs/…). What you
 *                actually want in C4D.
 * `full-scene` → the whole THREE.Scene, including ground grid, lights and
 *                helpers. Diagnostic only — expect junk objects in C4D.
 */
export type GlbPocScope = 'bim' | 'full-scene';

export interface GlbPocOptions {
  /** Which subtree to serialise. Default `'bim'`. */
  readonly scope?: GlbPocScope;
  /** Skip `visible === false` objects. Default `true` (export what you see). */
  readonly onlyVisible?: boolean;
  /** Override the generated filename (extension included). */
  readonly filename?: string;
}

export interface GlbPocResult {
  readonly filename: string;
  readonly bytes: number;
  readonly meshCount: number;
  readonly scope: GlbPocScope;
}

/** Resolve the subtree to export, or throw with an actionable reason. */
function resolveExportRoot(scope: GlbPocScope): THREE.Object3D {
  const manager = getActiveSceneManager();
  if (!manager) {
    throw new Error('GLB_POC_NO_ACTIVE_SCENE: the 3D viewport is not mounted — switch to the 3D view first.');
  }
  return scope === 'full-scene' ? manager.scene : manager.bimLayer.group;
}

/** Count meshes in a subtree — sanity signal that we are not exporting an empty group. */
function countMeshes(root: THREE.Object3D, onlyVisible: boolean): number {
  let meshes = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (onlyVisible && !child.visible) return;
    meshes += 1;
  });
  return meshes;
}

function buildFilename(scope: GlbPocScope): string {
  const stamp = nowISO().slice(0, 19).replace(/[:T]/g, '-');
  return `nestor-3d-${scope}-${stamp}.glb`;
}

/**
 * Serialise the live 3D scene to a binary GLB and hand it to the browser.
 * THROWS on failure so the console surfaces the reason instead of silently
 * downloading an empty file.
 */
export async function exportSceneToGlb(options?: GlbPocOptions): Promise<GlbPocResult> {
  const scope = options?.scope ?? 'bim';
  const onlyVisible = options?.onlyVisible ?? true;

  const root = resolveExportRoot(scope);
  const meshCount = countMeshes(root, onlyVisible);
  if (meshCount === 0) {
    throw new Error(`GLB_POC_EMPTY: no ${onlyVisible ? 'visible ' : ''}meshes under "${root.name || scope}".`);
  }

  const exporter = new GLTFExporter();
  const output = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible,
    // TRS nodes instead of baked matrices — C4D's Object Manager shows readable
    // position/rotation/scale per object rather than an opaque matrix.
    trs: true,
    embedImages: true,
  });

  // `parseAsync` widens to `ArrayBuffer | JSON`; `binary: true` guarantees the
  // buffer. Narrow via instanceof rather than a cast (no `as`, no `any`).
  if (!(output instanceof ArrayBuffer)) {
    throw new Error('GLB_POC_UNEXPECTED_JSON: exporter returned JSON despite binary:true.');
  }

  const filename = options?.filename ?? buildFilename(scope);
  const blob = new Blob([output], { type: 'model/gltf-binary' });
  triggerExportDownload({ blob, filename });

  const result: GlbPocResult = { filename, bytes: blob.size, meshCount, scope };
  logger.info('GLB PoC export complete', { ...result });
  return result;
}

// ============================================================================
// DEV CONSOLE BINDING
// ============================================================================

interface WindowWithGlbPoc {
  __nestorExportGlb?: (options?: GlbPocOptions) => Promise<GlbPocResult>;
}

/**
 * Expose the probe on `window` for manual dev-console runs. Mirrors the binding
 * style of `debug/canvas-alignment-test.ts`. Called from the debug barrel; the
 * production export path will never depend on this.
 */
export function registerGlbExportPoc(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as WindowWithGlbPoc).__nestorExportGlb = exportSceneToGlb;
  logger.info('GLB PoC registered — run __nestorExportGlb() in the console');
}
