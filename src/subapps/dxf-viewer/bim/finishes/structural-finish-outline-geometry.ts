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
import { segmentAxis } from './finish-segment-geometry';

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
 * ADR-449 PART B (per-face paint corner fix) — «flush-collinear» ανίχνευση: το άκρο `atB` του
 * segment `i` έχει **συνευθειακή συνέχεια** στην ίδια ευθεία; (γείτονας που μοιράζεται την
 * κορυφή, ΙΔΙΑ φορά). True = το άκρο είναι **σύνορο attribute πάνω σε ευθεία** (per-face paint /
 * override split boundary), ΟΧΙ ελεύθερη άκρη περιμέτρου.
 *
 * **Γιατί υπάρχει:** όταν το per-face βάψιμο σπάει ένα collinear blanket run σε κομμάτια
 * (`applyFinishOverrideEdges`), το split point μοιράζεται κορυφή με collinear γείτονα → το
 * `tryMiterPair` το απορρίπτει (παράλληλα, `lineIntersect`=null) → έπεφτε στον default κλάδο
 * «chamfer 45°» που τραβά την εξωτερική γωνία **μέσα κατά το πάχος** → η γωνία της κολόνας
 * «μπαίνει μέσα». Στη συνευθειακή συνέχεια τα δύο outer offset σημεία ΣΥΜΠΙΠΤΟΥΝ στην κορυφή
 * (ίδιο offset) → σωστό = **flush pass-through** (μηδέν chamfer), όχι λοξό κόψιμο.
 */
function hasCollinearRunNeighbor(segs: readonly FinishFaceSegment[], i: number, atB: boolean): boolean {
  const di = segmentAxis(segs[i].a, segs[i].b);
  if (!di) return false;
  const v = atB ? segs[i].b : segs[i].a;
  const tol = 1e-6 * (1 + Math.hypot(v.x, v.y));
  for (let j = 0; j < segs.length; j++) {
    if (j === i) continue;
    // b-άκρο → γείτονας που ΞΕΚΙΝΑ (a) στην κορυφή· a-άκρο → γείτονας που ΤΕΛΕΙΩΝΕΙ (b).
    const w = atB ? segs[j].a : segs[j].b;
    if (Math.hypot(v.x - w.x, v.y - w.y) > tol) continue;
    const dj = segmentAxis(segs[j].a, segs[j].b);
    if (!dj) continue;
    // Παράλληλα (cross≈0) ΚΑΙ ίδια φορά (dot>0) → collinear συνέχεια της ίδιας ευθείας.
    if (Math.abs(di.x * dj.y - di.y * dj.x) < 1e-6 && di.x * dj.x + di.y * dj.y > 0) return true;
  }
  return false;
}

/**
 * ADR-449 Slice 6/10 + Δρόμος Β + PART B — κλείσιμο των **ΑΝΟΙΧΤΩΝ** άκρων (που δεν mitered-ηκαν
 * με γειτονική όψη του ΙΔΙΟΥ στοιχείου). **Τέσσερις** περιπτώσεις, ανάλογα με το είδος του γείτονα:
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
 *  - **Flush-collinear** άκρο (ADR-449 PART B — {@link hasCollinearRunNeighbor}: σύνορο per-face
 *    override πάνω σε ευθεία) → **flush pass-through** (no-op): τα δύο collinear outer σημεία
 *    συμπίπτουν ήδη στην κορυφή → ούτε chamfer (που θα τραβούσε τη γωνία μέσα κατά το πάχος —
 *    το bug των βαμμένων γωνιών) ούτε extend. Η γραμμή χρώματος μένει, η γεωμετρία περνά ίσια.
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
      } else if (hasCollinearRunNeighbor(segs, i, false)) {
        // PART B flush-collinear: σύνορο per-face override σε ευθεία → πέρνα ίσια, μηδέν chamfer.
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
      } else if (hasCollinearRunNeighbor(segs, i, true)) {
        // PART B flush-collinear: σύνορο per-face override σε ευθεία → πέρνα ίσια, μηδέν chamfer.
      } else {
        bOuter[i] = { x: bOuter[i].x - ux, y: bOuter[i].y - uy };
      }
    }
  }
}

/**
 * ADR-449 — δοκιμή miter του `b` άκρου του segment `k` με το `a` άκρο του segment `m` όταν
 * μοιράζονται κορυφή (convex → extend, reflex → trim, αιχμηρή → square). Mutates τα outer/mit
 * arrays. No-op αν: ήδη mitered, degenerate offset, μη-κοινή κορυφή, ή πέρα από το miter limit.
 * ΕΝΑ SSoT — το καλεί ΚΑΙ το positional pass ΚΑΙ το geometry pass (multi-ring silhouette).
 */
