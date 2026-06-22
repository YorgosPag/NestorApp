/**
 * ============================================================================
 * TEK EXPORT ADAPTER — scene → Tekton .TEK (XML) artifact
 * ============================================================================
 *
 * ADR-507/508. Template-based: φορτώνει τον sanitized v9.1 σκελετό (lazy import,
 * εκτός main bundle) και εγχέει τα δικά μας records στο `<floor>`. Φάση 1 = τοίχοι,
 * ενεργός όροφος. Multi-floor (πολλαπλά `<floor>`) + στατικά = DEFER.
 *
 * `assembleTekDocument` (pure, template ως όρισμα) χωρισμένο από `buildTekDocument`
 * (lazy-loads το 2.3MB skeleton) → unit-testable χωρίς το βαρύ asset.
 */

import type { SceneModel } from '../../types/scene-types';
import { resolveExportEntities } from '../core/export-entity-scope';
import { collectTekWalls, collectTekPlanes, collectTekRoofs } from '../core/tek/bim-to-tek';
import { injectTekEntities } from '../core/tek/tek-xml-writer';
import { buildFloorFilename } from './dxf-export-adapter';
import type { ResolvedExportFloor } from '../core/export-floor-scope';
import type { ExportArtifact, ExportEntityScope } from '../types';

export interface TekExportOptions {
  readonly entityScope: ExportEntityScope;
  /** Base name αρχείου (όνομα έργου). */
  readonly baseName: string;
}

export interface AssembledTek {
  readonly xml: string;
  readonly warnings: string[];
}

/**
 * Pure: φιλτράρει by scope, μαζεύει τοίχους, εγχέει στο `template`. Δοκιμάζεται με
 * fake template (μηδέν εξάρτηση στο βαρύ skeleton asset).
 */
export function assembleTekDocument(
  template: string,
  scene: SceneModel,
  entityScope: ExportEntityScope,
): AssembledTek {
  const selected = resolveExportEntities(scene.entities, entityScope);
  const { wallsXml, warnings } = collectTekWalls(selected);
  const { planesXml } = collectTekPlanes(selected);
  const { autoroofsXml } = collectTekRoofs(selected);
  return { xml: injectTekEntities(template, wallsXml, '', planesXml, autoroofsXml), warnings };
}

/** Φορτώνει lazy τον σκελετό (εκτός main chunk) + assemble. */
export async function buildTekDocument(
  scene: SceneModel,
  entityScope: ExportEntityScope,
): Promise<AssembledTek> {
  const { TEK_SKELETON_TEMPLATE } = await import('../core/tek/tek-skeleton.template');
  return assembleTekDocument(TEK_SKELETON_TEMPLATE, scene, entityScope);
}

/** Εξάγει έναν resolved όροφο σε `.tek` artifact (ένα blob). */
export async function exportFloorToTek(
  floor: ResolvedExportFloor,
  options: TekExportOptions,
): Promise<{ artifact: ExportArtifact; warnings: string[] }> {
  const { xml, warnings } = await buildTekDocument(floor.scene, options.entityScope);
  const filename = buildFloorFilename(options.baseName, floor.level.name, 'tek');
  return {
    artifact: { filename, blob: new Blob([xml], { type: 'application/xml' }) },
    warnings,
  };
}
