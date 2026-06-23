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
import { HatchLifecycleSignalCommand } from '../../core/commands/entity-commands/HatchLifecycleSignalCommand';
import { calculatePolygonArea } from '../../rendering/entities/shared/geometry-polyline-utils';
import { getHatchDrawDefaults } from './hatch-draw-defaults-store';
import { buildGradientFromDefaults } from './hatch-gradient-build';
import { isConcreteLineweight } from '../../config/lineweight-iso-catalog';

/** Ελάχιστος αριθμός κορυφών για έγκυρο κλειστό όριο. */
export const HATCH_MIN_BOUNDARY_POINTS = 3;

/**
 * SSoT core: χτίζει `HatchEntity` από έτοιμα `boundaryPaths` (εξωτερικό δακτύλιο +
 * νησιά), εφαρμόζοντας τα τρέχοντα draw-defaults. Κοινό για τον Τρόπο Α (boundary,
 * 1 ring) και τον Τρόπο Β (pick-point, ring + holes) — μηδέν copy-paste.
 *
 * Επιστρέφει `null` αν ο εξωτερικός δακτύλιος δεν έχει αρκετές κορυφές.
 */
function buildHatchEntityFromPaths(
  boundaryPaths: Point2D[][],
  id: string,
  layerId: string | undefined,
): HatchEntity | null {
  const outer = boundaryPaths[0];
  if (!outer || outer.length < HATCH_MIN_BOUNDARY_POINTS) return null;
  const d = getHatchDrawDefaults();
  const isSolid = d.fillType === 'solid';
  const isPredefined = d.fillType === 'predefined';
  const isGradient = d.fillType === 'gradient';
  const isUserDefined = d.fillType === 'user-defined';
  return {
    id,
    type: 'hatch',
    // Κράτα μόνο τους έγκυρους δακτυλίους (≥3 κορυφές) + κλώνος των σημείων.
    boundaryPaths: boundaryPaths
      .filter((ring) => ring.length >= HATCH_MIN_BOUNDARY_POINTS)
      .map((ring) => ring.map((p) => ({ x: p.x, y: p.y }))),
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
    // Gap tolerance (ADR-507 §5β.1 / Φ3) — αποθηκεύεται μόνο όταν >0 (pick-point bridge).
    gapTolerance: d.gapTolerance > 0 ? d.gapTolerance : undefined,
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
 * Τρόπος Α (boundary) — χτίζει `HatchEntity` από τις κορυφές ΕΝΟΣ κλειστού ορίου.
 * Επιστρέφει `null` αν δεν υπάρχουν αρκετές κορυφές.
 */
export function buildHatchEntityFromBoundary(
  points: Point2D[],
  id: string,
  layerId: string | undefined,
): HatchEntity | null {
  if (points.length < HATCH_MIN_BOUNDARY_POINTS) return null;
  return buildHatchEntityFromPaths([points], id, layerId);
}

/**
 * Τρόπος Β (pick-point) — χτίζει `HatchEntity` από το αποτέλεσμα ανίχνευσης
 * περιοχής (`auto-area-hit`): εξωτερικός δακτύλιος + νησιά (holes) ως εσωτερικοί
 * δακτύλιοι. Το even-odd render/area αφαιρεί αυτόματα τα νησιά (ίδιο με Τρόπο Α).
 * Επιστρέφει `null` αν ο εξωτερικός δακτύλιος δεν έχει αρκετές κορυφές.
 */
export function buildHatchEntityFromRegion(
  outer: Point2D[],
  holes: Point2D[][],
  id: string,
  layerId: string | undefined,
): HatchEntity | null {
  if (outer.length < HATCH_MIN_BOUNDARY_POINTS) return null;
  return buildHatchEntityFromPaths([outer, ...holes], id, layerId);
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
 * §5δ.9 — post-create εντολές για τη γραμμοσκίαση, τυλιγμένες με το
 * `CreateEntityCommand` σε ΕΝΑ `CompoundCommand` από το `completeEntity` → ΕΝΑ undo:
 *   1. `ReorderEntityCommand` — αποστολή στο πίσω μέρος ώστε να μη σκεπάζει τις
 *      γραμμές που γεμίζει,
 *   2. `HatchLifecycleSignalCommand` (ADR-390/ADR-507) — ΤΕΛΕΥΤΑΙΟ child· εκπέμπει
 *      `bim:hatch-delete-requested` στο undo-of-create (σβήσιμο doc + tombstone) και
 *      `bim:entity-restore-requested` στο redo (re-create doc, ίδιο id). Μηδέν επίδραση
 *      στη σκηνή — μόνο persistence lifecycle (δες το command για τη σειρά undo/redo).
 */
export function buildHatchPostCreateCommands(
  entityId: string,
  sceneManager: ISceneManager,
): ICommand[] {
  return [
    new ReorderEntityCommand(entityId, 'back', sceneManager),
    new HatchLifecycleSignalCommand(entityId, sceneManager),
  ];
}
