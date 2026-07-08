/**
 * Beam span model — DERIVED inter-support span + continuous classification (ADR-504 Φ2).
 *
 * Λύνει το «ο sizer βλέπει ΟΛΟΚΛΗΡΟ το άνοιγμα»: όταν ένας δοκός στηρίζεται σε ≥1
 * **ΕΝΔΙΑΜΕΣΗ** κολώνα (mid-span), παύει να είναι αμφιέρειστος — γίνεται **συνεχής**.
 * Η διαστασιολόγηση πρέπει τότε να γίνεται για το **μέγιστο καθαρό υπο-άνοιγμα** μεταξύ
 * διαδοχικών στηρίξεων (όχι το πλήρες μήκος), με μοντέλο ροπών envelope `wL²/10`
 * (`'continuous'`, `spanMomentDivisor`). Industry-standard (Revit/Robot: ΕΝΑ physical
 * element, continuous analytical) — ο δοκός **ΔΕΝ** σπάει.
 *
 * **DERIVED ποτέ persisted** (mirror ADR-486 `derive-beam-support`): re-derived από τη
 * ζωντανή τοπολογία (`column-bearing` ακμές) + τη γεωμετρία (προβολή footprint στον
 * άξονα, reuse `projectColumnFootprintOnAxis`). Pure — zero React/DOM/Firestore.
 *
 * Η εφεδρεία είναι **ΣΥΝΤΗΡΗΤΙΚΗ**: το ακριβές μοντέλο (sagging+hogging envelope) το δίνει
 * ο FEM (ADR-481). Εδώ ζει το preliminary/Revit-grade σύστημα που τρέχει **πάντα**.
 *
 * @see ./derive-beam-support.ts — resolveBeamSupportCondition (base type + count, reuse)
 * @see ../../columns/column-face-trim.ts — projectColumnFootprintOnAxis (along projection, reuse)
 * @see ../section-context.ts — buildBeamSectionContext (καταναλωτής: span + supportType override)
 * @see docs/centralized-systems/reference/adrs/ADR-504-practical-span-intermediate-columns.md
 */

import { isColumnEntity, isBeamEntity } from '../../../types/entities';
import type { Entity } from '../../../types/entities';
import type { BeamEntity, BeamSupportType } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';
import { projectColumnFootprintOnAxis } from '../../columns/column-face-trim';
import { beamAxisSceneFrame } from '../../beams/beam-axis-scene-frame';
import { beamSupportColumnIds } from '../loads/load-path-walk';
import type { StructuralGraph } from './structural-organism-types';
import { resolveBeamSupportCondition } from './derive-beam-support';
import { clamp01 } from '../../../rendering/entities/shared/geometry-utils';

const M_TO_MM = 1000;

/** ≥ τόσες στηρίξεις ⇒ ≥1 ενδιάμεση ⇒ συνεχής δοκός (2 = αμφιέρειστος, 1 = πρόβολος). */
const CONTINUOUS_MIN_SUPPORTS = 3;

/** DERIVED μοντέλο ανοίγματος δοκαριού (sizing-span + τύπος στήριξης, topology-aware). */
export interface BeamSpanModel {
  /** Ο τύπος που οδηγεί ροπές/βέλος ΤΩΡΑ: 'continuous' με ενδιάμεσες στηρίξεις, αλλιώς base. */
  readonly supportType: BeamSupportType;
  /** Άνοιγμα διαστασιολόγησης (mm): max υπο-άνοιγμα όταν συνεχής, αλλιώς πλήρες μήκος. */
  readonly sizingSpanMm: number;
  /** Πλήθος στηριζουσών κολωνών (live `column-bearing`). */
  readonly supportCount: number;
}

/**
 * Μέγιστο καθαρό υπο-άνοιγμα (mm) μεταξύ διαδοχικών στηρίξεων: προβάλλει το κέντρο κάθε
 * στηρίζουσας κολώνας στον άξονα του δοκαριού (κλάσμα 0..1 · fullSpan), προσθέτει τα δύο
 * άκρα ως όρια, και επιστρέφει το μεγαλύτερο κενό. Degenerate (μηδέν columns / μηδενικός
 * άξονας) → πλήρες άνοιγμα (μηδέν crash / μηδέν false-shrink).
 */
function maxClearSubSpanMm(
  beam: BeamEntity,
  columns: readonly ColumnEntity[],
  fullSpanMm: number,
): number {
  const frame = beamAxisSceneFrame(beam); // ADR-506 — ΕΝΑ SSoT για το axis-frame (πρώην inline)
  if (!frame || columns.length === 0) return fullSpanMm;
  const positions = [0, fullSpanMm];
  for (const col of columns) {
    const { alongMin, alongMax } = projectColumnFootprintOnAxis(col, frame.ax, frame.ay, frame.ux, frame.uy);
    positions.push(clamp01((alongMin + alongMax) / 2 / frame.lenScene) * fullSpanMm);
  }
  positions.sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < positions.length; i++) {
    maxGap = Math.max(maxGap, positions[i]! - positions[i - 1]!);
  }
  return maxGap;
}

/**
 * DERIVED span model ενός δοκαριού. <3 στηρίξεις → base condition + πλήρες άνοιγμα (μηδέν
 * regression σε αμφιέρειστα/προβόλους). ≥3 → `'continuous'` + max καθαρό υπο-άνοιγμα από
 * την προβολή των στηριζουσών κολωνών στον άξονα.
 */
export function deriveBeamSpanModel(
  beam: BeamEntity,
  graph: StructuralGraph,
  entities: readonly Entity[],
  storedType: BeamSupportType | undefined,
): BeamSpanModel {
  const condition = resolveBeamSupportCondition(graph, beam.id, storedType);
  const fullSpanMm = beam.geometry.length * M_TO_MM;
  if (condition.supportCount < CONTINUOUS_MIN_SUPPORTS) {
    return {
      supportType: condition.supportType,
      sizingSpanMm: fullSpanMm,
      supportCount: condition.supportCount,
    };
  }
  const supportIds = new Set(beamSupportColumnIds(graph, beam.id));
  const columns = entities.filter(
    (e): e is ColumnEntity => isColumnEntity(e) && supportIds.has(e.id),
  );
  return {
    supportType: 'continuous',
    sizingSpanMm: maxClearSubSpanMm(beam, columns, fullSpanMm),
    supportCount: condition.supportCount,
  };
}

/**
 * Map `beamId → BeamSpanModel` για ΟΛΑ τα δοκάρια του graph. Mirror του `buildBeamSupportTypeMap`
 * (ADR-486) αλλά **entity-aware** (χρειάζεται γεωμετρία για την προβολή στηρίξεων). Ο node του
 * graph φέρει το stored `supportType` (fallback). Καταναλωτές: ο organism pass (publish 2 stores
 * supportType+span) + ο auto-reinforce/checks core.
 */
export function buildBeamSpanModelMap(
  graph: StructuralGraph,
  entities: readonly Entity[],
): Map<string, BeamSpanModel> {
  const beamById = new Map<string, BeamEntity>();
  for (const e of entities) if (isBeamEntity(e)) beamById.set(e.id, e);
  const map = new Map<string, BeamSpanModel>();
  for (const node of graph.nodes) {
    if (node.memberKind !== 'beam') continue;
    const beam = beamById.get(node.id);
    if (!beam) continue;
    map.set(node.id, deriveBeamSpanModel(beam, graph, entities, node.supportType));
  }
  return map;
}
