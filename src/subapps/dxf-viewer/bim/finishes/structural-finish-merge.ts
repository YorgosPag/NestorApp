/**
 * ADR-449 PART A — Collinear finish-face merge (ενιαία «κουβέρτα» σοβά): pure SSoT.
 *
 * Πρόβλημα: το merged silhouette (`resolveBandFaces`) σπάει μια ΕΥΘΕΙΑ (collinear)
 * περιμετρική όψη σε πολλά `FinishFaceSegment` στις δομικές συμβολές (union output
 * κρατά ενδιάμεσες κορυφές). Δύο συνευθειακά segments μοιράζονται κορυφή → οι offset
 * ευθείες τους είναι παράλληλες → `computeMiteredOuter` δεν βρίσκει τομή (`lineIntersect`
 * = null) → μένουν **ξεχωριστά quads** με κοινή ακμή → ορατή **κάθετη ραφή** (2Δ polyline
 * ανά segment / 3Δ `attachEdgesProjection`). Ο χρήστης θέλει γραμμή ΜΟΝΟ σε αλλαγή
 * διεύθυνσης (γωνία) ή σε αλλαγή υλικού/χρώματος.
 *
 * Λύση: **συγχώνευση διαδοχικών collinear segments** ΠΡΙΝ το miter/draw/extrude. Ένα
 * accumulator pass ενώνει ολόκληρα runs (A+B→AB, μετά AB+C→ABC) + wrap-around στο
 * κλείσιμο του ring. Merge ΜΟΝΟ όταν ίδιο υλικό/ταξινόμηση/πάχος → διαφορετικό υλικό
 * (PART B) ΔΕΝ ενώνεται → καθαρό σύνορο χρώματος. **BOQ αμετάβλητο** (Σ lengthM =
 * αριθμητική ταυτότητα). Pure: μηδέν globals/React/THREE.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §PART A
 */

import type { FinishFaceSegment } from './structural-finish-types';

/** Μοναδιαία κατεύθυνση a→b του segment. `null` αν εκφυλισμένο (μηδενικό μήκος). */
function unitDir(seg: FinishFaceSegment): { x: number; y: number } | null {
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return null;
  return { x: dx / len, y: dy / len };
}

/**
 * True όταν το `next` συνεχίζει collinear το `prev` (prev.b ↔ next.a) με ΙΔΙΟ υλικό.
 * Tolerance κοινής κορυφής = ΑΚΡΙΒΩΣ αυτή του `tryMiterPair` (`computeMiteredOuter`):
 * `1e-6·(1+|v|)`. Παραλληλία μέσω cross-product μοναδιαίων κατευθύνσεων.
 */
function canMerge(prev: FinishFaceSegment, next: FinishFaceSegment): boolean {
  const v = prev.b;
  const tol = 1e-6 * (1 + Math.hypot(v.x, v.y));
  if (Math.hypot(v.x - next.a.x, v.y - next.a.y) > tol) return false; // όχι κοινή κορυφή
  const du = unitDir(prev);
  const dv = unitDir(next);
  if (!du || !dv) return false; // εκφυλισμένο → ποτέ merge
  if (Math.abs(du.x * dv.y - du.y * dv.x) >= 1e-6) return false; // όχι παράλληλα
  return (
    prev.classification === next.classification &&
    prev.materialId === next.materialId &&
    prev.thickness === next.thickness &&
    prev.colorOverride === next.colorOverride
  );
}

/**
 * Merged segment prev.a → next.b: `lengthM` = άθροισμα (BOQ ταυτότητα), κρατά τα
 * `aJunction/aSquareEnd` του prev (start) & `bJunction/bSquareEnd` του next (end). Οι
 * ενδιάμεσες junction/square σημαίες στην κοινή κορυφή είναι ο περιττός split → πέφτουν.
 */
function buildMerged(prev: FinishFaceSegment, next: FinishFaceSegment): FinishFaceSegment {
  return {
    a: prev.a,
    b: next.b,
    classification: prev.classification,
    materialId: prev.materialId,
    thickness: prev.thickness,
    lengthM: prev.lengthM + next.lengthM,
    aJunction: prev.aJunction,
    bJunction: next.bJunction,
    aSquareEnd: prev.aSquareEnd,
    bSquareEnd: next.bSquareEnd,
    colorOverride: prev.colorOverride,
  };
}

/**
 * Συγχωνεύει διαδοχικά collinear-same-material segments σε ενιαίες όψεις. Το array
 * είναι concatenation πολλών rings χωρίς marker (silhouette) → η γειτνίαση είναι
 * θεσιακή εντός ενός ring· ο wrap-around ελέγχεται στο τέλος (last.b ↔ first.a).
 * Δεν αλλάζει γεωμετρία/BOQ — μόνο αφαιρεί περιττά splits.
 */
export function mergeCollinearFinishSegments(
  segments: readonly FinishFaceSegment[],
): FinishFaceSegment[] {
  if (segments.length < 2) return [...segments];
  const out: FinishFaceSegment[] = [];
  for (const seg of segments) {
    const last = out[out.length - 1];
    if (last && canMerge(last, seg)) out[out.length - 1] = buildMerged(last, seg);
    else out.push(seg);
  }
  // Wrap-around: το τελευταίο κλείνει collinear πάνω στο πρώτο (ring-close ραφή).
  if (out.length > 2) {
    const last = out[out.length - 1];
    const first = out[0];
    if (canMerge(last, first)) {
      out[0] = buildMerged(last, first);
      out.pop();
    }
  }
  return out;
}
