/**
 * ADR-441 Slice 7 — Live **grid-target** ghost footprints (split-aware, pure).
 *
 * Το Slice 3-perf ghost (`deriveFollowGhostFootprints`) δείχνει coordinate-follow
 * ΜΟΝΟ: οι hosted λωρίδες ακολουθούν τον οδηγό αλλά **η τοπολογία δεν αλλάζει** (καμία
 * προεπισκόπηση split/reflow όσο σύρεται). Εδώ, για live (B) follow-move, δίνουμε τα
 * footprints της **πλήρους σωστής εσχάρας** για τα τρέχοντα guide offsets — δηλαδή
 * ακριβώς ό,τι θα κλειδώσει το auto-«Εσχάρα» στο release: split-on-cross + inward
 * γωνίες, ζωντανά μπροστά στα μάτια του μηχανικού (Revit associative grid).
 *
 * SSoT: thin wrapper πάνω στον ΥΠΑΡΧΟΝΤΑ `buildStripGridFromGuides` (ίδιος builder με
 * το committed path) → τα ghost footprints είναι **pixel-identical** με αυτά που θα
 * γραφτούν στο commit → seamless handoff, μηδέν flash. Pure / side-effect free (τα
 * παραγόμενα entities/ids είναι throwaway, ποτέ δεν persist-άρονται). RAF-coalesced
 * 1×/frame από το overlay.
 *
 * @see ./foundation-from-grid.ts — buildStripGridFromGuides (SSoT target builder)
 * @see ../hosting/guide-follow-ghost.ts — FollowGhostFootprint + coordinate-follow path
 * @see ../../components/dxf-layout/GuideFollowGhostOverlay.tsx — overlay consumer
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import { buildStripGridFromGuides, type AxisGuideReader } from './foundation-from-grid';
import type { FollowGhostFootprint } from '../hosting/guide-follow-ghost';
import type { FoundationParamOverrides, SceneUnits } from '../../hooks/drawing/foundation-completion';

/**
 * Footprints της live target εσχάρας από τα τρέχοντα (ζωντανά) guide offsets. Άδειο
 * array όταν λείπουν άξονες (<2 ανά διεύθυνση) → ο caller κάνει fallback σε
 * coordinate-follow. Το geometry βγαίνει από τον SSoT builder → ίδιο με το commit.
 */
export function deriveGridFollowGhostFootprints(
  reader: AxisGuideReader,
  overrides: FoundationParamOverrides,
  levelId: string,
  sceneUnits: SceneUnits,
): FollowGhostFootprint[] {
  const result = buildStripGridFromGuides(reader, overrides, levelId, sceneUnits);
  if (!result.ok) return [];
  return result.strips.map((s) => ({
    id: s.id,
    vertices: s.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y })),
  }));
}
