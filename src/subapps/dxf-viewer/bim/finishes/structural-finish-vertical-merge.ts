/**
 * ADR-449 Slice X6 — Κάθετος band-merge (ενιαία περιμετρική κουβέρτα σοβά): pure SSoT.
 *
 * Πρόβλημα: ο `computeStructuralSilhouetteBands` δίνει **μία ζώνη ανά z-breakpoint** (π.χ.
 * κολόνα+δοκάρι → `[0, soffit]` + `[soffit, top]`). Ο 3Δ builder εξωθεί **ένα prism ανά band**
 * → σε κάθε ορατή παρειά μπαίνει ένα edge-outline ανά band → **οριζόντια ραφή** στο ύψος του
 * soffit, ΑΚΟΜΗ κι όταν η παρειά είναι συνεχής (ελεύθερη). Ο κανόνας (Revit/Cinema4D/Figma):
 * συνεχής επιφάνεια ανά ορατή ομοεπίπεδη περιοχή· ραφή ΜΟΝΟ σε γωνία / αλλαγή υλικού /
 * πραγματικό γεωμετρικό όριο (πλευρά δοκαριού = κάθετη ακμή· soffit = οριζόντια ακμή).
 *
 * Γιατί το «byte-identical quad merge» ΔΕΝ αρκεί: όταν ένα δοκάρι περνά **πάνω** από την
 * κολόνα, στην πάνω band η ενιαία παρειά **σπάει σε κομμάτια (stubs)** εκατέρωθεν του δοκαριού,
 * ενώ στην κάτω band είναι **ΕΝΑ** πλήρες segment → ποτέ ταυτόσημα → καμία ένωση → η ραφή μένει.
 *
 * Λύση (big-player surface decomposition): για κάθε **ομοεπίπεδη ορατή επιφάνεια** (κοινή
 * ευθεία-στήριξης + ίδια outward πλευρά + ίδια attributes) μαζεύουμε από ΟΛΕΣ τις bands τα
 * mitered quads (reuse `computeBandFinishQuads`) ως ορθογώνια σε (t = θέση κατά μήκος, z = ύψος).
 * Σπάμε το t στα breakpoints όλων των όψεων· ανά t-κελί ενώνουμε τα z-διαστήματα σε maximal
 * z-runs· συγχωνεύουμε τα γειτονικά t-κελιά με **ίδιο** z-run → **μαξιμαλικά ορθογώνια**. Έτσι:
 *   - ελεύθερο κομμάτι παρειάς → ΕΝΑ strip δάπεδο→κορυφή (0 οριζόντια ραφή)·
 *   - κομμάτι που το κόβει δοκάρι → τελειώνει **καθαρά** στο soffit (οριζόντια ακμή = πραγματικό όριο)·
 *   - πλευρές δοκαριού → κάθετες ακμές (πραγματικό όριο).
 *
 * Τα core/outer σημεία κάθε strip προέρχονται **αυτούσια** από τα αρχικά mitered quads (στα
 * boundaries), οπότε οι γωνίες (miter/chamfer/junction-extend του Slice 5-10) διατηρούνται.
 *
 * **BOQ ταυτότητα:** ο merge είναι καθαρά **οπτικός** — τα εμβαδά/υλικά (`interiorAreaM2/
 * exteriorAreaM2`, per-element) υπολογίζονται σε ξεχωριστό path και δεν αγγίζονται.
 *
 * Pure: μηδέν globals/React/THREE/scene. Το output (`FinishStrip[]`) το καταναλώνει ο 3Δ builder
 * (`buildFinishSkinFromStrips`) ΚΑΙ ο DXF export (`collectFinishStripPlanPolylines`) — ΕΝΑ SSoT.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md §Slice X6
 * @see ./structural-finish-merge.ts — ο ΟΡΙΖΟΝΤΙΟΣ αδελφός (collinear same-band merge)
 */

import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
import { computeBandFinishQuads, type BandFinishQuad, type Vec2 } from './structural-finish-outline-geometry';
import type { SilhouetteBand } from './structural-finish-silhouette';
import type { FinishFaceSegment } from './structural-finish-types';

/**
 * Μία κατακόρυφη λωρίδα σοβά μιας ορατής παρειάς: το mitered plan-quad + attributes + το
 * **δικό της** z-διάστημα (building-relative mm). Μπορεί να καλύπτει πολλαπλά αρχικά z-bands
 * (μετά την αποσύνθεση). Οι consumers ταξινομούν τα 4 σημεία όπως χρειάζονται.
 */
