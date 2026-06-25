/**
 * ADR-526 (Tekton .TEK IMPORT) — `TekParseResult` → `SceneModel` (pure).
 *
 * Ο καθρέφτης (read-side) του `DxfSceneBuilder.buildScene`: παίρνει τα parsed Tekton
 * δεδομένα και παράγει ένα `SceneModel` έτοιμο για `setLevelScene`. Φ1 περιλαμβάνει
 * ΜΟΝΟ σκάλες· οι υπόλοιπες κατηγορίες entity (τοίχοι/κολώνες/δοκοί…) προστίθενται
 * σε επόμενες φάσεις πάνω στον ΙΔΙΟ builder.
 *
 * Μονάδες σκηνής: **mm** (ο Τέκτων είναι μετρικός — 1 m = 1000 mm)· τα bounds
 * προκύπτουν από το ΥΠΟΛΟΓΙΣΜΕΝΟ `geometry.bbox` κάθε σκάλας (η πραγματική έκταση
 * σχεδίασης), όχι από τις ακατέργαστες κορυφές.
 */

import type { SceneUnits } from '../../utils/scene-units';
import type { SceneModel, SceneBounds } from '../../types/scene-types';
import type { Entity } from '../../types/entities';
import type { Point2D } from '../../rendering/types/Types';
import { calculateBimEntity2DBounds } from '../../bim/utils/bim-bounds';
import { tekStairToEntity } from './tek-stair-to-bim';
import { tekLineToEntity, tekArcToEntity } from './tek-primitive-to-scene';
import type { TekSceneParseResult } from './tek-import-types';

/** Default bounds όταν δεν υπάρχει καμία σκάλα (κενή σκηνή). */
const EMPTY_BOUNDS: SceneBounds = { min: { x: -100, y: -100 }, max: { x: 100, y: 100 } };

/**
 * 2D bounds των 2Δ primitives (line/arc/circle), που ΔΕΝ καλύπτει το `calculateBimEntity2DBounds`
 * (BIM-only). Τόξο → bbox κύκλου (συντηρητικό υπερσύνολο, αρκετό για fit-to-view). `null` αλλιώς.
 */
function primitiveBounds(e: Entity): { min: Point2D; max: Point2D } | null {
  if (e.type === 'line') {
    return {
      min: { x: Math.min(e.start.x, e.end.x), y: Math.min(e.start.y, e.end.y) },
      max: { x: Math.max(e.start.x, e.end.x), y: Math.max(e.start.y, e.end.y) },
    };
  }
  if (e.type === 'circle' || e.type === 'arc') {
    return {
      min: { x: e.center.x - e.radius, y: e.center.y - e.radius },
      max: { x: e.center.x + e.radius, y: e.center.y + e.radius },
    };
  }
  return null;
}

/**
 * Ένωση των 2D bounds όλων των entities → SceneBounds. Το per-entity bbox προβάλλεται μέσω του
 * SSoT `calculateBimEntity2DBounds` (BIM: stair/wall/…)· για 2Δ primitives πέφτει στο
 * `primitiveBounds` — μηδέν inline bbox read για τα BIM.
 */
function boundsFromEntities(entities: readonly Entity[]): SceneBounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of entities) {
    const b = calculateBimEntity2DBounds(e) ?? primitiveBounds(e);
    if (!b) continue;
    minX = Math.min(minX, b.min.x); minY = Math.min(minY, b.min.y);
    maxX = Math.max(maxX, b.max.x); maxY = Math.max(maxY, b.max.y);
  }
  if (!Number.isFinite(minX)) return EMPTY_BOUNDS;
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

export interface TekSceneBuildResult {
  readonly scene: SceneModel;
  readonly warnings: readonly string[];
}

/**
 * ADR-526 Φ5a — χτίζει `SceneModel` από parsed Tekton scene (σκάλες + 2Δ primitives). Κάθε
 * `<stair>`/`<line>`/`<arc>` → entity μέσω του αντίστοιχου SSoT mapper. Τα 2Δ primitives ζουν
 * ΜΟΝΟ στο scene (DXF-style· δεν έχουν Firestore collection) — ο caller ΔΕΝ τα persist-άρει
 * ξεχωριστά. Προειδοποίηση «καμία σκάλα» εκπέμπεται ΜΟΝΟ αν το αρχείο είναι εντελώς άδειο.
 */
export function buildSceneFromTekScene(
  parsed: TekSceneParseResult,
  levelId: string,
  units: SceneUnits = 'mm',
): TekSceneBuildResult {
  const entities: Entity[] = [
    ...parsed.stairs.map((rec) => tekStairToEntity(rec, levelId, units)),
    ...parsed.lines.map((rec) => tekLineToEntity(rec, units)),
    ...parsed.arcs.map((rec) => tekArcToEntity(rec, units)),
  ];
  const warnings = [...parsed.warnings];
  if (entities.length === 0) {
    warnings.push('Δεν βρέθηκε καμία οντότητα στο .tek αρχείο.');
  }
  const scene: SceneModel = {
    entities,
    layersById: {},
    bounds: boundsFromEntities(entities),
    units,
    version: parsed.tektonVersion ?? undefined,
  };
  return { scene, warnings };
}
