/**
 * Polyline / polygon offset-with-mitre helpers (pure SSoT, N.0.2 / N.12).
 *
 * Extracted from `polygon-utils.ts` (N.7.1 500-line cap). Re-exported από εκεί
 * ώστε όλοι οι υπάρχοντες importers να δουλεύουν αμετάβλητοι.
 *
 * Canonical polyline-offset math, extracted from `wall-geometry.ts` and
 * `beam-geometry.ts` (verbatim duplicate before this SSoT). Consumed by walls
 * (axis → outer/inner edge), beams (axis → outline rect) and ADR-396 envelope
 * perimeter (exterior face → insulation outer loop).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.5
 */

import type { PlanarPoint, BimPoint } from '../../types/bim-base';
import { polygonArea, projectVerticesTo2D, shoelaceArea } from './polygon-utils';
import { offsetPolyline } from '../../../rendering/entities/shared/geometry-offset-utils';

/** Below this segment length (mm/canvas) a segment is treated as degenerate. */
const DEGENERATE_LENGTH_EPS = 0.001;

/**
 * CCW 90° μοναδιαία **κάθετος** ακμής (στροφή της εφαπτομένης (dx,dy) → (-dy,dx)).
 * `null` για εκφυλισμένο (σχεδόν μηδενικού μήκους) τμήμα.
 *
 * ⚠️ ADR-789 / CHECK 3.28 — ΜΙΑ συνάρτηση, όχι ζεύγος `…X`/`…Y`. Το ζεύγος ήταν
 * **δύο ονόματα για έναν υπολογισμό** και ο κλώνος ήταν μετρήσιμος (58 tokens):
 * κάθε καλών πλήρωνε **δύο** `Math.hypot` για το ίδιο τμήμα, και ο δεύτερος έλεγχος
 * εκφυλισμού μπορούσε να αποκλίνει από τον πρώτο χωρίς κανένα σήμα.
 */
export function segmentNormal(a: PlanarPoint, b: PlanarPoint): PlanarPoint | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < DEGENERATE_LENGTH_EPS) return null;
  return { x: -dy / len, y: dx / len };
}

/**
 * **Κάθετος κορυφής** — μέσος όρος των κάθετων των γειτονικών ακμών (CCW 90°).
 *
 * `closed = false` (ανοιχτή polyline): οι ακραίες κορυφές χρησιμοποιούν τη ΜΙΑ γειτονική
 * τους ακμή (τοίχοι/δοκοί — τα ελεύθερα άκρα κόβονται ίσια, χωρίς φαλτσογωνιά).
 *
 * `closed = true` (δακτύλιος): **ΚΑΘΕ** κορυφή — μαζί με την 0 και την n-1 — παίρνει τον
 * μέσο όρο **ΚΑΙ ΤΩΝ ΔΥΟ** γειτονικών ακμών με wrap-around. Χωρίς αυτό, η κορυφή της
 * ραφής μετατοπίζεται κάθετα σε μία μόνο ακμή και η γωνία σπάει σε διαγώνιο σκαλοπάτι
 * μήκους `distance` (ADR-396 insulation-loop + Z4 reveal-frame bug).
 *
 * Οι εκφυλισμένες ακμές παραλείπονται. Ο μέσος όρος **είναι** η προσέγγιση φαλτσογωνιάς
 * στις εσωτερικές γωνίες — κοινή σε όλους τους καλούντες, άρα συνεπής σε κάθε γωνία.
 *
 * ⚠️ ADR-789 / CHECK 3.28 — ΜΙΑ συνάρτηση αντί για `vertexNormalX`/`vertexNormalY`: ο
 * βρόχος ήταν γραμμένος **δύο φορές** (63 + 58 tokens κλώνος) και διέτρεχε τους ίδιους
 * γείτονες δύο φορές για να επιστρέψει έναν βαθμωτό αριθμό τη φορά.
 */
