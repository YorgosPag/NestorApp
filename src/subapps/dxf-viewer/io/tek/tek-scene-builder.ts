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
import { tekLineToEntity, tekArcToEntity, tekTextToEntity } from './tek-primitive-to-scene';
// ADR-531 Φ5b.2 — 3Δ τοίχοι/κουφώματα → native BIM WallEntity/OpeningEntity (αντικατέστησε τον
// 2Δ-lines δρόμο `tekWallToEntities`· «μία οντότητα, δύο όψεις»).
import { tekWallToBimEntities } from './tek-wall-to-bim';
// ADR-531 Φ5b.4 — πλάκες (`<plane>` type 10) → native BIM SlabEntity.
import { tekPlaneToSlabEntity } from './tek-plane-to-slab';
// ADR-526 Φ6c — καθαρισμός stair-generated πλακών (μπετόν σκαλοπατιών): drop τριγωνικών + κατέβασμα ορθογώνιων.
import { refineStairMeshPlanes } from './tek-stair-plane-refine';
// ADR-531 Φ5b.5 — κολώνες/τοιχία (`<pillar>1` records) → native BIM ColumnEntity.
import { tekPillarToColumnEntity } from './tek-pillar-to-column';
// ADR-531 Φ5b.6 — γραμμοσκιάσεις (`<hatch>` type 6) → native HatchEntity.
import { tekHatchToEntity } from './tek-hatch-to-bim';
import { tekDimToDimensionEntities } from './tek-dim-to-dimension';
// ADR-608 — native σύμβολα Τέκτονα (type-7 <object>) → AnnotationSymbolEntity.
import { tekObjectToEntity } from './tek-object-to-scene';
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
  if (e.type === 'text') {
    return { min: { x: e.position.x, y: e.position.y }, max: { x: e.position.x, y: e.position.y } };
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

/**
 * Ποσοστό διόγκωσης του stair footprint για το φιλτράρισμα generator-γεωμετρίας (ανεξάρτητο
 * μονάδων — κλάσμα της μεγαλύτερης διάστασης). Καλύπτει μύτες/επικαλύψεις βαθμίδων που ξεπερνούν
 * οριακά το BIM bbox, χωρίς να αγγίζει γνήσιες annotations έξω από τη σκάλα.
 */
const GENERATOR_MARGIN_FRAC = 0.02;

/** Επεκτείνει ένα bbox κατά κλάσμα της μεγαλύτερης διάστασής του. */
function inflate(b: SceneBounds, frac: number): SceneBounds {
  const m = frac * Math.max(b.max.x - b.min.x, b.max.y - b.min.y);
  return { min: { x: b.min.x - m, y: b.min.y - m }, max: { x: b.max.x + m, y: b.max.y + m } };
}

/** `true` αν το `inner` bbox περιέχεται πλήρως στο `outer`. */
function isInside(inner: SceneBounds, outer: SceneBounds): boolean {
  return inner.min.x >= outer.min.x && inner.max.x <= outer.max.x
    && inner.min.y >= outer.min.y && inner.max.y <= outer.max.y;
}

/**
 * ADR-526 — «αντικατάσταση, όχι overlay»: ο Τέκτων αποθηκεύει κάθε σκάλα ΚΑΙ ως semantic
 * `<stair>` ΚΑΙ ως 2Δ generator γεωμετρία (`<line>` ακμές βαθμίδων + `<text>` αριθμοί). Αφού
 * φτιάξουμε τη native BIM σκάλα, πετάμε τα 2Δ primitives που πέφτουν ΜΕΣΑ στο footprint της —
 * μένει μόνο το καθαρό BIM μοντέλο. Πρωτόγονα εκτός σκαλών (γνήσιες annotations) μένουν ανέπαφα.
 */
function dropGeneratorGeometry(
  primitives: readonly Entity[],
  stairFootprints: readonly SceneBounds[],
): { kept: Entity[]; dropped: number } {
  if (stairFootprints.length === 0) return { kept: [...primitives], dropped: 0 };
  const kept: Entity[] = [];
  let dropped = 0;
  for (const e of primitives) {
    const b = primitiveBounds(e);
    if (b && stairFootprints.some((fp) => isInside(b, fp))) { dropped += 1; continue; }
    kept.push(e);
  }
  return { kept, dropped };
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
  const warnings = [...parsed.warnings];
  // ADR-608 — native σύμβολα: κάθε <object> → δικό μας σύμβολο ή ονομαστικό warning (χωρίς equivalent).
  const symbolEntities: Entity[] = [];
  for (const rec of parsed.objects) {
    const { entity, warning } = tekObjectToEntity(rec, units);
    if (entity) symbolEntities.push(entity);
    if (warning) warnings.push(warning);
  }
  // ADR-531 Φ5b.2 — κάθε <wall> → BIM WallEntity + hosted OpeningEntity[] (πόρτες/παράθυρα).
  const wallEntities: Entity[] = [];
  for (const rec of parsed.walls) {
    const { wall, openings, warnings: wallWarnings } = tekWallToBimEntities(rec, levelId, units);
    if (wall) wallEntities.push(wall);
    wallEntities.push(...openings);
    warnings.push(...wallWarnings);
  }
  // ADR-531 Φ5b.4 — κάθε <plane> (type 10) → BIM SlabEntity. ADR-526 Φ6c: πρώτα καθαρισμός των
  // stair-generated πλακών (drop τριγωνικών διπλότυπων + κατέβασμα ορθογώνιων στο ύψος καθίσματος).
  const slabEntities: Entity[] = [];
  for (const rec of refineStairMeshPlanes(parsed.planes, parsed.stairs)) {
    const { slab, warnings: slabWarnings } = tekPlaneToSlabEntity(rec, levelId, units);
    if (slab) slabEntities.push(slab);
    warnings.push(...slabWarnings);
  }
  // ADR-531 Φ5b.5 — κάθε <pillar>1 record → BIM ColumnEntity (κολώνα ή τοιχίο κατά σχέση πλευρών).
  const columnEntities: Entity[] = [];
  for (const rec of parsed.pillars) {
    const { column, warnings: colWarnings } = tekPillarToColumnEntity(rec, levelId, units);
    if (column) columnEntities.push(column);
    warnings.push(...colWarnings);
  }
  // ADR-531 Φ5b.6 — κάθε <hatch> (type 6) → native HatchEntity (solid/predefined από το record).
  const hatchEntities: Entity[] = [];
  for (const rec of parsed.hatches) {
    const { hatch, warnings: hatchWarnings } = tekHatchToEntity(rec, undefined, units);
    if (hatch) hatchEntities.push(hatch);
    warnings.push(...hatchWarnings);
  }
  // ADR-526 — native BIM σκάλες + αντικατάσταση των 2Δ generator primitives (γραμμές/αριθμοί
  // βαθμίδων) που τις διπλασιάζουν: τα φιλτράρουμε με βάση το footprint κάθε σκάλας.
  const stairEntities: Entity[] = parsed.stairs.map((rec) => tekStairToEntity(rec, levelId, units));
  const stairFootprints: SceneBounds[] = stairEntities
    .map((e) => calculateBimEntity2DBounds(e))
    .filter((b): b is SceneBounds => b !== null)
    .map((b) => inflate(b, GENERATOR_MARGIN_FRAC));
  const lineEntities = parsed.lines.map((rec) => tekLineToEntity(rec, units));
  const textEntities = parsed.texts.map((rec) => tekTextToEntity(rec, units));
  const { kept: keptLines, dropped: droppedLines } = dropGeneratorGeometry(lineEntities, stairFootprints);
  const { kept: keptTexts, dropped: droppedTexts } = dropGeneratorGeometry(textEntities, stairFootprints);
  if (droppedLines + droppedTexts > 0) {
    warnings.push(
      `Αφαιρέθηκαν ${droppedLines} γραμμές + ${droppedTexts} αριθμοί βαθμίδων εντός σκαλών `
      + '(generator γεωμετρία — αντικατάσταση από native BIM σκάλα).',
    );
  }
  const entities: Entity[] = [
    ...stairEntities,
    ...keptLines,
    ...parsed.arcs.map((rec) => tekArcToEntity(rec, units)),
    ...keptTexts,
    // ADR-531 Φ5b.2 — BIM τοίχοι + κουφώματα (αντί για 2Δ primitives).
    ...wallEntities,
    // ADR-531 Φ5b.4 — BIM πλάκες.
    ...slabEntities,
    // ADR-531 Φ5b.5 — BIM κολώνες/τοιχία.
    ...columnEntities,
    // ADR-531 Φ5b.6 — BIM γραμμοσκιάσεις.
    ...hatchEntities,
    // ADR-608 — κάθε <dim> → native παραμετρικό DimensionEntity (ενιαίος οργανισμός, όπως ο Τέκτων).
    ...parsed.dims.flatMap((rec) => tekDimToDimensionEntities(rec, units)),
    ...symbolEntities,
  ];
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
