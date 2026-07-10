/**
 * ADR-531 Φ5b.6 (Tekton .TEK IMPORT — BIM γραμμοσκίαση) — mapper `TekHatchRecord` → **native**
 * `HatchEntity` (AutoCAD-style hatch, ADR-507). Ο Τέκτων εξάγει τη γραμμοσκίαση ως `<hatch>`
 * (type 6): κλειστό όριο (`<vector>` segments) + pattern index (2ο `<type>`· 22=solid) + κλίμακα/
 * γωνία μοτίβου. Ο mapper το κάνει δική μας παραμετρική γραμμοσκίαση (editable/grips/persist).
 *
 * Reuse (μηδέν geometry/builder duplication — μοτίβο `tek-plane-to-slab`):
 *   - Y-flip + units → SSoT `tekMetersToScene`.
 *   - hatch build → `buildHatchEntityFromBoundary` (SSoT· εδώ με explicit appearance override).
 *   - pattern number → name → SSoT `TEKTON_HATCH_NUMBER_TO_NAME` / `TEKTON_SOLID_HATCH_NUM`
 *     (`tekton-hatch-catalog.ts`, ο ίδιος bidirectional χάρτης με το export).
 *   - appearance base → SSoT `DEFAULT_HATCH_DRAW_DEFAULTS` (deterministic, ΟΧΙ live UI state).
 *   - χρώμα → SSoT `tekColorToHex`.
 *
 * @module io/tek/tek-hatch-to-bim
 */

import { type SceneUnits } from '../../utils/scene-units';
import { tekMetersToScene } from '../../export/core/tek/tek-geometry';
import { tekColorToHex } from './tek-color';
import { buildHatchEntityFromBoundary } from '../../bim/hatch/hatch-completion';
import { DEFAULT_HATCH_DRAW_DEFAULTS } from '../../bim/hatch/hatch-draw-defaults-store';
import type { HatchDrawDefaults } from '../../bim/hatch/hatch-draw-defaults-store';
import { TEKTON_HATCH_NUMBER_TO_NAME } from '../../data/tekton-hatch-catalog';
import { generateEntityId } from '../../systems/entity-creation/utils';
import type { HatchEntity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import type { TekHatchRecord } from './tek-import-types';

/** Αποτέλεσμα mapping ενός `<hatch>`: η BIM γραμμοσκίαση (ή `null` αν απορριφθεί) + προειδοποιήσεις. */
export interface TekHatchResult {
  readonly hatch: HatchEntity | null;
  readonly warnings: readonly string[];
}

/** Γωνία διαγώνιας γραμμοσκίασης (μοίρες) για το tek «solid raster»/άγνωστο μοτίβο — κλασικό 45°. */
const TEK_DEFAULT_HATCH_ANGLE_DEG = 45;

/**
 * Appearance (fill/pattern/χρώμα) ενός tek hatch → `HatchDrawDefaults` override.
 *
 * ΠΡΟΣΟΧΗ (Giorgio 2026-07-10, ground truth από τον Τέκτονα): το tek μοτίβο 22 (`raster:solid` στον
 * catalog) **ΔΕΝ** ζωγραφίζεται συμπαγές — ο Τέκτων το δείχνει ως **διαγώνια γραμμοσκίαση** (πράσινες
 * γραμμές + λευκά κενά ανάμεσα). Άρα:
 *   - Γνωστό PAT μοτίβο catalog (π.χ. 72→ANSI31) → `predefined` (οι γραμμές του μοτίβου).
 *   - 22 (solid-sentinel) ή άγνωστο → `user-defined` διαγώνιες γραμμές 45° (γραμμές + διαφανή κενά),
 *     απόσταση από το `scaleX` (μέτρα→mm). ΠΟΤΕ `solid` (θα «γέμιζε» όλη την περιοχή).
 */
function resolveHatchAppearance(rec: TekHatchRecord): HatchDrawDefaults {
  const fillColor = tekColorToHex(rec.color);
  const patternName = TEKTON_HATCH_NUMBER_TO_NAME[rec.patternNum];
  if (patternName) {
    return {
      ...DEFAULT_HATCH_DRAW_DEFAULTS,
      fillType: 'predefined',
      fillColor,
      patternName,
      ...(rec.scaleX > 1e-6 ? { patternScale: rec.scaleX } : {}),
      patternAngle: rec.rotationDeg,
    };
  }
  const lineSpacing = rec.scaleX > 1e-6 ? rec.scaleX * 1000 : DEFAULT_HATCH_DRAW_DEFAULTS.lineSpacing;
  return {
    ...DEFAULT_HATCH_DRAW_DEFAULTS,
    fillType: 'user-defined',
    fillColor,
    lineAngle: TEK_DEFAULT_HATCH_ANGLE_DEG,
    lineSpacing,
    doubleCrossHatch: false,
  };
}

/**
 * Map ενός `TekHatchRecord` → BIM `HatchEntity`. Όριο → scene (Y-flip)· appearance από το record
 * (solid/predefined + χρώμα/κλίμακα/γωνία). Ανεπαρκές όριο (<3 κορυφές) → warning + `null`.
 */
export function tekHatchToEntity(
  rec: TekHatchRecord,
  layerId: string | undefined,
  sceneUnits: SceneUnits = 'mm',
): TekHatchResult {
  const warnings: string[] = [];
  const boundary: Point2D[] = rec.boundary.map((v) => tekMetersToScene(v.x, v.y, sceneUnits));
  const built = buildHatchEntityFromBoundary(
    boundary,
    generateEntityId(),
    layerId,
    resolveHatchAppearance(rec),
  );
  if (!built) {
    warnings.push('Γραμμοσκίαση .tek παραλείφθηκε: ανεπαρκές όριο (<3 κορυφές).');
    return { hatch: null, warnings };
  }
  // ADR-531 Φ5b.6 — background color πίσω από τις γραμμές (ο Τέκτων: raster_bgcolor, π.χ. λευκό).
  const hatch: HatchEntity = rec.bgColor
    ? { ...built, backgroundColor: tekColorToHex(rec.bgColor) }
    : built;
  return { hatch, warnings };
}