function tryMiterPair(
  k: number,
  m: number,
  segs: readonly FinishFaceSegment[],
  offsets: readonly (Vec2 | null)[],
  aOuter: Vec2[],
  bOuter: Vec2[],
  aMit: boolean[],
  bMit: boolean[],
): void {
  if (k === m || bMit[k] || aMit[m]) return;
  const ok = offsets[k];
  const om = offsets[m];
  if (!ok || !om) return;
  const v = segs[k].b;
  const tol = 1e-6 * (1 + Math.hypot(v.x, v.y));
  if (Math.hypot(v.x - segs[m].a.x, v.y - segs[m].a.y) > tol) return; // όχι κοινή κορυφή
  const dCur = { x: segs[k].b.x - segs[k].a.x, y: segs[k].b.y - segs[k].a.y };
  const dNxt = { x: segs[m].b.x - segs[m].a.x, y: segs[m].b.y - segs[m].a.y };
  const mPt = lineIntersect({ x: segs[k].a.x + ok.x, y: segs[k].a.y + ok.y }, dCur, { x: segs[m].a.x + om.x, y: segs[m].a.y + om.y }, dNxt);
  if (!mPt) return;
  const offMag = Math.max(Math.hypot(ok.x, ok.y), Math.hypot(om.x, om.y));
  if (Math.hypot(mPt.x - v.x, mPt.y - v.y) > MITER_LIMIT_FACTOR * offMag) return; // αιχμηρή → square
  bOuter[k] = mPt;
  aOuter[m] = mPt;
  bMit[k] = true;
  aMit[m] = true;
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
  // Pass 1 — positional γείτονας: για ΕΝΑ ring κλείνει ΟΛΕΣ τις γωνίες (incl. wrap-around).
  for (let k = 0; k < n && n >= 2; k++) tryMiterPair(k, (k + 1) % n, segs, offsets, aOuter, bOuter, aMit, bMit);
  // Pass 2 (ADR-449 merged-silhouette fix) — geometry-based: το `segs` μπορεί να συνενώνει
  // ΠΟΛΛΑΠΛΑ rings (ένα ανά disjoint δομικό στοιχείο / τρύπα πλαισίου, ADR-449 Slice 7). Το
  // positional `(k+1)%n` wrap mis-pairs το τελευταίο edge ενός ring με το πρώτο του επόμενου →
  // η γωνία-κλείσιμο κάθε ring (seam = ΝΔ κορυφή από polygon-clipping) έμενε ανοιχτή → λάθος 45°
  // chamfer. Εδώ κάθε ανοιχτό `b` άκρο ταιριάζει με το ομόκορφο ανοιχτό `a` οποιουδήποτε segment
  // (manifold ring → 1 in / 1 out ανά κορυφή → μη-διφορούμενο· single ring = no-op, byte-for-byte).
  for (let k = 0; k < n; k++) {
    if (bMit[k] || !offsets[k]) continue;
    const v = segs[k].b;
    const tol = 1e-6 * (1 + Math.hypot(v.x, v.y));
    for (let j = 0; j < n; j++) {
      if (j === k || aMit[j] || !offsets[j]) continue;
      if (Math.hypot(v.x - segs[j].a.x, v.y - segs[j].a.y) <= tol) {
        tryMiterPair(k, j, segs, offsets, aOuter, bOuter, aMit, bMit);
        break;
      }
    }
  }
  if (chamferOpenEnds) closeOpenOuterEnds(segs, offsets, aCore, bCore, aOuter, bOuter, aMit, bMit);
  return { aOuter, bOuter, aCore, bCore };
}

/**
 * ADR-449 — ΕΝΑ mitered plan-quad (core+outer endpoints) ανά εκτεθειμένη όψη + το segment
 * (attributes) της. **Το SSoT tuple** που καταναλώνουν ΚΑΙ το 3Δ (`buildFinishSkinFromFaces`/
 * `buildFinishSkinFromStrips`), ΚΑΙ το 2Δ/DXF (`collectFinishOutlinePlanPolylines`), ΚΑΙ ο
 * κάθετος band-merge (`mergeSilhouetteBandsToStrips`) — μηδέν διπλότυπο της offset→miter
 * ακολουθίας. Οι consumers ταξινομούν τα 4 σημεία όπως χρειάζονται (3Δ: aCore→bCore→bOuter→
 * aOuter· 2Δ: aCore→aOuter→bOuter→bCore).
 */
export interface BandFinishQuad {
  readonly aCore: Vec2;
  readonly bCore: Vec2;
  readonly aOuter: Vec2;
  readonly bOuter: Vec2;
  readonly seg: FinishFaceSegment;
}

/**
 * ADR-449 — offset→miter ακολουθία μιας ομάδας faces → mitered quads (SSoT). Αντικαθιστά την
 * copy-paste τριάδα `segs.map(segOffsetVec)` + `computeMiteredOuter(…, true)` + skip-degenerate
 * που ήταν σε 3Δ ΚΑΙ 2Δ. `offsetScale` = `mmToSceneUnits(sceneUnits)` (thickness mm → canvas
 * units, ίδια σύμβαση με τους renderers). Degenerate offset (μηδενικό μήκος) → η όψη παραλείπεται.
 */
export function computeBandFinishQuads(
  segments: readonly FinishFaceSegment[],
  offsetScale: number,
): BandFinishQuad[] {
  const offsets = segments.map((seg) => segOffsetVec(seg, seg.thickness * offsetScale));
  const { aOuter, bOuter, aCore, bCore } = computeMiteredOuter(segments, offsets, true);
  const out: BandFinishQuad[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (!offsets[i]) continue;
    out.push({ aCore: aCore[i], bCore: bCore[i], aOuter: aOuter[i], bOuter: bOuter[i], seg: segments[i] });
  }
  return out;
}
