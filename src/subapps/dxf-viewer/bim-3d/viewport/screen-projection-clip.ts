/**
 * screen-projection-clip.ts — ΟΜΟΓΕΝΗΣ (clip-space) προβολή + NEAR-PLANE clipping ΑΝΑ ΤΜΗΜΑ για
 * το 3D viewport (ADR-717 Φάση Γ). Η **ΜΙΑ** κατοικία της ερώτησης «πού πέφτει αυτό το σημείο του
 * κόσμου στην οθόνη — και πότε δεν ορίζεται καθόλου;».
 *
 * ## Το σφάλμα που καταργεί
 *
 * Μέχρι το ADR-717 η απάντηση ζούσε στο `coordinate-transforms.ndcToScreenPx` και ήταν:
 * `if (ndc.z > 1) return null; // behind camera`. Το σχόλιο ήταν **λάθος**: το `ndc.z > 1` ισχύει
 * σε ΔΥΟ εντελώς διαφορετικές καταστάσεις και η μία απορριπτόταν άδικα.
 *
 * ### Η απόδειξη (προοπτική κάμερα, near `n`, far `f`)
 *
 * Clip space: `w = −z_view`, `z_clip = −((f+n)/(f−n))·z_view − 2fn/(f−n)`.
 *
 *  • **Πίσω από το μάτι** (`z_view = +d`, d>0): `w = −d < 0`. Η διαίρεση με αρνητικό `w`
 *    **καθρεφτίζει** τα x/y — το σημείο βγαίνει σε ΛΑΘΟΣ μεριά της οθόνης. Η προβολή είναι
 *    μαθηματικά **μη ορισμένη**· η απόρριψη είναι σωστή.
 *  • **Πέρα από το far plane** (`z_view = −d`, d>f): `w = d > 0` και
 *    `ndc.z = ((f+n)d − 2fn)/(d(f−n)) > 1`. Τα **x/y όμως είναι απολύτως έγκυρα** — το σημείο
 *    απλώς δεν ρασταρίζεται από το GPU. Η απόρριψη ήταν **σφάλμα**.
 *
 * Και τα δύο δίνουν `ndc.z > 1`, οπότε **από το NDC και μόνο δεν ξεχωρίζουν** — γι' αυτό το παλιό
 * test τα συγχώνευε. Ξεχωρίζουν μόνο **πριν** τη διαίρεση, από το `w`.
 *
 * ### Το μετρημένο κόστος (probe, ADR-717 §Β)
 *
 * `CAMERA_FAR = 1000` m. Σε τοπογραφικό 3 km (απόλυτες γεωδαιτικές EGSA ή έκταση >1 km) και τα
 * **4/4** σημεία μιας οντότητας γύριζαν `null` → το marquee δεν επέλεγε **τίποτα**, ενώ όλα ήταν
 * καθαρά ορατά. Το ίδιο χτυπούσε λαβές, HUD, text anchors, το BIM marquee και το selection
 * highlight — έξι καταναλωτές, ΕΝΑ σφάλμα, γιατί όλοι περνούν από την ίδια συνάρτηση.
 *
 * ## Τι κάνουμε αντ' αυτού (Blinn homogeneous clipping)
 *
 * Η καθιερωμένη λύση κάθε rasterizer — και ο λόγος που το clipping μπαίνει **πριν** το perspective
 * divide σε κάθε GPU pipeline: κόβεις τη **ΓΡΑΜΜΗ** στο near plane, όχι το **ΣΗΜΕΙΟ** μετά τη
 * διαίρεση. Ένα τμήμα που περνά πίσω από την κάμερα δίνει το ορατό του κομμάτι· δεν εξαφανίζει
 * την οντότητα. Το far plane **δεν** συμμετέχει: είναι κριτήριο **ραστεροποίησης**, όχι προβολής.
 *
 * ## Γιατί το κατώφλι είναι το `w` και όχι το `z` (το μη-προφανές κομμάτι)
 *
 * Σε προοπτική κάμερα ισχύει `w = −z_view` = **απόσταση κατά μήκος του άξονα βλέμματος**. Άρα το
 * near plane ΕΙΝΑΙ, ακριβώς, `w = camera.near` — εκφράζεται καθαρά στο `w`, χωρίς να χρειαστεί
 * δεύτερος έλεγχος στο `z`. Δύο κέρδη:
 *
 *  1. **Φραγμένες συντεταγμένες**: κόβοντας στο near (και όχι στο ίδιο το μάτι, `w→0`) το `x/w`
 *     δεν εκρήγνυται. Κοπή στο μάτι θα έδινε άκρα στα ±10⁶ px — αριθμητικά έγκυρα, οπτικά σκουπίδι.
 *  2. **Ορθογραφική κάμερα**: εκεί `w ≡ 1` και **δεν υπάρχει σημείο ματιού**, άρα δεν υπάρχει
 *     «πίσω» — το κατώφλι πέφτει σε ένα αμελητέο ε ώστε να μην κόβεται ΤΙΠΟΤΑ. (Το παλιό test
 *     έκοβε και εδώ — στην ΠΡΟΕΠΙΛΕΓΜΕΝΗ κάτοψη του DXF υποστρώματος — κάθε σημείο πέρα από το
 *     ορθογραφικό far plane.)
 *
 * Pure THREE — no React, no DOM beyond a `DOMRect` value. Jest-friendly.
 */

