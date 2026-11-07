/**
 * ADR-929 Φ5.4 — **απολήξεις** στο άκρο μιας γραμμής: βέλος · πλάγια παύλα (tick) · κουκκίδα · κάθετη γραμμή που τη
 * διασχίζει · καμία. Μοντέλο, όχι εκπαίδευση (Lai & Kasturi 1994: ανίχνευση βελών με μοντέλο, σε κάθε προσανατολισμό).
 *
 * 🔑 **Στο πλαίσιο του τμήματος, όχι των αξόνων.** Κάθε έλεγχος είναι ακτίνα από το άκρο, σε διεύθυνση που ορίζεται από το
 * `u` και το `n` του τμήματος. Άρα το ίδιο κριτήριο ισχύει για οριζόντια, κατακόρυφη και λοξή διάσταση.
 * 🔑 **Το άκρο της Φ2 κάθεται εκεί όπου τελειώνει το συνεχές μελάνι** (`strokeExtent`): στην κορυφή του βέλους, στην πάνω
 * άκρη της κουκκίδας, πάνω στην παύλα. Γι' αυτό η κουκκίδα ψάχνεται **μέσα** από το άκρο, και η παύλα/η διασταύρωση
 * σε μικρές μετατοπίσεις προς τα μέσα.
 * 🔑 **Κάθε όριο είναι σχετικό με την πινελιά `k` και την εμβέλεια `R`** (≈ ύψος κειμένου). Κανένα mm (Δ4).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/dimension-terminators
 */

import type { PlanePoint } from '@/lib/geometry/homography';
import {
  inkFractionAlong,
  inkFractionInDisk,
  inkFractionOnCircle,
  inkThicknessAcross,
  type InkMask,
} from '@/lib/geometry/raster/ink-probe';
import type { PlanTerminatorKind } from '../plan-recognition-types';
import { endOf, type FramedSegment } from './segment-frame';

export interface TerminatorScale {
  /** Η τυπική πινελιά του σχεδίου, σε ευθυγραμμισμένα px. */
  readonly strokePx: number;
  /** Πόσο μακριά από το άκρο ψάχνεται σύμβολο (≈ ύψος κειμένου: ένα βέλος είναι περίπου όσο ένας χαρακτήρας). */
  readonly reachPx: number;
}

export interface Terminator {
  readonly kind: PlanTerminatorKind;
  readonly score: number;
}

/** Ποσοστό μελανιού πάνω από το οποίο ένα σχήμα θεωρείται παρόν. */
export const TERMINATOR_MIN_SCORE = 0.75;
/** Μισή γωνία βέλους που δοκιμάζεται (μοίρες): τα σχεδιαστικά πρότυπα δίνουν 15°–30° στην κορυφή. */
const ARROW_HALF_ANGLES_DEG = [10, 15, 20, 25, 30] as const;
/**
 * Λόγοι ακτίνας κουκκίδας / πινελιάς που δοκιμάζονται. Από 1,6: ο γεμάτος πυρήνας (`0,75·ρ`) έχει τότε διάμετρο ≥ 2,4
 * πινελιές, σαφώς φαρδύτερος από τη γραμμή. Με 1,2 μια παρειά 2 px που μετά το ίσιωμα φουσκώνει τοπικά σε 3 px
 * περνούσε για κουκκίδα (μετρημένο στις 1,3°).
 */
const DOT_RADII_STROKES = [1.6, 2, 2.6, 3.2] as const;
/** Η κουκκίδα είναι γεμάτη ως `0,75·ρ` και περιβάλλεται από χαρτί στο `1,9·ρ` (μόνο η ίδια η γραμμή διασχίζει τον κύκλο). */
const DOT_CORE = 0.75;
const DOT_RING = 1.9;
const DOT_MIN_CORE = 0.85;
const DOT_MAX_RING = 0.25;
/** Η εμβέλεια είναι τουλάχιστον τόσες πινελιές του τμήματος. */
const MIN_REACH_STROKES = 4;
/** Θέσεις (κλάσμα του μήκους) όπου μετριέται το πάχος της πινελιάς στο μελάνι. */
const THICKNESS_SAMPLES = [0.2, 0.35, 0.5, 0.65, 0.8] as const;

const add = (p: PlanePoint, v: PlanePoint, t: number): PlanePoint => ({ x: p.x + v.x * t, y: p.y + v.y * t });
const neg = (v: PlanePoint): PlanePoint => ({ x: -v.x, y: -v.y });
const unit = (v: PlanePoint): PlanePoint => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/**
 * Βέλος με κορυφή στο άκρο: δύο βραχίονες προς τα μέσα, σε μισή γωνία θ από τη γραμμή. Μετρά μόνο το κομμάτι κάθε
 * βραχίονα που έχει βγει από την ίδια τη γραμμή (απόσταση > πινελιά), αλλιώς κάθε χοντρή γραμμή θα έμοιαζε με βέλος.
 */
function arrowScore(m: InkMask, p: PlanePoint, out: PlanePoint, n: PlanePoint, sc: TerminatorScale): number {
  const inward = neg(out);
  let best = 0;
  for (const deg of ARROW_HALF_ANGLES_DEG) {
    const c = Math.cos((deg * Math.PI) / 180);
    const s = Math.sin((deg * Math.PI) / 180);
    const t0 = Math.max(sc.strokePx, (0.75 * sc.strokePx) / s);
    if (sc.reachPx - t0 < 2) continue;
    const armA = { x: inward.x * c + n.x * s, y: inward.y * c + n.y * s };
    const armB = { x: inward.x * c - n.x * s, y: inward.y * c - n.y * s };
    best = Math.max(best, Math.min(
      inkFractionAlong(m, p, armA, t0, sc.reachPx),
      inkFractionAlong(m, p, armB, t0, sc.reachPx),
    ));
  }
  return best;
}