export interface FinishStrip {
  readonly aCore: Vec2;
  readonly bCore: Vec2;
  readonly aOuter: Vec2;
  readonly bOuter: Vec2;
  /** Το segment (materialId/classification/thickness/colorOverride) — SSoT για χρώμα/BOQ tag. */
  readonly seg: FinishFaceSegment;
  readonly zBottomMm: number;
  readonly zTopMm: number;
}

const EPS = 1e-9;
/** Ανοχή θέσης (canvas units ≈ mm) — dedup t-boundaries/perp grouping. Features ≥ δέκατα mm. */
const POS_TOL = 1e-3;
/** Ανοχή γωνίας (rad) για ομαδοποίηση συνευθειακών όψεων. */
const ANG_TOL = 1e-4;
/** Ανοχή κατακόρυφης συνέχειας (mm). */
const Z_TOL_MM = 1e-3;
/**
 * ADR-449/534 Φ6a — Perpendicular ανοχή (building-mm) για ομαδοποίηση *near*-coplanar όψεων σοβά
 * σε ΜΙΑ συνεχή κάθετη λωρίδα (seamless δέρμα). Όψεις των οποίων οι core support lines απέχουν
 * ≤ αυτό — ΚΑΙ ταιριάζουν σε angle/side/υλικό/κατάταξη/πάχος/χρώμα — ενώνονται χωρίς ραφή· κενό
 * μεγαλύτερο = **πραγματικό σκαλί** → κρατά ραφή. 25mm = ονομαστικό εξωτερικό πάχος σοβά: πάνω από
 * τον θόρυβο (few-mm offsets από μεικτές πηγές γεωμετρίας — outline πλάκας vs footprint τοίχου,
 * σχεδόν-συνευθειακοί γειτονικοί τοίχοι) ~5×, κάτω από το μικρότερο πραγματικό reveal (~50mm) ~2×.
 * Scene units: `COPLANAR_MERGE_TOL_MM * mmToSceneUnits(units)` στο call site.
 */
const COPLANAR_MERGE_TOL_MM = 25;

/** Μία όψη ως ορθογώνιο σε (t, z), με τα αρχικά mitered core/outer σημεία στα δύο t-άκρα. */
interface FaceRect {
  readonly t0: number; // μικρότερο t
  readonly t1: number; // μεγαλύτερο t
  readonly z0: number;
  readonly z1: number;
  readonly coreT0: Vec2;
  readonly coreT1: Vec2;
  readonly outerT0: Vec2;
  readonly outerT1: Vec2;
}

/** Ομάδα ομοεπίπεδων όψεων (ίδια ευθεία-στήριξης + πλευρά + attributes). */
interface CoplanarGroup {
  /** +1 αν το αρχικό a→b των όψεων συμφωνεί με το canonical dir, αλλιώς −1 (winding SSoT). */
  sense: number;
  seg: FinishFaceSegment;
  rects: FaceRect[];
}

/**
 * ADR-534 Φ6a — Ένα band-quad ΠΡΙΝ την ομαδοποίηση: το **super-key** (όλα τα attributes ΕΚΤΟΣ
 * του perpOff — αυτό γίνεται πλέον συντεταγμένη clustering, όχι μέρος ταυτότητας) + τα πραγματικά
 * mitered σημεία + ο δικός του άξονας/sense. Το `FaceRect` χτίζεται αργότερα ({@link toRect}) με
 * τον **κοινό** άξονα του cluster, ώστε near-coplanar όψεις από διαφορετικές πηγές να δίνουν
 * συνεπή t (αλλιώς σπάει το `boundaryTs` dedup / z-stack merge).
 */
interface QuadEntry {
  readonly superKey: string;
  readonly aCore: Vec2;
  readonly bCore: Vec2;
  readonly aOuter: Vec2;
  readonly bOuter: Vec2;
  /** Δικό του `canonicalDir(aCore,bCore)` — reference άξονας όταν είναι cluster anchor. */
  readonly dir: Vec2;
  readonly sense: number;
  readonly seg: FinishFaceSegment;
  readonly z0: number;
  readonly z1: number;
}

