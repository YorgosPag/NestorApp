/**
 * Stirrup PATH geometry primitives — pure arc/polyline SSoT (ADR-456, file-size split
 * του `column-rebar-layout.ts`).
 *
 * Καθαρές συναρτήσεις γεωμετρίας μονοπατιού στεφανιού: κλειστή περίμετρος, στρογγυλεμένο
 * (rounded-corner) tessellated path, και το **αναλυτικό** (arc-aware, tessellation-independent)
 * μήκος άξονα. Μοιράζονται από ΟΛΕΣ τις ring engines (rect fast-path, perimeter, multihoop,
 * wall, beam) μέσω re-export από το `column-rebar-layout` (back-compat — μηδέν αλλαγή στους
 * consumers). Ο tessellator ΚΑΙ ο αναλυτικός μετρητής βλέπουν ΤΗΝ ΙΔΙΑ γεωμετρία γωνίας μέσω
 * των κοινών `cornerDirs`/`cornerTurnAngleRad` helpers (big-players split: εμφάνιση ≠ ποσότητα).
 *
 * @see ./column-rebar-layout.ts
 * @see docs/centralized-systems/reference/adrs/ADR-456-structural-quantities-reinforcement.md
 */

import type { Point2D } from '../../../rendering/types/Types';
import { projectVerticesTo2D } from '../../geometry/shared/polygon-utils';

/**
 * Μέγιστο μήκος χορδής (mm) ανά τμήμα τόξου — ο «σφιχτός» έλεγχος ομαλότητας (chord-tolerance,
 * όπως οι μεγάλοι CAD). Ένα τόξο μήκους L παίρνει `ceil(L / chord)` τμήματα (≥ το floor). Μικρές
 * γωνίες συνδετήρα μένουν στο floor· μεγάλες καμπύλες (μεγάλες ακτίνες) πυκνώνουν αυτόματα.
 */
export const STIRRUP_ARC_MAX_CHORD_MM = 4;
/** Ανώτατο όριο τμημάτων/τόξο — φρένο ώστε ένα τεράστιο τόξο να μη γεννά χιλιάδες σημεία. */
export const STIRRUP_ARC_MAX_SEGMENTS = 48;

