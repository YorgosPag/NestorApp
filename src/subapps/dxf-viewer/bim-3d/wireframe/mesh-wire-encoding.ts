/**
 * mesh-wire-encoding — τι ταξιδεύει ανά κορυφή, και η μαθηματική που το διαβάζει (ADR-689 Φ3).
 *
 * ## Η ιδέα: βαρυκεντρικές συντεταγμένες
 *
 * Δίνοντας στις τρεις κορυφές κάθε τριγώνου τα διανύσματα (1,0,0), (0,1,0), (0,0,1), η κάρτα
 * γραφικών παρεμβάλλει για κάθε pixel τη **βαρυκεντρική** του θέση. Η συνιστώσα `b[i]` είναι 1 στην
 * κορυφή `i` και **ακριβώς 0 πάνω στην απέναντι ακμή** — άρα το `min(b)` ΕΙΝΑΙ η απόσταση του pixel
 * από την πλησιέστερη ακμή. Έτσι το wireframe ζωγραφίζεται μέσα στο ίδιο pass των επιφανειών:
 * μηδέν επιπλέον γεωμετρία, μηδέν επιπλέον draw call.
 *
 * ## Γιατί ΕΝΑ float και όχι δύο `vec3`
 *
 * Ο αφελής τρόπος στέλνει `vec3 aBary` + `vec3 aEdgeMask` = **24 bytes ανά κορυφή**. Και τα δύο όμως
 * είναι διακριτά: η βαρυκεντρική είναι μία από τρεις σταθερές (ποια γωνία του τριγώνου είναι αυτή η
 * κορυφή), και η μάσκα είναι 3 bits **κοινά** στις τρεις κορυφές. Χωρούν σε έναν ακέραιο 0..31, που
 * ταξιδεύει ως **ένα float = 4 bytes ανά κορυφή** (`aWireCode`) και αποκωδικοποιείται στο vertex
 * shader. Σε πλέγμα 500k τριγώνων αυτό είναι ~6 MB αντί για ~36 MB.
 *
 * ## Ακμές vs βαρυκεντρικές συνιστώσες — η αναδιάταξη γίνεται ΕΔΩ
 *
 * Η «ακμή `e`» του {@link ./mesh-wire-adjacency} είναι η (κορυφή `e` → κορυφή `e+1`), δηλαδή η
 * **απέναντι** από την κορυφή `(e+2)%3`. Η βαρυκεντρική συνιστώσα `i` μηδενίζεται στην ακμή που
 * είναι απέναντι από την κορυφή `i`, δηλαδή στην ακμή `(i+1)%3`. Για να μη χρειάζεται ο shader να
 * κάνει αυτή τη μετάθεση σε **κάθε pixel**, την κάνουμε μία φορά εδώ στη CPU: αποθηκεύουμε
 * **component mask** («η ακμή που μηδενίζει τη συνιστώσα `i` είναι ορατή»), όχι edge mask.
 *
 * @see ./mesh-wire-adjacency — ποιες ακμές είναι πραγματικές
 * @see ./mesh-wire-shader — ο GLSL που διαβάζει το `aWireCode`
 */

import type { MeshWireMode } from '../../config/bim-visual-style';
import {
  computeTriangleEdgeMasks,
  EDGE_MASK_ALL,
  TRIANGLE_CORNERS,
} from './mesh-wire-adjacency';

/** Το όνομα του vertex attribute — ένα float ανά κορυφή. Κοινό CPU/GLSL κλειδί. */
export const WIRE_CODE_ATTRIBUTE = 'aWireCode';

/** Πλάτος του πεδίου «γωνία» μέσα στον κωδικό (0..2 χωρούν σε 2 bits → πολλαπλασιαστής 4). */
export const WIRE_CORNER_RADIX = 4;

/**
 * Ποινή απόστασης για ακμή που ΔΕΝ δείχνεται. Οι αποστάσεις είναι σε pixels, οπότε μια τιμή πολύ
 * μεγαλύτερη από κάθε ρεαλιστική διάσταση οθόνης εγγυάται ότι η κρυφή ακμή δεν κερδίζει ποτέ το
 * `min` — χωρίς branching στον shader.
 */
export const WIRE_HIDDEN_EDGE_PENALTY_PX = 1e6;

/** Πλάτος της ζώνης εξομάλυνσης (pixels) στην εσωτερική παρειά της γραμμής. */
export const WIRE_ANTIALIAS_PX = 1;

/**
 * Edge mask («η ακμή `e` δείχνεται») → component mask («η ακμή που μηδενίζει τη συνιστώσα `i`
 * δείχνεται»). Δηλαδή bit `i` του αποτελέσματος = bit `(i+1)%3` της εισόδου. Δες την επεξήγηση
 * αναδιάταξης στο πάνω μέρος του αρχείου.
 */
