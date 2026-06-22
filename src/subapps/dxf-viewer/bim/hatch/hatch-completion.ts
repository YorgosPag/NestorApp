/**
 * Hatch completion helpers (ADR-507 S2 / Φ1b).
 *
 * Pure SSoT για:
 *   - τη μετατροπή boundary points → `HatchEntity` (με τα τρέχοντα draw-defaults),
 *   - τον υπολογισμό εμβαδού (outer − Σ holes, reuse `calculatePolygonArea`),
 *   - τις post-create εντολές (§5δ.9 auto-send-to-back) που τυλίγονται μαζί με το
 *     `CreateEntityCommand` σε ΕΝΑ `CompoundCommand` → ΕΝΑ undo.
 *
 * Render/writer/reader/geometry έρχονται από το S1 — εδώ μόνο η σύνδεση UI→entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { HatchEntity } from '../../types/entities';
import type { ICommand, ISceneManager } from '../../core/commands/interfaces';
import { ReorderEntityCommand } from '../../core/commands/entity-commands/ReorderEntityCommand';
import { calculatePolygonArea } from '../../rendering/entities/shared/geometry-polyline-utils';
import { getHatchDrawDefaults } from './hatch-draw-defaults-store';
import { buildGradientFromDefaults } from './hatch-gradient-build';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';

/** Ελάχιστος αριθμός κορυφών για έγκυρο κλειστό όριο. */
export const HATCH_MIN_BOUNDARY_POINTS = 3;

/**
 * Χτίζει `HatchEntity` από τις κορυφές του ορίου, εφαρμόζοντας τα τρέχοντα
 * draw-defaults. Επιστρέφει `null` αν δεν υπάρχουν αρκετές κορυφές.
 */
export function buildHatchEntityFromBoundary(
  points: Point2D[],
  id: string,
  layerId: string | undefined,
): HatchEntity | null {
  if (points.length < HATCH_MIN_BOUNDARY_POINTS) return null;
  const d = getHatchDrawDefaults();
  const isSolid = d.fillType === 'solid';
  const isPredefined = d.fillType === 'predefined';
  const isGradient = d.fillType === 'gradient';
  const isUserDefined = d.fillType === 'user-defined';
  return {
    id,
    type: 'hatch',
    boundaryPaths: [points.map((p) => ({ x: p.x, y: p.y }))],
    fillType: d.fillType,
    patternType: isSolid ? 'solid' : isGradient ? 'gradient' : 'pattern',
    fillColor: d.fillColor,
    lineAngle: d.lineAngle,
    lineSpacing: d.lineSpacing,
    doubleCrossHatch: isUserDefined ? d.doubleCrossHatch : undefined,
    islandStyle: d.islandStyle,
    // predefined PAT μοτίβο (ADR-507 Φ2) — μόνο όταν fillType==='predefined'.
    patternName: isPredefined ? d.patternName : undefined,
    patternScale: isPredefined ? d.patternScale : undefined,
    patternAngle: isPredefined ? d.patternAngle : undefined,
    // gradient γέμισμα (ADR-507 Φ5) — μόνο όταν fillType==='gradient', χτισμένο από τα defaults (SSoT).
    gradient: isGradient ? buildGradientFromDefaults(d) : undefined,
    // Πάχος γραμμών (AutoCAD LWT) — αποθηκεύεται μόνο όταν concrete· ByLayer/default
    // παραλείπεται ώστε ο renderer να εφαρμόσει το fallback (mirror completeEntity).
    lineweightMm: isConcreteLineweight(d.lineweightMm) ? d.lineweightMm : undefined,
    // §5δ — back bucket· το ReorderEntityCommand κατεβάζει και τη θέση στον πίνακα.
    drawOrder: 0,
    visible: true,
    layerId,
  } as HatchEntity;
}

/**
 * Εμβαδόν γραμμοσκίασης (mm²): εξωτερικό όριο − Σ(εσωτερικά νησιά). Reuse του
 * `calculatePolygonArea` SSoT (shoelace) — μηδέν re-implementation.
 */
export function computeHatchAreaMm2(hatch: Pick<HatchEntity, 'boundaryPaths'>): number {
  const paths = hatch.boundaryPaths ?? [];
  if (paths.length === 0) return 0;
  const outer = calculatePolygonArea(paths[0]);
  let holes = 0;
  for (let i = 1; i < paths.length; i++) holes += calculatePolygonArea(paths[i]);
  return Math.max(0, outer - holes);
}

/**
 * §5δ.9 — post-create εντολές για τη γραμμοσκίαση: αποστολή στο πίσω μέρος ώστε να
 * μη σκεπάζει τις γραμμές που γεμίζει. Τυλίγεται με το `CreateEntityCommand` σε ΕΝΑ
 * `CompoundCommand` από το `completeEntity` → ΕΝΑ undo.
 */
export function buildHatchPostCreateCommands(
  entityId: string,
  sceneManager: ISceneManager,
): ICommand[] {
  return [new ReorderEntityCommand(entityId, 'back', sceneManager)];
}