/** Πλάγια παύλα: πινελιά υπό 45° που διασχίζει το άκρο **και προς τις δύο** μεριές. */
function tickScore(m: InkMask, p: PlanePoint, out: PlanePoint, n: PlanePoint, sc: TerminatorScale): number {
  const half = 0.45 * sc.reachPx;
  const from = 0.7 * sc.strokePx;
  if (half - from < 1.5) return 0;
  let best = 0;
  for (const shift of [0, sc.strokePx]) {
    const c = add(p, out, -shift);
    for (const dg of [unit({ x: out.x + n.x, y: out.y + n.y }), unit({ x: out.x - n.x, y: out.y - n.y })]) {
      best = Math.max(best, Math.min(inkFractionAlong(m, c, dg, from, half), inkFractionAlong(m, c, neg(dg), from, half)));
    }
  }
  return best;
}

/** Κουκκίδα: γεμάτος δίσκος λίγο μέσα από το άκρο, με χαρτί γύρω του (εκτός από τη γραμμή που μπαίνει). */
function dotScore(m: InkMask, p: PlanePoint, out: PlanePoint, sc: TerminatorScale): number {
  let best = 0;
  for (const ratio of DOT_RADII_STROKES) {
    const rho = ratio * sc.strokePx;
    const c = add(p, out, -rho);
    const core = inkFractionInDisk(m, c, DOT_CORE * rho);
    if (core >= DOT_MIN_CORE && inkFractionOnCircle(m, c, DOT_RING * rho) <= DOT_MAX_RING) best = Math.max(best, core);
  }
  return best;
}

/**
 * Κάθετη γραμμή που διασχίζει το άκρο (γραμμή επέκτασης, ή η διάσταση που περνά λίγο πέρα από αυτήν). Ασθενές τεκμήριο:
 * και ο κόμβος Τ ενός τοίχου μοιάζει έτσι. Γι' αυτό ο ταξινομητής του δίνει μικρό βάρος.
 */
function crossScore(m: InkMask, p: PlanePoint, out: PlanePoint, n: PlanePoint, sc: TerminatorScale): number {
  const reach = 0.3 * sc.reachPx;
  if (reach - sc.strokePx < 1.5) return 0;
  let best = 0;
  for (const shift of [0, sc.strokePx, 2 * sc.strokePx, reach]) {
    const c = add(p, out, -shift);
    best = Math.max(best, Math.min(
      inkFractionAlong(m, c, n, sc.strokePx, reach),
      inkFractionAlong(m, c, neg(n), sc.strokePx, reach),
    ));
  }
  return best;
}

/** Το πάχος της πινελιάς **στο μελάνι**, κάθετα στο τμήμα: διάμεσος σε πέντε σημεία κατά μήκος του. */
function measuredStroke(m: InkMask, s: FramedSegment, maxPx: number): number {
  const samples = THICKNESS_SAMPLES.map((f) => inkThicknessAcross(m, add(s.a, s.u, f * s.length), s.n, maxPx))
    .filter((w) => w > 0)
    .sort((x, y) => x - y);
  return samples.length === 0 ? 0 : samples[Math.floor(samples.length / 2)];
}

/**
 * Η κλίμακα για **αυτό** το τμήμα: η πινελιά είναι η μεγαλύτερη από την τυπική, το πάχος της ζώνης και το πάχος **στο
 * μελάνι**. Σε στραβή σάρωση η τυπική βγαίνει 1 px και η ζώνη 1,8 px (ένα μέρος πήγε σε κρόσσι), ενώ η πινελιά στην εικόνα
 * είναι ~3 px. Με μικρότερη πινελιά, κάθε άκρο τοίχου «γέμιζε» τον δίσκο της κουκκίδας (μετρημένο στις 1,3°: ψευδείς
 * κουκκίδες/παύλες σε όλες τις παρειές, p = 0,69).
 */
function localScale(m: InkMask, s: FramedSegment, sc: TerminatorScale): TerminatorScale {
  const strokePx = Math.max(sc.strokePx, s.width, measuredStroke(m, s, sc.reachPx));
  return { strokePx, reachPx: Math.max(sc.reachPx, MIN_REACH_STROKES * strokePx) };
}

/** Η απόληξη στο άκρο `which`. Τα ισχυρά σύμβολα (βέλος, παύλα, κουκκίδα) προηγούνται της διασταύρωσης. */
export function detectTerminator(m: InkMask, s: FramedSegment, which: 'start' | 'end', scale: TerminatorScale): Terminator {
  const { p, out } = endOf(s, which);
  const sc = localScale(m, s, scale);
  const strong: Terminator[] = [
    { kind: 'arrow', score: arrowScore(m, p, out, s.n, sc) },
    { kind: 'tick', score: tickScore(m, p, out, s.n, sc) },
    { kind: 'dot', score: dotScore(m, p, out, sc) },
  ];
  const best = strong.reduce((x, y) => (y.score > x.score ? y : x));
  if (best.score >= TERMINATOR_MIN_SCORE) return best;
  const cross = crossScore(m, p, out, s.n, sc);
  return cross >= TERMINATOR_MIN_SCORE ? { kind: 'cross', score: cross } : { kind: 'none', score: 0 };
}