export function edgeMaskToComponentMask(edgeMask: number): number {
  let component = 0;
  for (let i = 0; i < TRIANGLE_CORNERS; i++) {
    if (edgeMask & (1 << ((i + 1) % TRIANGLE_CORNERS))) component |= 1 << i;
  }
  return component;
}

/** Πακετάρει γωνία (0..2) + component mask (0..7) σε έναν κωδικό 0..31. */
export function encodeWireCode(corner: number, componentMask: number): number {
  return corner + WIRE_CORNER_RADIX * componentMask;
}

/** Ο αντίστροφος του {@link encodeWireCode} (ο shader κάνει το ίδιο με `mod`/`floor`). */
export function decodeWireCode(code: number): { corner: number; componentMask: number } {
  return {
    corner: code % WIRE_CORNER_RADIX,
    componentMask: Math.floor(code / WIRE_CORNER_RADIX),
  };
}

/**
 * Ο κωδικός κάθε κορυφής ενός **non-indexed** πλέγματος (ένα float ανά κορυφή, έτοιμο για
 * `Float32BufferAttribute`).
 *
 * @param positions non-indexed θέσεις (9 floats ανά τρίγωνο)
 * @param mode `'feature'` → μόνο πραγματικές ακμές (crease/σύνορα)· `'full'` → κάθε τριγωνάκι
 * @param thresholdDeg κατώφλι δίεδρης γωνίας (αγνοείται στο `'full'`)
 */
export function computeWireCodes(
  positions: ArrayLike<number>,
  mode: MeshWireMode,
  thresholdDeg: number,
): Float32Array {
  const vertexCount = Math.floor(positions.length / 3);
  const codes = new Float32Array(vertexCount);
  const triangleCount = Math.floor(vertexCount / TRIANGLE_CORNERS);
  // Στο 'full' καμία ακμή δεν κρύβεται, άρα η ανάλυση γειτονίας παραλείπεται εντελώς.
  const edgeMasks = mode === 'full' ? null : computeTriangleEdgeMasks(positions, thresholdDeg);

  for (let tri = 0; tri < triangleCount; tri++) {
    const componentMask = edgeMaskToComponentMask(edgeMasks ? edgeMasks[tri]! : EDGE_MASK_ALL);
    const base = tri * TRIANGLE_CORNERS;
    for (let corner = 0; corner < TRIANGLE_CORNERS; corner++) {
      codes[base + corner] = encodeWireCode(corner, componentMask);
    }
  }
  return codes;
}

/**
 * **Ο καθρέφτης του fragment shader σε JS** — η ίδια μαθηματική που τρέχει ανά pixel, εκτεθειμένη
 * ώστε να ελέγχεται από unit test χωρίς GL context (το ίδιο πρότυπο με το
 * `projectedEmPixelHeight` του `glyph-atlas-text-lod`). Κάθε αλλαγή εδώ πρέπει να καθρεφτίζεται στο
 * {@link ./mesh-wire-shader} και αντίστροφα.
 *
 * @param bary οι τρεις βαρυκεντρικές συντεταγμένες του pixel
 * @param derivatives το `fwidth` κάθε συνιστώσας (πόσο αλλάζει ανά pixel)
 * @param componentMask ποιες συνιστώσες αντιστοιχούν σε ορατή ακμή
 * @param widthPx πάχος γραμμής σε pixels (ήδη πολλαπλασιασμένο με το DPR)
 * @returns κάλυψη 0..1 — 1 πάνω στην ακμή, 0 στο εσωτερικό της όψης
 */
export function wireEdgeAlpha(
  bary: readonly [number, number, number],
  derivatives: readonly [number, number, number],
  componentMask: number,
  widthPx: number,
): number {
  let nearestPx = WIRE_HIDDEN_EDGE_PENALTY_PX;
  for (let i = 0; i < TRIANGLE_CORNERS; i++) {
    if (!(componentMask & (1 << i))) continue;
    const deriv = derivatives[i] ?? 0;
    // Μηδενική παράγωγος = εκφυλισμένο ή απόλυτα κάθετο τρίγωνο· καμία μετρήσιμη απόσταση.
    const distancePx = deriv > 0 ? (bary[i] ?? 0) / deriv : WIRE_HIDDEN_EDGE_PENALTY_PX;
    if (distancePx < nearestPx) nearestPx = distancePx;
  }
  return 1 - smoothstep(widthPx - WIRE_ANTIALIAS_PX, widthPx, nearestPx);
}

/** Το `smoothstep` του GLSL (Hermite), ώστε ο καθρέφτης να συμφωνεί bit προς bit στη μορφή. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge1 <= edge0) return x < edge1 ? 0 : 1;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