import * as THREE from 'three';
import type { Point2D } from '../../rendering/types/Types';

/**
 * Ένα σημείο σε CLIP SPACE — **πριν** τη διαίρεση με `w`. Το `w` είναι όλη η ουσία: είναι το
 * βάθος κατά μήκος του άξονα βλέμματος, το μόνο μέγεθος που ξεχωρίζει «πίσω από το μάτι» από
 * «μακριά». Μεταβλητό επίτηδες (τα bulk μονοπάτια γράφουν σε προϋπάρχον buffer).
 */
export interface ClipPoint {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * Κατώφλι για κάμερες ΧΩΡΙΣ σημείο ματιού (ορθογραφική): αμελητέο θετικό ε ⇒ με `w ≡ 1` δεν
 * κόβεται ποτέ τίποτα. Δεν είναι «σχεδόν μηδέν από φόβο» — είναι «δεν υπάρχει τέτοιο επίπεδο».
 */
export const ORTHO_MIN_W = 1e-6;

/**
 * Το ελάχιστο `w` κάτω από το οποίο ένα σημείο ΔΕΝ προβάλλεται. Προοπτική ⇒ το near plane
 * (`w = −z_view` ⇒ `w = near` ΕΙΝΑΙ το near plane). Οτιδήποτε άλλο ⇒ {@link ORTHO_MIN_W}.
 */
export function nearClipMinW(camera: THREE.Camera): number {
  return camera instanceof THREE.PerspectiveCamera ? camera.near : ORTHO_MIN_W;
}

/** Τα ΟΡΑΤΑ τμήματα ενός πολυγράμμου, σε client px, μαζί με το «κόπηκε;». */
export interface ClippedPolyline {
  /**
   * Οι συνεχείς ορατές διαδρομές. Ένα πολύγραμμο που μπαινοβγαίνει από το near plane παράγει
   * ΠΟΛΛΕΣ — γι' αυτό είναι πίνακας πινάκων και όχι ένας πίνακας σημείων.
   */
  readonly runs: Point2D[][];
  /**
   * `true` αν έστω ΕΝΑ σημείο έπεσε πίσω από το near plane. Το σήμα που χρειάζεται το WINDOW:
   * «δεν προβάλλεται όλο» ⇒ δεν μπορεί να είναι «όλο μέσα στο πλαίσιο».
   */
  readonly clipped: boolean;
}

/**
 * Ο projector+clipper μιας ΣΥΓΚΕΚΡΙΜΕΝΗΣ πόζας κάμερας πάνω σε ΣΥΓΚΕΚΡΙΜΕΝΟ canvas.
 *
 * ⚠️ Παγώνει και τα δύο τη στιγμή της κατασκευής (view-projection πίνακας + client rect). Η
 * κάμερα δεν πρέπει να κινηθεί όσο ζει — ίδια σύμβαση με το `createWorldToScreenProjector`, και
 * ο λόγος που υπάρχει: ένα `getBoundingClientRect()` ανά κορυφή είναι forced layout flush ανά
 * κορυφή, και ένας `P·V` ανά κορυφή είναι 64 περιττοί πολλαπλασιασμοί.
 */
export interface ScreenClipper {
  /** Το ενεργό κατώφλι — εκτεθειμένο ώστε τα anchors να ελέγχουν ΤΙ κόβει, όχι μόνο ΑΝ κόβει. */
  readonly minW: number;
  /** World → clip space. Γράφει στο `out` αν δοθεί (zero-allocation στα hot paths). */
  projectToClip(pos: THREE.Vector3, out?: ClipPoint): ClipPoint;
  /** Προβάλλεται καθόλου αυτό το σημείο (είναι μπροστά από το near plane); */
  isVisible(p: ClipPoint): boolean;
  /** Clip → CLIENT px· `null` **μόνο** για σημεία πίσω από το near plane — ποτέ για απόσταση. */
  toScreenPx(p: ClipPoint): Point2D | null;
  /** World → CLIENT px σε ένα βήμα (η μονοδρομική διαδρομή, χωρίς ενδιάμεση κατανομή). */
  worldToScreenPx(pos: THREE.Vector3): Point2D | null;
  /**
   * NEAR-PLANE CLIPPING ΑΝΑ ΤΜΗΜΑ. Κάθε τμήμα εξετάζεται ξεχωριστά· τα εντός τμήματα
   * συνενώνονται σε συνεχείς διαδρομές, και όπου το πολύγραμμο διασχίζει το near plane μπαίνει
   * το **ακριβές** σημείο τομής (όχι το κοντινότερο δείγμα). Μια πολυγραμμή 3 km που περνά πίσω
   * από την κάμερα δίνει το ορατό της κομμάτι σε πλήρη ακρίβεια αντί να εξαφανίζεται ολόκληρη.
   */
  clipPolylineToScreen(pts: readonly ClipPoint[]): ClippedPolyline;
}

/** Νέο, μηδενισμένο clip point. */
function emptyClipPoint(): ClipPoint {
  return { x: 0, y: 0, z: 0, w: 0 };
}

/**
 * Το σημείο όπου το τμήμα `a→b` τέμνει το near plane. Οι συντεταγμένες clip είναι **γραμμικές**
 * ως προς την παράμετρο του κόσμου — γι' αυτό η τομή γίνεται εδώ και όχι μετά τη διαίρεση, όπου
 * τίποτα δεν είναι γραμμικό: λύνουμε `w(t) = minW` και παρεμβάλλουμε και τις τέσσερις συνιστώσες.
 */
function intersectNearPlane(a: ClipPoint, b: ClipPoint, minW: number): ClipPoint {
  const denom = b.w - a.w;
  // Παράλληλο στο επίπεδο (ίδιο βάθος στα δύο άκρα) — δεν υπάρχει τομή. Ο καλών έχει ήδη κρίνει
  // ποιο άκρο είναι ορατό, οπότε επιστρέφουμε το `b` αντί να σκάσουμε σε διαίρεση με μηδέν.
  if (Math.abs(denom) < Number.EPSILON) return { ...b };
  const t = (minW - a.w) / denom;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    w: minW,
  };
}