export function vertexNormal(
  vertices: readonly PlanarPoint[],
  i: number,
  closed = false,
): PlanarPoint {
  const n = vertices.length;
  let accX = 0;
  let accY = 0;
  let count = 0;
  const add = (from: number, to: number): void => {
    const seg = segmentNormal(vertices[from], vertices[to]);
    if (seg === null) return;
    accX += seg.x;
    accY += seg.y;
    count += 1;
  };
  if (i > 0 || closed) add(i > 0 ? i - 1 : n - 1, i);
  if (i < n - 1 || closed) add(i, i < n - 1 ? i + 1 : 0);
  return count > 0 ? { x: accX / count, y: accY / count } : { x: 0, y: 0 };
}

/**
 * Drop a trailing vertex that coincides with the first (within `eps`). A closed
 * ring is sometimes represented with its first point repeated at the end (e.g. the
 * assembled envelope face loop); that duplicate creates a zero-length wrap-around
 * segment that breaks the closed-mitre at the seam. Returns the input unchanged
 * when there is no such duplicate.
 *
 * Generic ώστε ο καλών να παίρνει πίσω **τον τύπο του** (2Δ ή 3Δ) — η συνάρτηση
 * κρίνει μόνο x/y και δεν κατασκευάζει τίποτα (ADR-789).
 */
export function stripClosingDuplicate<T extends PlanarPoint>(
  vertices: readonly T[],
  eps = 1e-6,
): readonly T[] {
  const n = vertices.length;
  if (n < 2) return vertices;
  const a = vertices[0];
  const b = vertices[n - 1];
  if (Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps) {
    return vertices.slice(0, n - 1);
  }
  return vertices;
}

/**
 * **Parallel offset** — re-export της ΜΙΑΣ μηχανής (ADR-791).
 *
 * 🔴 **Εδώ ζούσε δεύτερη υλοποίηση, και ήταν ΓΕΩΜΕΤΡΙΚΑ ΛΑΘΟΣ.** Χρησιμοποιούσε τον
 * **μέσο όρο** των γειτονικών normals (`vertexNormal`) αντί για γνήσιο miter, οπότε σε
 * ορθή γωνία η παρειά έπεφτε στο **μισό** της ζητούμενης απόστασης — μετρημένο:
 * offset 10 σε γωνία 90° έδινε **5,000** αντί για 10,000 (−50%). Επηρέαζε πάχος τοίχου ·
 * πλάτος δοκού · πάχη μόνωσης κελύφους · διατομές MEP, δηλαδή **και το BOQ**.
 *
 * ⚠️ Το ελάττωμα ήταν **ήδη τεκμηριωμένο** στο docblock του {@link insetPolygonMiter}
 * («averaged-normal, που υπο-εισάγει τις γωνίες ~cos45°») — κάποιος το βρήκε, έγραψε τη
 * σωστή λύση, και την εφάρμοσε σε **έναν** καλούντα. *Η γνώση υπήρχε· έλειπε η εφαρμογή.*
 *
 * 🏆 Η κανονική μηχανή κάνει αληθινό miter με `miterLimit = 4` και πτώση σε bevel —
 * η πρακτική του **Clipper2** (`JoinType.Miter` + fallback) και η προεπιλογή του SVG
 * `stroke-miterlimit`.
 *
 * ⚠️ **Άλλαξε η υπογραφή**: `(v, d, sign, closed)` → `(v, sign·d, { closed })`.
 */
export { offsetPolyline };

