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
import { sceneUnitsToMeters, resolveSceneUnits } from '../../utils/scene-units';
import { DEFAULT_DRAWING_SCALE } from '../../config/bim-render-settings-types';
import { resolveExportEntities } from '../core/export-entity-scope';
import { expandAnnotationsToPrimitives } from '../core/annotation-to-primitives';
import { collectTekWalls, collectTekPlanes, collectTekRoofs, collectTekStairs } from '../core/tek/bim-to-tek';
import {
  collectTekLines, collectTekArcs, collectTekObjects, collectTekHatches,
  collectTekAreas,
} from '../core/tek/dxf-to-tek';
import { collectTekTexts } from '../core/tek/dxf-to-tek-texts';
import { collectTekHatchFillLines } from '../core/tek/tek-hatch-explode';
import { injectTekEntities, buildTagVisibilityXml } from '../core/tek/tek-xml-writer';
import type { TekSymbolMode } from '../types';
import { buildFloorFilename } from './dxf-export-adapter';
import type { ResolvedExportFloor } from '../core/export-floor-scope';
import type { ExportArtifact, ExportEntityScope } from '../types';

export interface TekExportOptions {
  readonly entityScope: ExportEntityScope;
  /** Base name αρχείου (όνομα έργου). */
  readonly baseName: string;
  /**
   * ADR-583/608 — annotation-scale denominator (1:N) για annotative συμβόλων/scale-bar
   * κατά την αποδόμηση σε Tekton primitives. Το δίνει το export service (live
   * `drawingScale` SSoT) ώστε ο assembler να μένει pure. Default `DEFAULT_DRAWING_SCALE`.
   */
  readonly drawingScale?: number;
  /**
   * ADR-608 — πώς μεταφέρονται τα annotation symbols: `'native'` (built-in Tekton
   * type-7 objects, ενιαίο πακέτο) ή `'geometry'` (αυτούσια γεωμετρία + tags).
   * Default `'native'`.
   */
  readonly symbolMode?: TekSymbolMode;
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
  drawingScale: number = DEFAULT_DRAWING_SCALE,
  symbolMode: TekSymbolMode = 'native',
): AssembledTek {
  const selected = resolveExportEntities(scene.entities, entityScope);
  const f = sceneUnitsToMeters(scene.units);
  // ADR-608 «native» — σύμβολα με built-in Tekton equivalent → ΕΝΑ type-7 `<object>`
  // (ενιαίο πακέτο). Τα `consumedIds` εξαιρούνται από την αποδόμηση παρακάτω ώστε να ΜΗΝ
  // βγουν και ως γεωμετρία. «geometry» mode → κανένα object (όλα ως αυτούσια γεωμετρία).
  const objects = symbolMode === 'native'
    ? collectTekObjects(selected, f)
    : { objectsXml: '', consumedIds: new Set<string>() as ReadonlySet<string> };
  const forDecompose = objects.consumedIds.size
    ? selected.filter((e) => !objects.consumedIds.has(e.id))
    : selected;
  // ADR-583/608 — explode annotation symbols + scale-bars into neutral primitives
  // (lines/lwpolylines/circles/arcs) so `collectTekLines`/`collectTekArcs` pick them up.
  // Solid fills → outline (Φ-fill follow-up)· baked labels → `<text>` (type 3, Φ-texts). BIM passes through.
  const decomposed = expandAnnotationsToPrimitives(forDecompose, {
    drawingScale,
    sceneUnits: resolveSceneUnits({ units: scene.units }),
  });
  const { wallsXml, warnings } = collectTekWalls(decomposed);
  const { planesXml } = collectTekPlanes(decomposed);
  const { autoroofsXml } = collectTekRoofs(decomposed);
  const lines = collectTekLines(decomposed, f);
  const arcs = collectTekArcs(decomposed, f);
  // ADR-608 Φ-texts — ελεύθερες ετικέτες (N/A/1/0.00 + scale-bar νούμερα) → `<text>` (type 3).
  const texts = collectTekTexts(decomposed, f);
  // ADR-648 Στάδιο Ε — ΠΛΗΡΗΣ ΤΑΥΤΙΣΗ: οι γραμμοσκιάσεις αποδομούνται στις ΑΚΡΙΒΕΙΣ γραμμές
  // τους (SSoT `buildHatchEntitySegments` — ίδιες με canvas + DXF lines-mode) και μπαίνουν στον
  // `<line>` container, συνεχίζοντας την αρίθμηση `<n>` μετά τα κανονικά lines. Το native
  // `<hatch>` του Τέκτονα δείχνει ΑΛΛΟ μοτίβο (άλλη βιβλιοθήκη) — μετρημένο: 15.318 γραμμές
  // AutoCAD `SQUARE` → 43 διαγώνιες στον Τέκτονα.
  const hatchFill = collectTekHatchFillLines(decomposed, f, lines.lineCount + 1);
  // ADR-512 — fallback: όσες ΔΕΝ αποδομήθηκαν (solid/gradient, ή dense-guard) → native `<hatch>`
  // (primitive type 6) με ταυτοποίηση μοτίβου by-name (data/tekton-hatch-catalog).
  const hatches = collectTekHatches(decomposed, f, hatchFill.explodedIds);
  // ADR-512 Φ-areas — μετρήσεις εμβαδού (measure-area → closed polyline+measurement) → native
  // Tekton area: ΕΝΑ `<hatch>` (boundary=1) + ΕΝΑ `<text>` ετικέτα ανά περιοχή, ΟΧΙ Ν γραμμές.
  // Οι ετικέτες `<n>` συνεχίζουν μετά τα user texts (κοινός `<text>` container → μοναδικά ids).
  const areas = collectTekAreas(decomposed, f, texts.textCount + 1);
  const mergedHatchesXml = [hatches.hatchesXml, areas.hatchesXml].filter(Boolean).join('\n');
  const mergedTextsXml = [texts.textsXml, areas.labelsXml].filter(Boolean).join('\n');
  // Στάδιο Ε — οι γραμμές γεμίσματος ζουν στον ΙΔΙΟ `<line>` container με τα primitives.
  const mergedLinesXml = [lines.linesXml, hatchFill.linesXml].filter(Boolean).join('\n');
  // Σκάλες → native `<stair>` (type 21, ADR-526 Φ3). Ίδιο scene→μέτρα convention.
  const { stairsXml } = collectTekStairs(selected, f);
  // ADR-608 — τα αποδομημένα σύμβολα (geometry path) έχουν κοινό `groupId` → κοινό tag στα
  // line/arc/text/hatch τους. Ένωση distinct tags → `<tag_visibility>` registry (ομαδοποίηση +Tags).
  const tagVisibilityXml = buildTagVisibilityXml(
    [...new Set([
      ...lines.tags, ...arcs.tags, ...texts.tags, ...hatches.tags, ...areas.tags,
      ...hatchFill.tags,
    ])],
  );
  return {
    xml: injectTekEntities(
      template, wallsXml, objects.objectsXml, planesXml, autoroofsXml,
      mergedLinesXml, arcs.arcsXml, stairsXml, tagVisibilityXml, mergedTextsXml,
      mergedHatchesXml,
    ),
    // Στάδιο Ε — dense-guard παραλείψεις (γραμμοσκιάσεις που έμειναν native) στα warnings.
    warnings: [...warnings, ...hatchFill.warnings],
  };
}

/** Φορτώνει lazy τον σκελετό (εκτός main chunk) + assemble. */
export async function buildTekDocument(
  scene: SceneModel,
  entityScope: ExportEntityScope,
  drawingScale?: number,
  symbolMode?: TekSymbolMode,
): Promise<AssembledTek> {
  const { TEK_SKELETON_TEMPLATE } = await import('../core/tek/tek-skeleton.template');
  return assembleTekDocument(TEK_SKELETON_TEMPLATE, scene, entityScope, drawingScale, symbolMode);
}

/** Εξάγει έναν resolved όροφο σε `.tek` artifact (ένα blob). */
export async function exportFloorToTek(
  floor: ResolvedExportFloor,
  options: TekExportOptions,
): Promise<{ artifact: ExportArtifact; warnings: string[] }> {
  const { xml, warnings } = await buildTekDocument(
    floor.scene, options.entityScope, options.drawingScale, options.symbolMode,
  );
  const filename = buildFloorFilename(options.baseName, floor.level.name, 'tek');
  return {
    artifact: { filename, blob: new Blob([xml], { type: 'application/xml' }) },
    warnings,
  };
}
