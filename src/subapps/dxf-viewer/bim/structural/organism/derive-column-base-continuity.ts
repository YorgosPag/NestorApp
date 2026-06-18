/**
 * Column→footing base continuity — DERIVED-from-connectivity SSoT (ADR-488).
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
 *   · Καμία έδραση → κανένα entry → ο render path κρατά τη nominal βάση (byte-for-byte παλιό).
 *
 * **DERIVED, ΠΟΤΕ persisted** (όπως ο graph): η αλήθεια ζει στην τοπολογία/πέδιλα· εδώ είναι
 * παράγωγο cache. Re-derived σε κάθε structural αλλαγή (organism pass), ώστε όταν αλλάζει το
 * βάθος θεμελίωσης (ADR-488 §6.2) η κολώνα να ακολουθεί αυτόματα.
 *
 * Pure — zero React/DOM/Firestore· δουλεύει αμιγώς πάνω στον DERIVED graph.
 *
 * @see ./structural-graph.ts — buildFootingEdges (η πηγή των footing-bearing ακμών)
 * @see ./column-base-continuity-store.ts — το transient transport προς το render path
 * @see ../../../hooks/useStructuralOrganism.ts — ο writer (organism pass)
 * @see docs/centralized-systems/reference/adrs/ADR-488-column-footing-continuity-dynamic-foundation-depth.md
 */

import type { StructuralGraph, StructuralNode } from './structural-organism-types';

/** mm. Slack ώστε «ίδιο επίπεδο» πέδιλο/βάση να ΜΗΝ μετράει ως κατέβασμα (no-op). */
const CONTINUITY_Z_EPS_MM = 1;

/**
 * Map `columnId → effectiveBaseZmm` (απόλυτο mm = άνω παρειά του στηρίζοντος πεδίλου)
 * για ΟΛΕΣ τις κολώνες που εδράζονται σε πέδιλο χαμηλότερα από τη nominal βάση τους.
 * Παράγεται αμιγώς από τις `footing-bearing` ακμές του graph (μηδέν re-pairing).
 */
export function buildColumnBaseContinuityMap(graph: StructuralGraph): Map<string, number> {
  const nodeById = new Map<string, StructuralNode>(graph.nodes.map((n) => [n.id, n]));
  const out = new Map<string, number>();

  for (const edge of graph.edges) {
    if (edge.kind !== 'footing-bearing') continue;
    const footing = nodeById.get(edge.supportId);
    const column = nodeById.get(edge.supportedId);
    if (!footing || !column) continue;

    // Μόνο προς τα κάτω: το πέδιλο πρέπει να είναι χαμηλότερα από τη βάση της κολώνας.
    if (footing.topZmm >= column.baseZmm - CONTINUITY_Z_EPS_MM) continue;

    // Βαθύτερο πέδιλο νικά (pad −1000 αντί tie-beam −500) → min topZmm.
    const prev = out.get(column.id);
    if (prev === undefined || footing.topZmm < prev) out.set(column.id, footing.topZmm);
  }

  return out;
}
