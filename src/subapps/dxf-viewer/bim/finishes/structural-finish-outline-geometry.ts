/**
 * ADR-449 — Structural Finish Outline Geometry (γεωμετρία γωνιών σοβά): pure SSoT.
 *
 * Το ΚΕΝΤΡΟ της γωνιακής μεταχείρισης του σοβά — **κοινό για 2Δ ΚΑΙ 3Δ** (μηδέν
 * διπλότυπο). Από τις exposed `FinishFaceSegment[]` του resolver παράγει τα **mitered
 * outer endpoints** (+ τα πιθανώς επεκταμένα core endpoints) κάθε όψης:
 *
 *   - Κοινές κορυφές ΙΔΙΟΥ στοιχείου → **miter** (τομή των offset ευθειών· convex
 *     extend, reflex trim). Σε 90° γωνία → καθαρή ορθή γωνία.
 *   - Ανοιχτά άκρα → **chamfer 45°** (ελεύθερα) ή **ορθογώνια EXTEND** (junction).
 *
 * Pure: μηδέν THREE/React/scene. Το **3Δ** (`structural-finish-3d.ts`) εξωθεί τα quads
 * σε prisms· το **2Δ** (`structural-finish-outline-2d.ts`) ζωγραφίζει το ίδιο outline →
 * οι γωνίες κλείνουν ΠΑΝΟΜΟΙΟΤΥΠΑ (πρώην: το 2Δ ζωγράφιζε κάθε όψη ανεξάρτητα, χωρίς
 * miter → ανοιχτές γωνίες· ADR-449 Slice X2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md
 */

import type { FinishFaceSegment } from './structural-finish-types';

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

const EPS = 1e-9;

/** Μοναδιαία outward normal × offset (CCW footprint → (dy,−dx)). `null` αν degenerate. */
export function segOffsetVec(seg: FinishFaceSegment, offCanvas: number): Vec2 | null {
  const dx = seg.b.x - seg.a.x;
  const dy = seg.b.y - seg.a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  return { x: (dy / len) * offCanvas, y: (-dx / len) * offCanvas };
}

/** Τομή δύο ευθειών (p0+t·d0) ∩ (p1+u·d1)· `null` αν ~παράλληλες. */
function lineIntersect(p0: Vec2, d0: Vec2, p1: Vec2, d1: Vec2): Vec2 | null {
  const denom = d0.x * d1.y - d0.y * d1.x;
  if (Math.abs(denom) < EPS) return null;
  const t = ((p1.x - p0.x) * d1.y - (p1.y - p0.y) * d1.x) / denom;
  return { x: p0.x + t * d0.x, y: p0.y + t * d0.y };
}

/** Όριο μήκους miter (× offset) — αιχμηρές γωνίες κρατούν square άκρο, χωρίς spike. */
const MITER_LIMIT_FACTOR = 4;

/**
 * ADR-449 Slice 6/10 + Δρόμος Β — κλείσιμο των **ΑΝΟΙΧΤΩΝ** άκρων (που δεν mitered-ηκαν με
 * γειτονική όψη του ΙΔΙΟΥ στοιχείου). **Τρεις** περιπτώσεις, ανάλογα με το είδος του γείτονα:
 *
 *  - **Ελεύθερο** άκρο (open space, `!aJunction`) → **chamfer 45°**: ΜΟΝΟ η εξωτερική γωνία
 *    τραβιέται **μέσα** κατά το πάχος (το core μένει) → λοξό end-cap (φαλτσογωνιά) αντί για
 *    τετράγωνο «κεφάλι» που προεξέχει σε ανοιχτό χώρο (Slice 6 #3 — mirror τοίχου).
 *  - **Junction** άκρο (`seg.aJunction/bJunction` — ακουμπά γειτονικό δομικό στοιχείο, π.χ.
 *    συμβολή «από κάναβο» ADR-441) → **ορθογώνια EXTEND**: **core ΚΑΙ outer** σπρώχνονται μαζί
 *    **έξω** κατά το πάχος (κατά τον άξονα) → το end-cap μένει **ΚΑΘΕΤΟ (ορθογωνική τομή)** και
 *    ακουμπά flush στην εξωτερική παρειά του διπλανού σοβά → **corner-fill** χωρίς λοξή ακμή που
 *    μπαίνει στο σώμα του όμορου (Giorgio 2026-06-14: v1 square άφηνε κενό· v2 outer-only EXTEND
 *    έκανε λοξό end-cap που διείσδυε· v3 = core+outer EXTEND = ορθογώνια κάθετη τομή). Γεμίζει
 *    την κάθετη γωνία ΚΑΙ overlap-άρει σε collinear συνέχεια → ο σοβάς **κλείνει**, μηδέν προεξοχή.
 *  - **Wall butt** άκρο (`seg.aSquareEnd/bSquareEnd` — ακουμπά **τοίχο**, ΟΧΙ δομικό στοιχείο,
 *    Δρόμος Β) → **καθαρό τετράγωνο σταμάτημα** (no-op): ούτε chamfer ούτε extend. Ο τοίχος έχει
 *    **δικό** του σοβά (layered DNA, ADR-447) → ΜΗΝ εκτείνεσαι μέσα του (αλλιώς #A over-reach) ΚΑΙ
 *    ΜΗΝ κάνεις chamfer (που θα άφηνε τριγωνικό κενό στην collinear flush όψη).
 *
 * Clamp στο μισό μήκος για μικρές όψεις (μηδέν inversion στο chamfer/extend).
 */
