/**
 * 🏢 ENTERPRISE: DXF text → DxfImportResult SSoT (ADR-635 Φ3)
 *
 * ONE place that turns raw DXF content into a DxfImportResult: build the scene
 * (diagnostics-carrying), optionally normalize bounds, validate, and package stats +
 * warnings. Replaces the near-identical build/validate/wrap/catch boilerplate that was
 * duplicated across the Web Worker (dxf-parser.worker.ts) and the direct client path
 * (dxf-import.ts). No DOM/browser deps → safe to import from a Worker.
 *
 * @see dxf-scene-builder.ts      - buildSceneWithDiagnostics (fault-tolerant core)
 * @see dxf-import-diagnostics.ts - ImportDiagnostics + summarizeDiagnostics
 */

import type { DxfImportResult } from '../types/scene';
import type { SceneUnits } from './scene-units';
import { DxfSceneBuilder } from './dxf-scene-builder';
import { countSceneLayers } from './scene-entity-count';
import { calculateTightBounds } from './bounds-utils';
import { summarizeDiagnostics } from './dxf-import-diagnostics';

export interface RunDxfParseOptions {
  /**
   * Normalize bounds to the positive quadrant (bottom-left corner → 0,0). The client paths
   * enable this; the Worker leaves it off (the main thread normalizes after transfer).
   */
  normalizeBounds?: boolean;
}

/**
 * Parse DXF content into a DxfImportResult. Never throws — a parse failure becomes
 * `{ success: false, error }`; a partial import returns `success: true` with `warnings`
 * describing what was skipped/clamped.
 */
export function runDxfParse(
  content: string,
  unitsOverride?: SceneUnits,
  options: RunDxfParseOptions = {},
): DxfImportResult {
  const startTime = performance.now();

  try {
    const { scene, diagnostics } = DxfSceneBuilder.buildSceneWithDiagnostics(content, unitsOverride);

    if (options.normalizeBounds && scene.entities.length > 0) {
      // Normalize to positive quadrant: bottom-left corner → (0,0)
      scene.bounds = calculateTightBounds(scene.entities, true);
    }

    if (!DxfSceneBuilder.validateScene(scene)) {
      return {
        success: false,
        error: 'Scene validation failed',
        diagnostics,
        warnings: summarizeDiagnostics(diagnostics),
        stats: { entityCount: 0, layerCount: 0, parseTimeMs: performance.now() - startTime },
      };
    }

    return {
      success: true,
      scene,
      diagnostics,
      warnings: summarizeDiagnostics(diagnostics),
      stats: {
        entityCount: scene.entities.length,
        layerCount: countSceneLayers(scene),
        parseTimeMs: performance.now() - startTime,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `DXF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      stats: { entityCount: 0, layerCount: 0, parseTimeMs: performance.now() - startTime },
    };
  }
}