/** Προσθέτει τη διαδρομή στα αποτελέσματα αν έχει τουλάχιστον ένα τμήμα, και την αδειάζει. */
function flushRun(runs: Point2D[][], run: Point2D[]): Point2D[] {
  if (run.length >= 2) runs.push(run);
  return [];
}

export function createScreenClipper(camera: THREE.Camera, canvas: HTMLElement): ScreenClipper {
  const rect = canvas.getBoundingClientRect();
  const minW = nearClipMinW(camera);
  const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const v4 = new THREE.Vector4();
  const scratch = emptyClipPoint();

  const projectToClip = (pos: THREE.Vector3, out: ClipPoint = emptyClipPoint()): ClipPoint => {
    v4.set(pos.x, pos.y, pos.z, 1).applyMatrix4(vp);
    out.x = v4.x;
    out.y = v4.y;
    out.z = v4.z;
    out.w = v4.w;
    return out;
  };

  const isVisible = (p: ClipPoint): boolean => p.w >= minW;

  /**
   * Η αντιστοίχιση viewport, ΧΩΡΙΣ έλεγχο ορατότητας — καλείται μόνο για σημεία που ο καλών έχει
   * ήδη κρίνει ορατά (ή που κατασκευάστηκαν ΠΑΝΩ στο near plane, όπου `w === minW` ακριβώς).
   * Ξεχωριστή από το `toScreenPx` ώστε ο τύπος να ζει μία φορά χωρίς non-null assertions.
   */
  const mapToPx = (p: ClipPoint): Point2D => ({
    x: ((p.x / p.w + 1) / 2) * rect.width + rect.left,
    y: ((-(p.y / p.w) + 1) / 2) * rect.height + rect.top,
  });

  const toScreenPx = (p: ClipPoint): Point2D | null => (isVisible(p) ? mapToPx(p) : null);

  return {
    minW,
    projectToClip,
    isVisible,
    toScreenPx,
    worldToScreenPx: (pos) => toScreenPx(projectToClip(pos, scratch)),
    clipPolylineToScreen: (pts) => {
      const runs: Point2D[][] = [];
      if (pts.length === 0) return { runs, clipped: false };
      if (pts.length === 1) return { runs, clipped: !isVisible(pts[0]) };

      let clipped = false;
      let run: Point2D[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const aIn = isVisible(a);
        const bIn = isVisible(b);
        if (aIn && bIn) {
          if (run.length === 0) run.push(mapToPx(a));
          run.push(mapToPx(b));
          continue;
        }
        clipped = true;
        if (!aIn && !bIn) {
          run = flushRun(runs, run); // ΟΛΟ το τμήμα πίσω από το near plane — τίποτα να κρατηθεί.
          continue;
        }
        if (aIn) {
          // Βγαίνει: κρατάμε μέχρι το επίπεδο και κλείνουμε τη διαδρομή.
          if (run.length === 0) run.push(mapToPx(a));
          run.push(mapToPx(intersectNearPlane(a, b, minW)));
          run = flushRun(runs, run);
        } else {
          // Μπαίνει: νέα διαδρομή που ξεκινά ΠΑΝΩ στο επίπεδο.
          run = flushRun(runs, run);
          run.push(mapToPx(intersectNearPlane(a, b, minW)));
          run.push(mapToPx(b));
        }
      }
      flushRun(runs, run);
      return { runs, clipped };
    },
  };
}
