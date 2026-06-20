/**
 * Beam max-width — DERIVED άνω όριο πλάτους δοκαριού από τη στηρίζουσα κολώνα (ADR-506).
 *
 * Ο width-aware auto-sizer (ADR-506) φαρδαίνει το δοκάρι όταν το ύψος χτυπά το πρακτικό όριο
 * ΝΟΚ — αλλά **το πολύ όσο η κολώνα που το στηρίζει** (το δοκάρι «κάθεται» μέσα στην κολώνα,
 * δεν προεξέχει· καθαρός κόμβος, Revit-grade). **Μονόδρομο:** η κολώνα ΔΕΝ μεγαλώνει από το
 * δοκάρι (αποφυγή cascade/σεισμικής σύζευξης)· υπερβολικό άνοιγμα → ADR-504 ενδιάμεση κολώνα.
 *
 * Το cap = η **κάθετη στον άξονα του δοκαριού** έκταση του footprint της κολώνας (`perpMax−perpMin`),
 * γιατί το πλάτος της διατομής είναι κάθετο στη διεύθυνση όδευσης. Min επί ΟΛΩΝ των στηρίξεων
 * (το δοκάρι έχει ένα πλάτος σε όλο το μήκος → πρέπει να χωρά στην πιο στενή στήριξη).
 *
 * **DERIVED ποτέ persisted** (mirror `derive-beam-span-model`): re-derived από τη ζωντανή
 * τοπολογία (`column-bearing` ακμές) + τη γεωμετρία (προβολή footprint στον άξονα, reuse
 * `projectPolygonOnAxis` SSoT). Kind-agnostic (ορθογ./L/T/U/I/κυκλική — όλα μέσω footprint).
 * Pure — zero React/DOM/Firestore.
 *
 * @see ../../geometry/shared/polygon-axis-projection.ts — projectPolygonOnAxis (perp έκταση, reuse)
 * @see ../loads/load-path-walk.ts — beamSupportColumnIds (στηρίζουσες κολώνες)
 * @see ./beam-max-width-store.ts — BeamMaxWidthStore (ο transport)
 * @see docs/centralized-systems/reference/adrs/ADR-506-beam-width-auto-sizing.md
 */

import { isColumnEntity, isBeamEntity } from '../../../types/entities';
import type { Entity } from '../../../types/entities';
import type { BeamEntity } from '../../types/beam-types';
import type { ColumnEntity } from '../../types/column-types';
import { projectPolygonOnAxis } from '../../geometry/shared/polygon-utils';
import { beamAxisSceneFrame } from '../../beams/beam-axis-scene-frame';
import { beamSupportColumnIds } from '../loads/load-path-walk';
import type { StructuralGraph } from './structural-organism-types';

const M_TO_MM = 1000;

/**
 * Το άνω όριο πλάτους (mm) ενός δοκαριού = min κάθετη έκταση των footprints των στηριζουσών
 * κολωνών στον άξονά του. Degenerate (μηδενικός άξονας / καμία κολώνα με έγκυρο footprint) →
 * `undefined` (ο consumer μένει depth-only). Άξονας + scene→mm από το `beamAxisSceneFrame` SSoT.
 */
function beamMaxWidthMm(beam: BeamEntity, columns: readonly ColumnEntity[]): number | undefined {
  const frame = beamAxisSceneFrame(beam);
  if (!frame || columns.length === 0) return undefined;
  // scene→mm: το άνω όριο πλάτους πρέπει σε mm (η κάθετη έκταση είναι σε scene units). Μοναδική
  // χρήση εδώ (ο axis-frame είναι geometry-independent SSoT· το mm-scale το χρειάζεται μόνο αυτός).
  const sceneToMm = (beam.geometry.length * M_TO_MM) / frame.lenScene;
  let cap = Infinity;
  for (const col of columns) {
    const verts = col.geometry?.footprint?.vertices ?? [];
    if (verts.length < 2) continue;
    const { perpMin, perpMax } = projectPolygonOnAxis(verts, frame.ax, frame.ay, frame.ux, frame.uy);
    const perpExtentMm = (perpMax - perpMin) * sceneToMm;
    if (perpExtentMm > 0) cap = Math.min(cap, perpExtentMm);
  }
  return Number.isFinite(cap) ? cap : undefined;
}

/**
 * Map `beamId → DERIVED maxWidthMm` για ΟΛΑ τα δοκάρια του graph (mirror `buildBeamSpanModelMap`,
 * entity-aware — χρειάζεται γεωμετρία για την προβολή). Δοκάρια χωρίς εντοπισμένη στήριξη
 * παραλείπονται (απών entry → depth-only στον consumer). Καταναλωτής: ο organism pass (publish
 * `BeamMaxWidthStore`) → `resolveActiveBeamMaxWidthMm`.
 */
export function buildBeamMaxWidthMap(
  graph: StructuralGraph,
  entities: readonly Entity[],
): Map<string, number> {
  const beamById = new Map<string, BeamEntity>();
  const columnById = new Map<string, ColumnEntity>();
  for (const e of entities) {
    if (isBeamEntity(e)) beamById.set(e.id, e);
    else if (isColumnEntity(e)) columnById.set(e.id, e);
  }
  const map = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.memberKind !== 'beam') continue;
    const beam = beamById.get(node.id);
    if (!beam) continue;
    const columns = beamSupportColumnIds(graph, node.id)
      .map((id) => columnById.get(id))
      .filter((c): c is ColumnEntity => c !== undefined);
    const cap = beamMaxWidthMm(beam, columns);
    if (cap !== undefined) map.set(node.id, cap);
  }
  return map;
}