const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
const mid = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Μοναδιαία κατεύθυνση a→b **κανονικοποιημένη** (πάντα ίδιο πρόσημο για την ίδια ευθεία). */
function canonicalDir(a: Vec2, b: Vec2): Vec2 | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < EPS) return null;
  let ux = dx / len;
  let uy = dy / len;
  if (ux < -EPS || (Math.abs(ux) < EPS && uy < 0)) { ux = -ux; uy = -uy; }
  return { x: ux, y: uy };
}

/** Ανάλυση ενός band-quad σε {group key, sense, rect} — `null` αν εκφυλισμένο. */
function analyzeQuad(q: BandFinishQuad, zb: number, zt: number): { key: string; sense: number; rect: FaceRect } | null {
  const dir = canonicalDir(q.aCore, q.bCore);
  if (!dir) return null;
  const perp: Vec2 = { x: -dir.y, y: dir.x };
  const tA = dot(q.aCore, dir);
  const tB = dot(q.bCore, dir);
  if (Math.abs(tB - tA) < POS_TOL) return null; // μηδενικό μήκος κατά μήκος → skip
  const perpOff = dot(q.aCore, perp);
  const side = Math.sign(dot(sub(mid(q.aOuter, q.bOuter), mid(q.aCore, q.bCore)), perp)) || 1;
  const angle = Math.atan2(dir.y, dir.x);
  const sense = dot(sub(q.bCore, q.aCore), dir) >= 0 ? 1 : -1;
  const key = [
    Math.round(perpOff / POS_TOL), Math.round(angle / ANG_TOL), side,
    q.seg.materialId, q.seg.classification, q.seg.thickness, q.seg.colorOverride ?? '',
  ].join('|');
  const z0 = Math.min(zb, zt);
  const z1 = Math.max(zb, zt);
  const rect: FaceRect = tA <= tB
    ? { t0: tA, t1: tB, z0, z1, coreT0: q.aCore, coreT1: q.bCore, outerT0: q.aOuter, outerT1: q.bOuter }
    : { t0: tB, t1: tA, z0, z1, coreT0: q.bCore, coreT1: q.aCore, outerT0: q.bOuter, outerT1: q.aOuter };
  return { key, sense, rect };
}

/** Ταξινομημένες μοναδικές τιμές t (dedup με POS_TOL). */
function boundaryTs(rects: readonly FaceRect[]): number[] {
  const raw = rects.flatMap((r) => [r.t0, r.t1]).sort((a, b) => a - b);
  const out: number[] = [];
  for (const t of raw) if (out.length === 0 || t - out[out.length - 1] > POS_TOL) out.push(t);
  return out;
}

/** core σημείο στο boundary `tv` (πρώτο rect endpoint που ταιριάζει). */
function coreAt(rects: readonly FaceRect[], tv: number): Vec2 {
  for (const r of rects) {
    if (Math.abs(r.t0 - tv) <= POS_TOL) return r.coreT0;
    if (Math.abs(r.t1 - tv) <= POS_TOL) return r.coreT1;
  }
  return rects[0].coreT0; // αδύνατο (κάθε boundary είναι endpoint κάποιου rect)
}

/** outer σημείο στο boundary `tv` — αυτό με τη ΜΕΓΙΣΤΗ απόκλιση από το core (κρατά miter/extend). */
function outerAt(rects: readonly FaceRect[], tv: number, core: Vec2): Vec2 {
  let best: Vec2 | null = null;
  let bestDev = -1;
  for (const r of rects) {
    const cand = Math.abs(r.t0 - tv) <= POS_TOL ? r.outerT0 : Math.abs(r.t1 - tv) <= POS_TOL ? r.outerT1 : null;
    if (!cand) continue;
    const dev = Math.hypot(cand.x - core.x, cand.y - core.y);
    if (dev > bestDev) { bestDev = dev; best = cand; }
  }
  return best ?? core;
}

/** Ένωση z-διαστημάτων σε maximal runs (contiguous ≤ Z_TOL). */
function mergeZRuns(intervals: [number, number][]): [number, number][] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const runs: [number, number][] = [[sorted[0][0], sorted[0][1]]];
  for (let i = 1; i < sorted.length; i++) {
    const last = runs[runs.length - 1];
    if (sorted[i][0] <= last[1] + Z_TOL_MM) last[1] = Math.max(last[1], sorted[i][1]);
    else runs.push([sorted[i][0], sorted[i][1]]);
  }
  return runs;
}