/**
 * Inset ενός κλειστού polygon κατά `distance` προς τα ΜΕΣΑ, winding-agnostic:
 * δοκιμάζει και τα δύο πρόσημα του `offsetPolyline` και κρατά αυτό με το ΜΙΚΡΟΤΕΡΟ
 * εμβαδόν (= προς τα μέσα). Επιστρέφει `null` αν το polygon είναι μη-έγκυρο
 * (< 3 κορυφές, `distance ≤ 0`) ή το inset **κατέρρευσε**. Χρήση: ETICS
 * περβάζια (ADR-396 Z4 — frame γύρω από την τρύπα ανοίγματος, 2D + 3D).
 *
 * 🔴 **Η ανίχνευση κατάρρευσης είναι ΑΠΑΡΑΙΤΗΤΗ, όχι πολυτέλεια** (ADR-791). Όταν το
 * πολύγωνο γίνει στενότερο από `2·distance`, το inset **περνά το κέντρο και αναστρέφεται**:
 * η φορά διάσχισης γυρίζει και το **απόλυτο** εμβαδόν ξαναμεγαλώνει. Με κριτήριο
 * απόλυτου εμβαδού το ανεστραμμένο μπορεί να **κερδίσει** τη σύγκριση, οπότε ένας
 * επαναληπτικός καλών (σπείρα ενδοδαπέδιου) **ταλαντώνεται αιώνια**: μετρημένο ζωντανά
 * σε δωμάτιο 5×4 m με βήμα 250 mm → 300×300 → 200×200 → 300×300 → … Ο μόνος που το
 * σταματούσε ήταν το `MAX_SPIRAL_RINGS = 200`, δηλαδή ένα **ταβάνι ασφαλείας που
 * κρατούσε ζωντανό ένα λάθος αποτέλεσμα**.
 *
 * ⚠️ Κριτήριο = **προσημασμένο** εμβαδόν: ίδια φορά ΚΑΙ γνησίως μικρότερο. Το «> 0» του
 * απόλυτου δεν μπορεί να πυροδοτήσει ποτέ, γιατί ένα ανεστραμμένο πολύγωνο έχει
 * απολύτως θετικό εμβαδόν.
 */
export function insetClosedPolygon(
  vertices: readonly BimPoint[],
  distance: number,
): BimPoint[] | null {
  if (vertices.length < 3 || distance <= 0) return null;
  // Ring offset: strip any closing-duplicate + closed-mitre so the seam vertex
  // does not produce a diagonal jog (same fix as the envelope insulation loop).
  const ring = stripClosingDuplicate(vertices);
  if (ring.length < 3) return null;
  const plus = offsetPolyline(ring, distance, { closed: true });
  const minus = offsetPolyline(ring, -distance, { closed: true });
  const inner = polygonArea(plus) <= polygonArea(minus) ? plus : minus;
  if (inner.length < 3) return null;
  // Κατάρρευση: αντιστροφή φοράς (πέρασε το κέντρο) ή μη-συρρίκνωση.
  const before = shoelaceArea(ring);
  const after = shoelaceArea(inner);
  if (after === 0 || Math.sign(after) !== Math.sign(before)) return null;
  if (Math.abs(after) >= Math.abs(before)) return null;
  return inner;
}

/**
 * **Miter inward inset** ενός κλειστού πολυγώνου κατά `d` (winding-aware, concave-safe).
 * Κάθε ακμή μετατοπίζεται κάθετα προς τα ΜΕΣΑ κατά ΑΚΡΙΒΩΣ `d` και οι κορυφές κλείνουν
 * στην τομή των μετατοπισμένων ευθειών (γνήσιο miter `m = d·(n1+n2)/(1+n1·n2)`, με
 * miter-limit clamp). Σε αντίθεση με το {@link insetClosedPolygon} (averaged-normal, που
 * υπο-εισάγει τις γωνίες ~cos45°), αυτό διατηρεί την κάθετη απόσταση `d` σε κάθε παρειά —
 * απαραίτητο για centerline στεφανιού/ράβδων (ADR-460). Reflex (εσωτερικές) γωνίες Γ/Τ/Π
 * χειρίζονται σωστά γιατί τα inward normals προκύπτουν από το CCW winding (left normal),
 * όχι από centroid. Επιστρέφει `null` αν `< 3` κορυφές ή το inset καταρρέει (≤0 εμβαδόν).
 * Έξοδος πάντα σε CCW σειρά. `d ≤ 0` → αντίγραφο (CCW).
 */
