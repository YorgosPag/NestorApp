'use client';

/**
 * ADR-712 — column→footing continuity **για την επιμέτρηση** (transport adapter).
 *
 * Το `columnBoqEntity` έβλεπε ΜΟΝΟ τη σκηνή του ενεργού ορόφου (`useColumnPersistence`
 * → `levelManager.getLevelScene(currentLevelId)`), ενώ τα πέδιλα ζουν στον όροφο
 * Θεμελίωσης → **κυριολεκτικά αόρατα** στο BOQ feed. Εδώ κλείνει αυτό το κενό: ΕΝΑ σημείο
 * που παράγει `Map<columnId, baseDropMm>` (η κατακόρυφη προέκταση προς το πέδιλο, ADR-489
 * §6.1), το οποίο καταναλώνουν **και οι δύο** διαδρομές επιμέτρησης — το BOQ auto-feed
 * (`useColumnPersistence`) και ο πίνακας Επιμετρήσεων (`BimScheduleDialog`).
 *
 * **Μηδέν νέα λογική ζευγαρώματος (N.0.2)** — αλυσίδα τριών υπαρχόντων SSoT:
 * ```
 *   useFoundationLevelStore  (entities + FFL Θεμελίωσης, ADR-459 Φ0)
 *     → buildOrganismScene   (cross-level merge σε ΑΠΟΛΥΤΟ Z)
 *     → buildStructuralGraph (footing-bearing ακμές)
 *     → buildColumnBaseContinuityMap  (ΑΥΤΟΥΣΙΟ — ο §7.1 αποκλεισμός στοίβας μέσα)
 * ```
 *
 * **⚠️ Γιατί ΔΕΝ επαναλαμβάνει το σφάλμα του ADR-489 §7.** Εκεί ο DERIVED χάρτης παραγόταν
 * σε scope **ενεργού ορόφου** και καταναλωνόταν **καθολικά** (3Δ render, όλοι οι όροφοι) →
 * οι προεκτάσεις έσβηναν σιωπηλά μόλις ο ενεργός όροφος δεν ήταν αυτός με τα πέδιλα. Εδώ
 * παραγωγή και κατανάλωση είναι στο **ΙΔΙΟ** scope: η κολώνα που επιμετράται ανήκει στον
 * ενεργό όροφο, και το ερώτημα «σε ποιο πέδιλο πατά;» απαντιέται από τον ίδιο cross-level
 * graph μέσα στην ίδια κλήση. **Καμία global δημοσίευση** — ο χάρτης χτίζεται on-demand και
 * πεθαίνει μαζί με την κλήση· ΜΗΝ τον μετατρέψεις σε store (ADR-489 §7 «Κανόνας για το
 * `createDerivedMapStore`»).
 *
 * Χωρίς όροφο Θεμελίωσης (`target === null`) → κενός χάρτης → κάθε κολώνα κρατά τη nominal
 * βάση της → **byte-for-byte η προηγούμενη επιμέτρηση**.
 *
 * @see ../../bim/structural/organism/derive-column-base-continuity.ts — το SSoT κριτήριο
 * @see ../../bim/geometry/column-foundation-stub.ts — το σχήμα ποσοτήτων που τρέφει
 * @see docs/centralized-systems/reference/adrs/ADR-712-column-boq-gross-net-foundation-stub.md
 */

import type { Entity } from '../../types/entities';
import { buildStructuralGraph } from '../../bim/structural/organism/organism-checks';
import { buildColumnBaseContinuityMap } from '../../bim/structural/organism/derive-column-base-continuity';
import {
  buildOrganismScene,
  type OrganismSceneInput,
} from '../../bim/structural/organism/cross-level-organism-scene';
import { useFoundationLevelStore } from '../../state/foundation-level-store';

/** Κενός χάρτης — σταθερή αναφορά ώστε οι καταναλωτές να μπορούν να συγκρίνουν φθηνά. */
const EMPTY_DROP_MAP: ReadonlyMap<string, number> = new Map();

/**
 * Pure πυρήνας: cross-level entities → `Map<columnId, baseDropMm>`. Μόνο θετικά drops
 * μπαίνουν στον χάρτη (κολώνα χωρίς έδραση = απούσα, όχι μηδενική) ώστε ο καταναλωτής να
 * έχει καθαρό identity fast-path.
 */
export function buildColumnBaseDropMapFrom(input: OrganismSceneInput): ReadonlyMap<string, number> {
  const merged = buildOrganismScene(input);
  const graph = buildStructuralGraph(merged.entities, {
    floorElevationByEntityId: merged.floorElevationByEntityId,
  });
  const continuity = buildColumnBaseContinuityMap(graph);
  if (continuity.size === 0) return EMPTY_DROP_MAP;

  const baseZById = new Map(graph.nodes.map((n) => [n.id, n.baseZmm]));
  const drops = new Map<string, number>();
  for (const [columnId, effectiveBaseZmm] of continuity) {
    const nominalBaseZmm = baseZById.get(columnId);
    if (nominalBaseZmm === undefined) continue;
    const dropMm = nominalBaseZmm - effectiveBaseZmm;
    if (dropMm > 0) drops.set(columnId, dropMm);
  }
  return drops.size > 0 ? drops : EMPTY_DROP_MAP;
}

/**
 * Store adapter: διαβάζει το τρέχον foundation-level snapshot και παράγει τον χάρτη για τα
 * entities του ενεργού ορόφου. Non-React read (`getState()`) — ίδιο pattern με τον
 * `structural-organism-core`, ADR-040 safe (low-freq store, καμία συνδρομή).
 */
export function buildColumnBaseDropMap(activeEntities: readonly Entity[]): ReadonlyMap<string, number> {
  const fl = useFoundationLevelStore.getState();
  if (!fl.target) return EMPTY_DROP_MAP;
  // ⚠️ ADR-712 — ΤΟ ΚΡΙΣΙΜΟ GUARD (κριτήριο ADR-489 §7.1). Το `footingSupportsColumnBase`
  // δεν έχει μέγιστη κατακόρυφη απόσταση: ένα πέδιλο «στηρίζει» εξίσου την κολώνα του
  // Ισογείου ΚΑΙ του 3ου ορόφου (ίδιο footprint στη στοίβα). Ο 3Δ το φιλτράρει βλέποντας
  // ΟΛΕΣ τις κολώνες της στοίβας· εδώ βλέπουμε **έναν** όροφο, οπότε χωρίς αυτό το guard
  // η κολώνα του 1ου ορόφου θα χρεωνόταν κοντόστυλο 4m — και κάθε υπερκείμενη ακόμη
  // περισσότερο. Το flag το απαντά ο owner (`useFoundationLevelSync`), που ξέρει τη λίστα
  // ορόφων. Fail-closed: undefined/false → καμία χρέωση (η σημερινή συμπεριφορά).
  if (!fl.activeLevelBearsOnFoundation) return EMPTY_DROP_MAP;
  return buildColumnBaseDropMapFrom({
    activeEntities,
    activeFloorElevationMm: fl.activeFloorElevationMm,
    foundationEntities: fl.entities,
    foundationFloorElevationMm: fl.target.floorElevationMm,
  });
}