/** Μήκος **κλειστής** polyline (mm): άθροισμα ακμών + ακμή last→first. <2 σημεία → 0. */
export function closedPolylineLengthMm(path: readonly Point2D[]): number {
  const n = path.length;
  if (n < 2) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = path[i];
    const b = path[(i + 1) % n];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/** Μέτρο διανύσματος· 0 → 1 (αποφυγή διαίρεσης με μηδέν). */
function safeLen(dx: number, dy: number): number {
  return Math.hypot(dx, dy) || 1;
}

/**
 * Μοναδιαίες διευθύνσεις εισερχόμενης (prev→curr) & εξερχόμενης (curr→next) πλευράς σε μια κορυφή.
 * ΕΝΑ SSoT — το μοιράζονται ο tessellator (`buildRoundedStirrupPath`) και ο αναλυτικός μετρητής
 * μήκους (`roundedPathCenterlineLengthMm`) ώστε να «βλέπουν» ΤΗΝ ΙΔΙΑ γεωμετρία γωνίας (N.18).
 */
function cornerDirs(prev: Point2D, curr: Point2D, next: Point2D): {
  inx: number; iny: number; outx: number; outy: number;
} {
  const inLen = safeLen(curr.x - prev.x, curr.y - prev.y);
  const outLen = safeLen(next.x - curr.x, next.y - curr.y);
  return {
    inx: (curr.x - prev.x) / inLen, iny: (curr.y - prev.y) / inLen,
    outx: (next.x - curr.x) / outLen, outy: (next.y - curr.y) / outLen,
  };
}

/** Γωνία → σύντομο ισοδύναμο στο (−π, π] (minor-arc normalization). ΕΝΑ SSoT (N.18). */
function normalizeToPi(a: number): number {
  return ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

/** Signed γωνία στροφής διεύθυνσης σε μια κορυφή (= κεντρική γωνία του εφαπτόμενου τόξου). */
function cornerTurnAngleRad(prev: Point2D, curr: Point2D, next: Point2D): number {
  const { inx, iny, outx, outy } = cornerDirs(prev, curr, next);
  return normalizeToPi(Math.atan2(outy, outx) - Math.atan2(iny, inx));
}

/**
 * Κλειστή tessellated polyline με στρογγυλεμένες γωνίες από πολύγωνο γωνιών (CCW).
 * Κάθε γωνία → τόξο ακτίνας `rMm`, **εφαπτόμενο** στις δύο γειτονικές πλευρές (κέντρο
 * = offset κατά rMm προς το **εσωτερικό της στροφής**). **Concave-aware**: σε κυρτή
 * (αριστερόστροφη) κορυφή το κέντρο πάει αριστερά, σε **reflex** (δεξιόστροφη — π.χ.
 * εσωτερική γωνία διατομής Γ/Τ/Π) το κέντρο γυρίζει δεξιά, ώστε το στεφάνι να
 * στρογγυλεύει σωστά και στα δύο. Τα ευθύγραμμα τμήματα μεταξύ διαδοχικών τόξων
 * προκύπτουν αυτόματα (consumer κάνει lineTo/segment). `rMm` clamped ≤ μισό της
 * κοντύτερης πλευράς. Fallback στις αιχμηρές γωνίες όταν `rMm ≤ 0` ή εκφυλισμένο.
 */
export function buildRoundedStirrupPath(
  corners: readonly Point2D[],
  rMm: number,
  segPerArc: number,
): Point2D[] {
  const n = corners.length;
  if (n < 3 || rMm <= 0) return projectVerticesTo2D(corners);

  // Clamp: η ακτίνα δεν μπορεί να ξεπερνά το μισό της κοντύτερης πλευράς (αλλιώς
  // γειτονικά τόξα επικαλύπτονται).
  let minEdge = Infinity;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    minEdge = Math.min(minEdge, Math.hypot(b.x - a.x, b.y - a.y));
  }
  const r = Math.min(rMm, minEdge / 2);
  if (r <= 0) return projectVerticesTo2D(corners);

  const seg = Math.max(1, Math.floor(segPerArc));
  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = corners[(i - 1 + n) % n];
    const curr = corners[i];
    const next = corners[(i + 1) % n];

    // Μοναδιαία διεύθυνση εισερχόμενης (prev→curr) & εξερχόμενης (curr→next) πλευράς (SSoT helper).
    const { inx, iny, outx, outy } = cornerDirs(prev, curr, next);

    // Σημεία επαφής (tangent) πάνω στις δύο πλευρές, σε απόσταση r από τη γωνία.
    const tInx = curr.x - inx * r;
    const tIny = curr.y - iny * r;
    const tOutx = curr.x + outx * r;
    const tOuty = curr.y + outy * r;

    // Φορά στροφής: cross(in, out) > 0 = αριστερόστροφη (κυρτή σε CCW) → κέντρο
    // αριστερά· < 0 = δεξιόστροφη (reflex/εσωτερική) → κέντρο δεξιά (sgn flip).
    const cross = inx * outy - iny * outx;
    const sgn = cross >= 0 ? 1 : -1;
    // Κέντρο τόξου = tangent + κάθετο (αριστερά της φοράς) × r × sgn.
    const cx = tInx + -iny * r * sgn;
    const cy = tIny + inx * r * sgn;

    const a0 = Math.atan2(tIny - cy, tInx - cx);
    const a1 = Math.atan2(tOuty - cy, tOutx - cx);
    const da = normalizeToPi(a1 - a0); // σύντομο τόξο (minor)

    // Adaptive (chord-tolerance, big-CAD πρακτική): πύκνωσε ώστε η χορδή ≤ STIRRUP_ARC_MAX_CHORD_MM
    // → ομαλή καμπύλη κάθε ακτίνας. Floor = `seg`, cap = STIRRUP_ARC_MAX_SEGMENTS. Καθαρά ΟΠΤΙΚΟ:
    // το μήκος/βάρος υπολογίζεται αναλυτικά (`roundedPathCenterlineLengthMm`), όχι από εδώ.
    const segK = Math.min(
      STIRRUP_ARC_MAX_SEGMENTS,
      Math.max(seg, Math.ceil((r * Math.abs(da)) / STIRRUP_ARC_MAX_CHORD_MM)),
    );
    for (let k = 0; k <= segK; k++) {
      const a = a0 + (da * k) / segK;
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return out;
}

/**
 * **Αναλυτικό** μήκος ΑΞΟΝΑ (centerline, mm) του στρογγυλεμένου path — arc-aware, **ανεξάρτητο από
 * το tessellation** (`segPerArc`). Το SSoT «geometry truth» για τις ΠΟΣΟΤΗΤΕΣ κάθε σχήματος (rect
 * closed-form = ειδική περίπτωση αυτού): μιμείται ΑΚΡΙΒΩΣ το `buildRoundedStirrupPath` (ίδιο clamp
 * ακτίνας, ίδιο turn-angle da ανά γωνία) αλλά μετρά **Σ ευθύγραμμα (περίμετρος − 2r·n) + Σ τόξα
 * (r·|da|)** αντί για χορδές. Το display polyline (πεπερασμένες χορδές) υπο-εκτιμά → γι' αυτό ΠΟΤΕ
 * δεν μετριέται το display για βάρη χάλυβα (big-players split: εμφάνιση ≠ ποσότητα). LOCAL mm.
 */
export function roundedPathCenterlineLengthMm(corners: readonly Point2D[], rMm: number): number {
  const n = corners.length;
  if (n < 3) return closedPolylineLengthMm(corners);

  let minEdge = Infinity;
  let perimeter = 0;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const e = Math.hypot(b.x - a.x, b.y - a.y);
    perimeter += e;
    minEdge = Math.min(minEdge, e);
  }
  const r = Math.min(rMm, minEdge / 2);
  if (r <= 0) return perimeter; // αιχμηρές γωνίες → σκέτη περίμετρος (ίδιο fallback με τον generator)

  let arcTotal = 0;
  for (let i = 0; i < n; i++) {
    // μήκος τόξου = r·|turn angle|· ίδιος helper με τον tessellator → ίδια γεωμετρία γωνίας
    arcTotal += Math.abs(cornerTurnAngleRad(
      corners[(i - 1 + n) % n], corners[i], corners[(i + 1) % n],
    ));
  }
  // Ευθύγραμμα: κάθε γωνία «τρώει» r από κάθε γειτονική πλευρά → περίμετρος − 2r·n. Τόξα: r·Σ|da|.
  return Math.max(0, perimeter - 2 * r * n) + r * arcTotal;
}
