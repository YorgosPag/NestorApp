/**
 * Beam support condition — DERIVED-from-connectivity SSoT (ADR-486).
 *
 * Λύνει τη **διπλή αλήθεια** στήριξης δοκαριού: ο analytical/FEM φορέας (ADR-480/481)
 * παράγει στήριξη από τη ζωντανή τοπολογία, ενώ ο tributary οπλισμός (ADR-471/472)
 * διάβαζε το αποθηκευμένο `params.supportType` → απέκλιναν (πρόβολος έπαιρνε λάθος
 * `wL²/8` αντί `wL²/2`). Εδώ ζει η ΜΙΑ πηγή αλήθειας που ρωτούν ΚΑΙ οι δύο:
 *
 *   `resolveBeamSupportCondition(graph, beamId, stored)` → ο τύπος στήριξης που
 *   προκύπτει από το πλήθος `column-bearing` ακμών (reuse `beamSupportColumnIds`):
 *     · count === 1 → **'cantilever'** (πρόβολος: ένα άκρο σε moment-frame κόμβο,
 *                     το άλλο ελεύθερο — η ΜΟΝΗ περίπτωση που αλλάζει συμπεριφορά).
 *     · count !== 1 → ο αποθηκευμένος τύπος (`stored ?? 'simple'`) — μηδέν regression
 *                     σε αμφιέρειστα/αμφίπακτα (2+ στηρίξεις) και σε υπό-σχεδίαση
 *                     (0 στηρίξεις → καλύπτεται από τα analytical diagnostics, ADR-480).
 *
 * **Συντηρητικό by design:** μόνο το «ακριβώς 1 στήριξη» γίνεται πρόβολος. Το `stored`
 * 'fixed'/'cantilever' (ρητή πρόθεση χρήστη) διατηρείται όταν 2+ στηρίξεις.
 *
 * **Παραδοχή scope (v1):** στήριξη δοκαριού = ΜΟΝΟ κολώνες (`column-bearing`). Οι τοίχοι
 * είναι **φορτίο** πάνω στο δοκάρι (`wall-beam-support`), όχι έδραση· beam-on-wall /
 * beam-on-beam έδραση = DEFER (συνεπές με τον analytical builder που merge-άρει άκρα
 * δοκαριού ΜΟΝΟ σε κορυφές κολώνας).
 *
 * Pure — zero React/DOM/Firestore· δουλεύει αμιγώς πάνω στον DERIVED graph.
 *
 * @see ../loads/load-path-walk.ts — beamSupportColumnIds (το SSoT μετρητή στήριξης)
 * @see ./structural-graph.ts — ο node.supportType φέρει ήδη το stored intent
 * @see ../section-context.ts — ο καταναλωτής (buildBeamSectionContext supportType override)
 * @see docs/centralized-systems/reference/adrs/ADR-486-topology-aware-beam-support.md
 */

import type { BeamSupportType } from '../../types/beam-types';
import { beamSupportColumnIds } from '../loads/load-path-walk';
import type { StructuralGraph } from './structural-organism-types';

/** Η DERIVED συνθήκη στήριξης ενός δοκαριού. */
export interface BeamSupportCondition {
  /** Ο τύπος στήριξης που πρέπει να οδηγεί ροπές/οπλισμό ΤΩΡΑ (topology-aware). */
  readonly supportType: BeamSupportType;
  /** Πλήθος κολωνών που στηρίζουν το δοκάρι (live `column-bearing` ακμές). */
  readonly supportCount: number;
  /** Ευσταθές; (≥1 στήριξη = προσβάσιμο σε moment-frame κόμβο· 0 = μηχανισμός). */
  readonly stable: boolean;
}

/**
 * DERIVED συνθήκη στήριξης ενός δοκαριού από τη ζωντανή τοπολογία. `storedType` =
 * η ρητή πρόθεση χρήστη (`params.supportType`)· διατηρείται όταν 2+ στηρίξεις.
 */
export function resolveBeamSupportCondition(
  graph: StructuralGraph,
  beamId: string,
  storedType: BeamSupportType | undefined,
): BeamSupportCondition {
  const supportCount = beamSupportColumnIds(graph, beamId).length;
  const fallback: BeamSupportType = storedType ?? 'simple';
  const supportType: BeamSupportType = supportCount === 1 ? 'cantilever' : fallback;
  return { supportType, supportCount, stable: supportCount >= 1 };
}

/**
 * Map `beamId → DERIVED supportType` για ΟΛΑ τα δοκάρια του graph. Το graph node του
 * δοκαριού φέρει ήδη το stored `supportType` (structural-graph), οπότε δεν χρειάζονται
 * entities — pure graph-only. Καταναλωτές: ο organism pass (publish store) + ο
 * auto-reinforce core (override patch) + τα reinforcement checks.
 */
export function buildBeamSupportTypeMap(graph: StructuralGraph): Map<string, BeamSupportType> {
  const map = new Map<string, BeamSupportType>();
  for (const node of graph.nodes) {
    if (node.memberKind !== 'beam') continue;
    map.set(node.id, resolveBeamSupportCondition(graph, node.id, node.supportType).supportType);
  }
  return map;
}
