/**
 * Intermediate-column placement — pure even-split + build (ADR-504 Φάση 2, S4).
 *
 * Όταν ο practical-span advisory (ADR-504 Φ1) εντοπίζει **μη-πρακτικά βαθύ** δοκάρι
 * (π.χ. 16m → 1450mm), προτείνει `K` ισαπέχουσες **ενδιάμεσες** κολώνες. Αυτό το
 * module είναι το «χέρι» της πρότασης: παράγει τις `K` θέσεις στον άξονα του δοκού
 * και χτίζει `ColumnEntity[]` **κλωνοποιώντας τη διατομή** μιας στηρίζουσας (framing)
 * κολώνας — ώστε οι νέες κολώνες να ταιριάζουν με τις υπάρχουσες (Revit «match
 * section») και να κατεβαίνουν foundation→ceiling με τον ίδιο τρόπο.
 *
 * **Μηδέν νέα geometry/builder/ID λογική** — κάθε κολώνα περνά από το ΥΠΑΡΧΟΝ SSoT
 * `buildDefaultColumnParams`+`buildColumnEntity` (column-completion.ts), ακριβώς όπως
 * το `column-from-grid`. Τα Enterprise IDs (N.6) παράγονται μέσα στο `createColumn`
 * factory (`generateColumnId`/`generateIfcGuid`) — ΠΟΤΕ χειροκίνητα.
 *
 * Pure — zero React/DOM/Firestore/scene-mutation. Η εισαγωγή στη σκηνή γίνεται στο
 * S6 μέσω `CompoundCommand[CreateColumnsCommand]`.
 *
 * @see ./column-from-grid.ts — το idiom build (buildDefaultColumnParams+buildColumnEntity)
 * @see ../structural/organism/derive-beam-span-model.ts — η ίδια έννοια υπο-ανοίγματος (S2)
 * @see docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md §5.1
 */

import type { Point2D } from '../../rendering/types/Types';
import type { BeamEntity } from '../types/beam-types';
import type { ColumnEntity } from '../types/column-types';
import {
  buildDefaultColumnParams,
  buildColumnEntity,
  type ColumnParamOverrides,
} from '../../hooks/drawing/column-completion';
import type { SceneUnits } from '../../utils/scene-units';

/**
 * `K` ισαπέχουσες ενδιάμεσες θέσεις στον άξονα του δοκού (start→end). Παράμετρος
 * `t = i/(K+1)`, `i=1..K` → καθαρά **εσωτερικά** σημεία (ποτέ στα άκρα, εκεί ήδη
 * υπάρχουν στηρίξεις). Συντεταγμένες = ίδιο space με `beam.params.startPoint/endPoint`
 * (scene units) → 1:1 με το position space των κολωνών (column-from-grid).
 */
export function intermediateColumnPositions(
  beam: BeamEntity,
  count: number,
): Point2D[] {
  if (count <= 0) return [];
  const s = beam.params.startPoint;
  const e = beam.params.endPoint;
  const positions: Point2D[] = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    positions.push({ x: s.x + (e.x - s.x) * t, y: s.y + (e.y - s.y) * t });
  }
  return positions;
}

/**
 * Εξάγει τα section overrides μιας στηρίζουσας κολώνας ώστε οι ενδιάμεσες να την
 * κλωνοποιήσουν (kind + διαστάσεις + variant geometry + vertical extent). Anchor =
 * `'center'`: η ενδιάμεση κάθεται κεντραρισμένη στον άξονα του δοκού. Τα relational
 * FKs (attach/footing/bindings) ΔΕΝ μεταφέρονται — re-derived από τον οργανισμό.
 */
function templateColumnOverrides(template: ColumnEntity): ColumnParamOverrides {
  const p = template.params;
  return {
    kind: p.kind,
    anchor: 'center',
    width: p.width,
    depth: p.depth,
    height: p.height,
    rotation: p.rotation,
    baseOffset: p.baseOffset,
    ...(p.material !== undefined ? { material: p.material } : {}),
    ...(p.lshape !== undefined ? { lshape: p.lshape } : {}),
    ...(p.tshape !== undefined ? { tshape: p.tshape } : {}),
    ...(p.polygon !== undefined ? { polygon: p.polygon } : {}),
    ...(p.ishape !== undefined ? { ishape: p.ishape } : {}),
    ...(p.ushape !== undefined ? { ushape: p.ushape } : {}),
    ...(p.composite !== undefined ? { composite: p.composite } : {}),
    ...(p.catalogProfile !== undefined ? { catalogProfile: p.catalogProfile } : {}),
  };
}

/**
 * Χτίζει `K` ενδιάμεσες `ColumnEntity` πάνω στον άξονα του δοκού, κλωνοποιώντας τη
 * διατομή της `template` κολώνας. Fresh Enterprise IDs (N.6) ανά κολώνα μέσω του
 * `createColumn` factory. Κολώνα που απορρίπτει ο validator (degenerate params)
 * παραλείπεται — επιστρέφονται μόνο οι έγκυρες. Pure.
 */
export function buildIntermediateColumns(
  beam: BeamEntity,
  template: ColumnEntity,
  count: number,
  layerId: string,
  sceneUnits: SceneUnits = 'mm',
): ColumnEntity[] {
  const overrides = templateColumnOverrides(template);
  const columns: ColumnEntity[] = [];
  for (const position of intermediateColumnPositions(beam, count)) {
    const params = buildDefaultColumnParams(position, overrides.kind, overrides, sceneUnits);
    const result = buildColumnEntity(params, layerId, sceneUnits);
    if (result.ok) columns.push(result.entity);
  }
  return columns;
}