/** Δύο z-run λίστες ταυτίζονται (ίδιο πλήθος + ίδια όρια). */
function runsEqual(a: readonly [number, number][], b: readonly [number, number][]): boolean {
  if (a.length !== b.length) return false;
  return a.every((r, i) => Math.abs(r[0] - b[i][0]) <= Z_TOL_MM && Math.abs(r[1] - b[i][1]) <= Z_TOL_MM);
}

/** Ένα strip με σωστό winding (αρχικό a→b) από τα boundary σημεία + z-run. */
function makeStrip(
  cLo: Vec2, cHi: Vec2, oLo: Vec2, oHi: Vec2, sense: number, seg: FinishFaceSegment, z0: number, z1: number,
): FinishStrip {
  return sense >= 0
    ? { aCore: cLo, bCore: cHi, aOuter: oLo, bOuter: oHi, seg, zBottomMm: z0, zTopMm: z1 }
    : { aCore: cHi, bCore: cLo, aOuter: oHi, bOuter: oLo, seg, zBottomMm: z0, zTopMm: z1 };
}

/** Αποσύνθεση μιας ομοεπίπεδης ομάδας σε μαξιμαλικά (t-span × z-run) strips. */
function decomposeGroup(group: CoplanarGroup): FinishStrip[] {
  const { rects, sense, seg } = group;
  const tvals = boundaryTs(rects);
  if (tvals.length < 2) return [];
  const cores = tvals.map((tv) => coreAt(rects, tv));
  const outers = tvals.map((tv, i) => outerAt(rects, tv, cores[i]));
  // z-runs ανά elementary t-κελί
  const runsPerCell: [number, number][][] = [];
  for (let i = 0; i < tvals.length - 1; i++) {
    const lo = tvals[i];
    const hi = tvals[i + 1];
    const zs = rects
      .filter((r) => r.t0 <= lo + POS_TOL && r.t1 >= hi - POS_TOL)
      .map((r): [number, number] => [r.z0, r.z1]);
    runsPerCell.push(mergeZRuns(zs));
  }
  // Coalesce γειτονικά t-κελιά με ΙΔΙΟ z-run → μαξιμαλικά ορθογώνια
  const out: FinishStrip[] = [];
  let i = 0;
  while (i < runsPerCell.length) {
    if (runsPerCell[i].length === 0) { i++; continue; }
    let j = i;
    while (j + 1 < runsPerCell.length && runsEqual(runsPerCell[j + 1], runsPerCell[i])) j++;
    const lo = i;
    const hi = j + 1; // span tvals[lo]..tvals[hi]
    for (const [z0, z1] of runsPerCell[i]) {
      if (z1 - z0 <= Z_TOL_MM) continue;
      out.push(makeStrip(cores[lo], cores[hi], outers[lo], outers[hi], sense, seg, z0, z1));
    }
    i = j + 1;
  }
  return out;
}

/**
 * ADR-449 Slice X6 — SSoT: `SilhouetteBand[]` → κάθετα ενοποιημένα `FinishStrip[]`. Ομαδοποιεί
 * ΟΛΕΣ τις όψεις όλων των bands ανά ομοεπίπεδη επιφάνεια (ευθεία-στήριξης + πλευρά + attributes)
 * και αποσυνθέτει καθεμία σε μαξιμαλικά (t × z) ορθογώνια → μηδέν αυθαίρετη οριζόντια ραφή:
 * ραφή μόνο σε πραγματικό όριο (soffit / πλευρά δοκαριού / γωνία / αλλαγή υλικού).
 */
export function mergeSilhouetteBandsToStrips(
  bands: readonly SilhouetteBand[],
  sceneUnits: SceneUnits,
): FinishStrip[] {
  const s = mmToSceneUnits(sceneUnits);
  const groups = new Map<string, CoplanarGroup>();
  for (const band of bands) {
    for (const quad of computeBandFinishQuads(band.faces.segments, s)) {
      const a = analyzeQuad(quad, band.zBottomMm, band.zTopMm);
      if (!a) continue;
      const g = groups.get(a.key);
      if (g) g.rects.push(a.rect);
      else groups.set(a.key, { sense: a.sense, seg: quad.seg, rects: [a.rect] });
    }
  }
  const out: FinishStrip[] = [];
  for (const g of groups.values()) out.push(...decomposeGroup(g));
  return out;
}
