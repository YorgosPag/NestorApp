/**
 * Column→footing base continuity — DERIVED-from-connectivity SSoT (ADR-489 §6.1).
 *
 * Λύνει το «κενό κολώνα ↔ πέδιλο» (ADR-487 §6.1): η κολώνα ισογείου έχει βάση στο
 * FFL της (z=0) ενώ το πέδιλό της κάθεται στον όροφο Θεμελίωσης (άνω παρειά ≈ −1000mm)
 * → οπτικό κενό ~1m, καμία στατική συνέχεια. Εδώ ζει η ΜΙΑ πηγή αλήθειας που λέει
 * «πόσο χαμηλά πρέπει να κατέβει η βάση της κάθε κολώνας ώστε να εδραστεί στο πέδιλό της»:
 *
 *   `buildColumnBaseContinuityMap(graph)` → `Map<columnId, effectiveBaseZmm>` (απόλυτο mm)
 *
 * **Μηδέν διπλή λογική ζευγαρώματος (N.0.2):** ΔΕΝ ξανα-ζευγαρώνουμε κολώνα↔πέδιλο εδώ —
 * διαβάζουμε αυτούσιες τις `footing-bearing` ακμές που ΗΔΗ παράγει ο `buildStructuralGraph`
 * (explicit-FK-wins + spatial `footingSupportsColumnBase`, cross-level absolute Z). Η βάση
 * της κολώνας γίνεται η **άνω παρειά** (`topZmm`) του πεδίλου που τη στηρίζει.
 *
 * **Συντηρητικό by design:**
 *   · Μόνο **προς τα κάτω** (`footing.topZmm < column.baseZmm`) — ποτέ δεν ανεβάζει κολώνα.
 *   · Πολλαπλά πέδιλα στην ίδια κολώνα → το **βαθύτερο** (`min topZmm`) ώστε η κολώνα να
 *     εδράζεται στο πραγματικό πέδιλο (pad −1000), όχι στη συνδετήρια (tie-beam −500).
 *   · **ΜΟΝΟ η χαμηλότερη κολώνα κάθε πεδίλου** (ADR-489 §7) — βλ. παρακάτω.
 *   · Καμία έδραση → κανένα entry → ο render path κρατά τη nominal βάση (byte-for-byte παλιό).
 *
 * **⚠️ Γιατί «η χαμηλότερη κολώνα ανά πέδιλο» (ADR-489 §7):** το SSoT κριτήριο
 * `footingSupportsColumnBase` είναι **μονόπλευρο** — απαιτεί μόνο «άνω παρειά πεδίλου ΟΧΙ
 * ψηλότερα από τη βάση της κολώνας», χωρίς ΚΑΜΙΑ μέγιστη κατακόρυφη απόσταση. Όσο ο graph
 * έβλεπε έναν όροφο τη φορά αυτό ήταν αβλαβές· μόλις όμως χτίζεται πάνω σε ΟΛΟΥΣ τους
 * ορόφους (per-stack), κάθε κολώνα κάθε ορόφου που στέκεται στο plan πάνω από πέδιλο
 * παίρνει `footing-bearing` ακμή → η κολώνα του 3ου ορόφου θα «κατέβαινε» 10m ως τη
 * θεμελίωση. Στατικά, η συνέχεια κολώνα→πέδιλο αφορά **την κολώνα που πατά πάνω του**,
 * δηλαδή τη χαμηλότερη· οι υπερκείμενες πατούν σε δοκό/πλάκα και κρατούν τη nominal βάση
 * τους. Το φιλτράρισμα γίνεται ΕΔΩ και ΟΧΙ στο `footingSupportsColumnBase`, γιατί εκείνο
 * το κριτήριο το μοιράζονται ο graph + ο explicit-FK auto-attach coordinator, όπου η
 * «στηρίζει;» ερώτηση είναι διαφορετική (ADR-459 Φ2).
 *
 * **DERIVED, ΠΟΤΕ persisted** (όπως ο graph): η αλήθεια ζει στην τοπολογία/πέδιλα· εδώ είναι
 * παράγωγο cache. Re-derived σε κάθε 3Δ multi-floor sync, ώστε όταν αλλάζει το βάθος
 * θεμελίωσης (ADR-489 §6.2) η κολώνα να ακολουθεί αυτόματα.
 *
 * **ΠΟΙΟΣ ΤΟ ΚΑΛΕΙ (ADR-489 §7):** ΜΟΝΟ ο `BimSceneLayer.syncMultiFloor`, με graph χτισμένο
 * πάνω σε ΟΛΟΥΣ τους ορόφους του stack (absolute Z). ΜΗΝ το ξανασυνδέσεις σε per-level pass
 * (π.χ. τον organism του ενεργού ορόφου) και ΜΗΝ το μεταφέρεις σε global store: ο χάρτης
 * πρέπει να καλύπτει κάθε όροφο που σχεδιάζεται, αλλιώς οι προεκτάσεις εξαφανίζονται σιωπηλά
 * μόλις ο ενεργός όροφος πάψει να είναι αυτός με τα πέδιλα.
 *
 * Pure — zero React/DOM/Firestore· δουλεύει αμιγώς πάνω στον DERIVED graph.
 *
 * @see ./structural-graph.ts — buildFootingEdges (η πηγή των footing-bearing ακμών)
 * @see ../../../bim-3d/scene/BimSceneLayer.ts — ο μοναδικός καλών (syncMultiFloor)
 * @see docs/centralized-systems/reference/adrs/ADR-489-column-footing-continuity-dynamic-foundation-depth.md
 */