function closeOpenOuterEnds(
  segs: readonly FinishFaceSegment[],
  offsets: readonly (Vec2 | null)[],
  aCore: Vec2[],
  bCore: Vec2[],
  aOuter: Vec2[],
  bOuter: Vec2[],
  aMit: readonly boolean[],
  bMit: readonly boolean[],
): void {
  for (let i = 0; i < segs.length; i++) {
    const off = offsets[i];
    if (!off) continue;
    const dx = segs[i].b.x - segs[i].a.x;
    const dy = segs[i].b.y - segs[i].a.y;
    const len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    const ch = Math.min(Math.hypot(off.x, off.y), len / 2);
    const ux = (dx / len) * ch;
    const uy = (dy / len) * ch;
    if (!aMit[i]) {
      if (segs[i].aJunction) {
        // Ορθογώνια EXTEND έξω (−άξονας): core + outer μαζί → κάθετο end-cap, corner-fill.
        aCore[i] = { x: aCore[i].x - ux, y: aCore[i].y - uy };
        aOuter[i] = { x: aOuter[i].x - ux, y: aOuter[i].y - uy };
      } else if (segs[i].aSquareEnd) {
        // Δρόμος Β (wall butt): καθαρό τετράγωνο σταμάτημα στην παρειά του τοίχου — ούτε
        // chamfer ούτε extend (ο τοίχος έχει δικό του σοβά). Αφήνουμε core/outer ως έχουν.
      } else {
        // Chamfer 45°: μόνο outer μέσα (+άξονας) → λοξό end-cap σε ελεύθερο άκρο.
        aOuter[i] = { x: aOuter[i].x + ux, y: aOuter[i].y + uy };
      }
    }
    if (!bMit[i]) {
      if (segs[i].bJunction) {
        bCore[i] = { x: bCore[i].x + ux, y: bCore[i].y + uy };
        bOuter[i] = { x: bOuter[i].x + ux, y: bOuter[i].y + uy };
      } else if (segs[i].bSquareEnd) {
        // Δρόμος Β (wall butt): καθαρό τετράγωνο σταμάτημα (βλ. παραπάνω).
      } else {
        bOuter[i] = { x: bOuter[i].x - ux, y: bOuter[i].y - uy };
      }
    }
  }
}

/**
 * ADR-449 Slice 5 fix — outer offset endpoints κάθε exposed παρειάς, **mitered** στις
 * κοινές κορυφές: το εξωτερικό άκρο επεκτείνεται/κόβεται στην τομή των δύο offset
 * ευθειών → ΕΝΑ 45° seam, **μηδέν επικάλυψη/κενό** (convex → extend, reflex → trim).
 * Slice 6: `chamferOpenEnds` → κλείνει τα μη-mitered άκρα (βλ. `closeOpenOuterEnds`).
 * Slice 9: ενεργό ΚΑΙ για κολόνες. Slice 10: per-end — ελεύθερο → chamfer 45° (outer-only)·
 * junction → ορθογώνια extend (**core+outer**, κάθετο end-cap, corner-fill). Γι' αυτό επιστρέφει
 * ΚΑΙ τα (πιθανώς επεκταμένα) `aCore/bCore` — ο consumer (2Δ/3Δ) διαβάζει αυτά αντί `seg.a/b`.
 */
export function computeMiteredOuter(
  segs: readonly FinishFaceSegment[],
  offsets: readonly (Vec2 | null)[],
  chamferOpenEnds: boolean,
): { aOuter: Vec2[]; bOuter: Vec2[]; aCore: Vec2[]; bCore: Vec2[] } {
  const n = segs.length;
  const aOuter: Vec2[] = [];
  const bOuter: Vec2[] = [];
  const aCore: Vec2[] = [];
  const bCore: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const o = offsets[i] ?? { x: 0, y: 0 };
    aCore[i] = { x: segs[i].a.x, y: segs[i].a.y };
    bCore[i] = { x: segs[i].b.x, y: segs[i].b.y };
    aOuter[i] = { x: segs[i].a.x + o.x, y: segs[i].a.y + o.y };
    bOuter[i] = { x: segs[i].b.x + o.x, y: segs[i].b.y + o.y };
  }
  const aMit = new Array<boolean>(n).fill(false);
  const bMit = new Array<boolean>(n).fill(false);
  for (let k = 0; k < n && n >= 2; k++) {
    const m = (k + 1) % n;
    const cur = segs[k];
    const nxt = segs[m];
    const ok = offsets[k];
    const om = offsets[m];
    if (!ok || !om) continue;
    const v = cur.b;
    const tol = 1e-6 * (1 + Math.hypot(v.x, v.y));
    if (Math.hypot(v.x - nxt.a.x, v.y - nxt.a.y) > tol) continue; // όχι κοινή κορυφή
    const dCur = { x: cur.b.x - cur.a.x, y: cur.b.y - cur.a.y };
    const dNxt = { x: nxt.b.x - nxt.a.x, y: nxt.b.y - nxt.a.y };
    const mPt = lineIntersect({ x: cur.a.x + ok.x, y: cur.a.y + ok.y }, dCur, { x: nxt.a.x + om.x, y: nxt.a.y + om.y }, dNxt);
    if (!mPt) continue;
    const offMag = Math.max(Math.hypot(ok.x, ok.y), Math.hypot(om.x, om.y));
    if (Math.hypot(mPt.x - v.x, mPt.y - v.y) > MITER_LIMIT_FACTOR * offMag) continue; // αιχμηρή → square
    bOuter[k] = mPt;
    aOuter[m] = mPt;
    bMit[k] = true;
    aMit[m] = true;
  }
  if (chamferOpenEnds) closeOpenOuterEnds(segs, offsets, aCore, bCore, aOuter, bOuter, aMit, bMit);
  return { aOuter, bOuter, aCore, bCore };
}
