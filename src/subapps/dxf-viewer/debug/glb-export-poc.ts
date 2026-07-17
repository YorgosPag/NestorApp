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
 * WHY NOT `.c4d`: the Cinema 4D native format is closed and undocumented — the
 * only writer is Maxon's C++ SDK, unreachable from a browser app.
 *
 * WHY OBJ IS THE DEFAULT (measured 2026-07-17): the target machine runs Cinema 4D
 * **R15 (2013)**, and C4D only gained a glTF importer in **R2024**. R15 rejects
 * `.glb` outright ("unknown format") even though our output is a byte-valid glTF
 * 2.0. Intersection of «what R15 imports» ∩ «what three.js exports» = OBJ (and
 * STL, which drops hierarchy entirely). FBX/DAE would preserve materials but
 * three ships no exporter for either. So: OBJ = works today, no materials.
 * Keep the GLB branch — it is the right answer the moment C4D is upgraded.
 *
 * UNITS: no conversion here, deliberately. The Three.js world is already in
 * METRES by construction (`sceneUnitsToMeters`, ADR-462) and glTF's unit is the
 * metre — the two agree. If C4D shows a wrong scale, the bug is upstream in a
 * converter, not in this file. (OBJ is unitless — C4D interprets 1 unit = 1 cm
 * by default, so expect to set the import scale there.)
 *
 * Usage (browser dev console, 3D viewport mounted):
 *   await __nestorExportGlb()                        // OBJ, BIM entities (R15-safe)
 *   await __nestorExportGlb({ format: 'glb' })       // GLB, needs C4D R2024+
 *   await __nestorExportGlb({ scope: 'full-scene' }) // + grid/helpers/lights
 *   __nestorInspect3d()                              // why did only N meshes export?
 *
 * @module subapps/dxf-viewer/debug/glb-export-poc
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { getActiveSceneManager } from '../bim-3d/scene/active-scene-manager-registry';

const logger = createModuleLogger('GLB_EXPORT_POC');

/**
 * `glb` → glTF 2.0 binary. C4D reads it only from R2024+ (2023). Keeps materials.
 * `obj` → Wavefront OBJ. Every C4D since forever reads it, INCLUDING R15 (2013).
 *         Geometry + object names only — three's OBJExporter emits `usemtl`
 *         references but never writes the companion `.mtl`, so materials are lost.
 */
export type GlbPocFormat = 'glb' | 'obj';

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
  /** Output format. Default `'obj'` — the only one C4D R15 can open. */
  readonly format?: GlbPocFormat;
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
  readonly format: GlbPocFormat;
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

function buildFilename(scope: GlbPocScope, format: GlbPocFormat): string {
  const stamp = nowISO().slice(0, 19).replace(/[:T]/g, '-');
  return `nestor-3d-${scope}-${stamp}.${format}`;
}

/** GLB branch — glTF 2.0 binary. Materials survive; needs C4D R2024+. */
async function serialiseGlb(root: THREE.Object3D, onlyVisible: boolean): Promise<Blob> {
  const output = await new GLTFExporter().parseAsync(root, {
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
  return new Blob([output], { type: 'model/gltf-binary' });
}

/**
 * OBJ branch — the lowest common denominator that C4D R15 (2013) still reads.
 * NOTE: three's OBJExporter writes `usemtl` references but no `.mtl` companion,
 * so the geometry arrives in C4D untextured and grey. Known, accepted here.
 * It also ignores `onlyVisible` — the exporter has no such option.
 */
function serialiseObj(root: THREE.Object3D): Blob {
  const text = new OBJExporter().parse(root);
  return new Blob([text], { type: 'model/obj' });
}

/**
 * Serialise the live 3D scene and hand it to the browser. THROWS on failure so
 * the console surfaces the reason instead of silently downloading an empty file.
 */
export async function exportSceneToGlb(options?: GlbPocOptions): Promise<GlbPocResult> {
  const scope = options?.scope ?? 'bim';
  const format = options?.format ?? 'obj';
  const onlyVisible = options?.onlyVisible ?? true;

  const root = resolveExportRoot(scope);
  const meshCount = countMeshes(root, onlyVisible);
  if (meshCount === 0) {
    throw new Error(`GLB_POC_EMPTY: no ${onlyVisible ? 'visible ' : ''}meshes under "${root.name || scope}".`);
  }

  const blob = format === 'glb' ? await serialiseGlb(root, onlyVisible) : serialiseObj(root);
  const filename = options?.filename ?? buildFilename(scope, format);
  triggerExportDownload({ blob, filename });

  const result: GlbPocResult = { filename, bytes: blob.size, meshCount, scope, format };
  logger.info('3D PoC export complete', { ...result });
  return result;
}

// ============================================================================
// SCENE DIAGNOSTIC
// ============================================================================

export interface Scene3dReport {
  /** Total objects in the subtree, whatever their type. */
  readonly totalObjects: number;
  /** Object3D subclass → count (Mesh / Group / Line / LineSegments2 / …). */
  readonly byType: Record<string, number>;
  /** Material class → count. `ShaderMaterial` here = dropped by the GLB exporter. */
  readonly byMaterial: Record<string, number>;
  /** Meshes with `visible === false` — silently skipped when onlyVisible is on. */
  readonly hiddenMeshes: number;
  /** First 40 mesh names, to eyeball what actually made it into the scene. */
  readonly meshNames: readonly string[];
}

function tally(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * Answer «why did only N meshes export?» — walks the subtree and reports what is
 * actually there, by type, by material, and how much is hidden. Read-only.
 */
export function inspect3dScene(scope: GlbPocScope = 'bim'): Scene3dReport {
  const root = resolveExportRoot(scope);
  const byType: Record<string, number> = {};
  const byMaterial: Record<string, number> = {};
  const meshNames: string[] = [];
  let totalObjects = 0;
  let hiddenMeshes = 0;

  root.traverse((child) => {
    totalObjects += 1;
    tally(byType, child.type);
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.visible) hiddenMeshes += 1;
    if (meshNames.length < 40) meshNames.push(child.name || '(unnamed)');
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) tally(byMaterial, mat.type);
  });

  const report: Scene3dReport = { totalObjects, byType, byMaterial, hiddenMeshes, meshNames };
  logger.info('3D scene report', { scope, totalObjects, byType, byMaterial, hiddenMeshes });
  return report;
}

// ============================================================================
// DEV CONSOLE BINDING
// ============================================================================

interface WindowWithGlbPoc {
  __nestorExportGlb?: (options?: GlbPocOptions) => Promise<GlbPocResult>;
  __nestorInspect3d?: (scope?: GlbPocScope) => Scene3dReport;
}

/**
 * Expose the probe on `window` for manual dev-console runs. Mirrors the binding
 * style of `debug/canvas-alignment-test.ts`. Called from the debug barrel; the
 * production export path will never depend on this.
 */
export function registerGlbExportPoc(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as WindowWithGlbPoc;
  w.__nestorExportGlb = exportSceneToGlb;
  w.__nestorInspect3d = inspect3dScene;
  logger.info('3D PoC registered — run __nestorExportGlb() / __nestorInspect3d()');
}