import { isPointInPolygon } from '../../../utils/geometry/GeometryUtils';
import { polygonCentroid } from '../../foundations/footing-column-coverage';
import type { StructuralGraph, StructuralNode } from './structural-organism-types';

/** mm. Slack ώστε «ίδιο επίπεδο» πέδιλο/βάση να ΜΗΝ μετράει ως κατέβασμα (no-op). */
const CONTINUITY_Z_EPS_MM = 1;

/**
 * Ίδια κατακόρυφη στοίβα: το plan-centroid της βάσης της `upper` πέφτει μέσα στο
 * footprint της `lower`. Ίδιο plan-coverage κριτήριο με το `footingSupportsColumnBase`
 * (SSoT) — εδώ εφαρμοσμένο κολώνα→κολώνα αντί πέδιλο→κολώνα.
 */
function sharesPlanStack(lower: StructuralNode, upper: StructuralNode): boolean {
  const lowerPoly = lower.footprint;
  const upperPoly = upper.footprint;
  if (!lowerPoly || lowerPoly.length < 3 || !upperPoly || upperPoly.length < 3) return false;
  return isPointInPolygon(polygonCentroid(upperPoly), [...lowerPoly]);
}

/**
 * True αν ΑΛΛΗ κολώνα του ίδιου πεδίλου κάθεται χαμηλότερα στην ΙΔΙΑ στοίβα — τότε η
 * `column` πατά σε ΕΚΕΙΝΗ, όχι στο πέδιλο (ADR-489 §7.1).
 */
function hasLowerColumnInSameStack(column: StructuralNode, siblings: readonly StructuralNode[]): boolean {
  return siblings.some((s) =>
    s.id !== column.id
    && s.baseZmm < column.baseZmm - CONTINUITY_Z_EPS_MM
    && sharesPlanStack(s, column));
}

/**
 * Map `columnId → effectiveBaseZmm` (απόλυτο mm = άνω παρειά του στηρίζοντος πεδίλου)
 * για ΟΛΕΣ τις κολώνες που εδράζονται σε πέδιλο χαμηλότερα από τη nominal βάση τους.
 * Παράγεται αμιγώς από τις `footing-bearing` ακμές του graph (μηδέν re-pairing).
 */
export function buildColumnBaseContinuityMap(graph: StructuralGraph): Map<string, number> {
  const nodeById = new Map<string, StructuralNode>(graph.nodes.map((n) => [n.id, n]));
  const out = new Map<string, number>();

  // Πάσο 1 — έγκυρα ζεύγη (πέδιλο ΧΑΜΗΛΟΤΕΡΑ από τη βάση) + οι κολώνες κάθε πεδίλου.
  const pairs: { readonly footing: StructuralNode; readonly column: StructuralNode }[] = [];
  const columnsByFooting = new Map<string, StructuralNode[]>();
  for (const edge of graph.edges) {
    if (edge.kind !== 'footing-bearing') continue;
    const footing = nodeById.get(edge.supportId);
    const column = nodeById.get(edge.supportedId);
    if (!footing || !column) continue;

    // Μόνο προς τα κάτω: το πέδιλο πρέπει να είναι χαμηλότερα από τη βάση της κολώνας.
    if (footing.topZmm >= column.baseZmm - CONTINUITY_Z_EPS_MM) continue;

    pairs.push({ footing, column });
    const siblings = columnsByFooting.get(footing.id);
    if (siblings) siblings.push(column);
    else columnsByFooting.set(footing.id, [column]);
  }

  // Πάσο 2 — κατεβαίνει μόνο η κολώνα που ΠΑΤΑ στο πέδιλο. Κριτήριο αποκλεισμού είναι η
  // **κατακόρυφη στοίβα**, ΟΧΙ το «χαμηλότερη του πεδίλου»: μια πεδιλοδοκός/εδαφόπλακα
  // στηρίζει ΠΟΛΛΕΣ κολώνες σε διαφορετικές θέσεις plan (και ενδεχομένως υψόμετρα) — όλες
  // τους εδράζονται. Αποκλείεται μόνο η κολώνα που έχει ΑΛΛΗ κολώνα χαμηλότερα στην ίδια
  // στοίβα (υπερκείμενος όροφος): εκείνη πατά στην από κάτω της, όχι στο πέδιλο.
  for (const { footing, column } of pairs) {
    if (hasLowerColumnInSameStack(column, columnsByFooting.get(footing.id) ?? [])) continue;

    // Βαθύτερο πέδιλο νικά (pad −1000 αντί tie-beam −500) → min topZmm.
    const prev = out.get(column.id);
    if (prev === undefined || footing.topZmm < prev) out.set(column.id, footing.topZmm);
  }

  return out;
}
