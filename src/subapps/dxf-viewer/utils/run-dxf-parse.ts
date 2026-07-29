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
import { normalizeEntitiesToOrigin } from './bounds-utils';
import { summarizeDiagnostics } from './dxf-import-diagnostics';
// ADR-635 Φ C.23 — διαγνώσιμη επικύρωση σκηνής (ποια συνθήκη έπεσε, σε ποια οντότητα).
import { validateSceneModel, describeSceneValidationFailure } from './scene-validation';

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
      // Normalize to positive quadrant: bottom-left corner → (0,0). ADR-650 §M10e: the applied
      // offset is the drawing's own world origin — keep it (`sourceOrigin`) instead of dropping
      // it, so the geo-reference can be restored analytically instead of guessed.
      const normalized = normalizeEntitiesToOrigin(scene.entities);
      scene.bounds = normalized.bounds;
      scene.sourceOrigin = normalized.sourceOrigin;
    }

    // ADR-635 Φ C.23 — η επικύρωση λέει **ΓΙΑΤΙ** απέτυχε. Το πόρισμα ταξιδεύει ΚΑΙ στο
    // `error` (κονσόλα/clipboard του χρήστη) ΚΑΙ στα `warnings` (ορατό στο toast), γιατί μια
    // αποτυχία εισαγωγής χωρίς αιτία κοστίζει μια ολόκληρη συνεδρία εικασιών.
    const validation = validateSceneModel(scene);
    if (!validation.valid) {
      const reason = describeSceneValidationFailure(validation.failure);
      return {
        success: false,
        error: `Scene validation failed: ${reason}`,
        diagnostics,
        warnings: [...summarizeDiagnostics(diagnostics), `Scene validation failed: ${reason}`],
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