export function insetPolygonMiter(
  vertices: readonly { readonly x: number; readonly y: number }[],
  distance: number,
): { x: number; y: number }[] | null {
  const n = vertices.length;
  if (n < 3) return null;
  // CCW orientation (signed area > 0)· αν CW → reverse ώστε left-normal = inward.
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % n];
    area2 += a.x * b.y - b.x * a.y;
  }
  const ring = area2 >= 0 ? projectVerticesTo2D(vertices) : projectVerticesTo2D(vertices).reverse();
  if (distance <= 0) return ring;

  const EPS = 1e-9;
  const MITER_LIMIT = 4;
  // Inward unit normal κάθε ακμής i (CCW left normal = rotate dir +90°: (-dy,dx)).
  const nrm = ring.map((a, i) => {
    const b = ring[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: -dy / len, y: dx / len };
  });
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const v = ring[k];
    const n1 = nrm[(k - 1 + n) % n];
    const n2 = nrm[k];
    const denom = 1 + (n1.x * n2.x + n1.y * n2.y);
    let mx: number;
    let my: number;
    if (denom < EPS) {
      mx = distance * n2.x;
      my = distance * n2.y;
    } else {
      mx = (distance * (n1.x + n2.x)) / denom;
      my = (distance * (n1.y + n2.y)) / denom;
      const mag = Math.hypot(mx, my);
      if (mag > MITER_LIMIT * distance) {
        const s = (MITER_LIMIT * distance) / mag;
        mx *= s;
        my *= s;
      }
    }
    out.push({ x: v.x + mx, y: v.y + my });
  }
  return polygonArea(out.map((p) => ({ ...p, z: 0 }))) > 0 ? out : null;
}

/**
 * **Λωρίδα γύρω από άξονα** — το κλειστό πολύγωνο που προκύπτει μετατοπίζοντας τον άξονα
 * κατά `±half` και κλείνοντας CCW (+offset αρχή→τέλος, μετά −offset τέλος→αρχή).
 *
 * 🔑 SSoT των «γραμμικών» οντοτήτων που έχουν **πλάτος γύρω από άξονα**: δοκός · τμήμα MEP
 * (σωλήνας/αεραγωγός). Μέχρι το ADR-791 ήταν γραμμένο **δύο φορές**, και το ίδιο το σχόλιο
 * του δεύτερου το δήλωνε («*Internal helpers (**mirror beam-geometry**)*») — δήλωση
 * αντιγράφου αντί για εξαγωγή.
 *
 * ⚠️ Δεν κρίνει εκφυλισμούς: ο καλών ελέγχει `axis.length ≥ 2` και μη-μηδενικό πλάτος, και
 * χειρίζεται τις **δικές του** ειδικές περιπτώσεις (π.χ. κατακόρυφη στήλη MEP με ταυτόσημα
 * XY άκρα, όπου οι κάθετες είναι απροσδιόριστες).
 */
export function stripPolygonAroundAxis(
  axis: readonly BimPoint[],
  half: number,
): BimPoint[] {
  const plus = offsetPolyline(axis, half);
  const minus = offsetPolyline(axis, -half);
  const polygon: BimPoint[] = [...plus];
  for (let i = minus.length - 1; i >= 0; i--) polygon.push(minus[i]);
  return polygon;
}

/**
 * **Περίγραμμα γραμμικής οντότητας** — άξονας + πλάτος σε mm ⇒ κλειστό πολύγωνο κάτοψης.
 *
 * Ο κοινός πρόλογος (φύλαξη εκφυλισμού + mm → canvas units) των δοκών και των τμημάτων MEP.
 * `axis.length < 2` ή `widthMm ≤ 0` ⇒ επιστρέφεται ο άξονας αυτούσιος (ο καλών αποφασίζει).
 *
 * @param s canvas units ανά 1 mm (`mmScaleFor`) — το πλάτος είναι mm, ο άξονας canvas units.
 */
export function buildAxisStripOutline(
  axis: readonly BimPoint[],
  widthMm: number,
  s: number,
): BimPoint[] {
  if (axis.length < 2 || widthMm <= 0) return [...axis];
  return stripPolygonAroundAxis(axis, (widthMm * s) / 2);
}
