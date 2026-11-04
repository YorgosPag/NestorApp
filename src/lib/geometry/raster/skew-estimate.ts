/**
 * =============================================================================
 * ΕΚΤΙΜΗΣΗ ΚΛΙΣΗΣ (DESKEW) ΜΕ ΠΡΟΦΙΛ ΠΡΟΒΟΛΗΣ — ΔΙΑΦΟΡΙΚΟ ΑΘΡΟΙΣΜΑ ΤΕΤΡΑΓΩΝΩΝ (SSoT)
 * =============================================================================
 *
 * 🏆 **Η μέθοδος του Leptonica** (`pixFindSkew`, BSD-2 — ο πυρήνας του Tesseract): για κάθε υποψήφια γωνία, οι γραμμές
 *   μελανιού προβάλλονται κάθετα· όταν η γωνία είναι σωστή, κάθε ευθεία πέφτει σε **ένα** bin και το προφίλ γίνεται
 *   «αιχμηρό». Σκορ = **άθροισμα τετραγώνων των διαφορών** γειτονικών bins (όχι η διακύμανση: οι διαφορές αγνοούν την
 *   αργή μεταβολή της πυκνότητας και ανταμείβουν μόνο τις ακμές). Χονδρή σάρωση και μετά διχοτόμηση του διαστήματος. Η
 *   ανασκόπηση του IEEE (2015) βρήκε τα προφίλ προβολής την **ακριβέστερη** οικογένεια μεθόδων. Ο Leptonica δηλώνει
 *   ακρίβεια «όχι καλύτερη από 1 / πλάτος» (≈ 0,03° σε 2000 px).
 *
 * ➕ **Πέρα από εκείνον, για κατόψεις:**
 *   1. **Γραμμές ΚΑΙ στήλες.** Το κείμενο έχει μόνο οριζόντιες γραμμές· η κάτοψη έχει τοίχους και στους δύο άξονες. Το σκορ
 *      αθροίζει το προφίλ **κάθετα** στη γωνία και το προφίλ **κατά μήκος** της (γωνία + 90°): διπλάσιο σήμα, και μια
 *      κάτοψη με λίγους οριζόντιους τοίχους δεν «χάνεται».
 *   2. **Bins ¼ pixel + γκαουσιανή εξομάλυνση σ = 1 px**: το σκορ γίνεται συνεχές ως προς τη γωνία **και** ανεξάρτητο από
 *      τη φάση των γραμμών ως προς το πλέγμα, οπότε η διχοτόμηση συγκλίνει **κάτω** από το όριο 1 / πλάτος του σκληρού
 *      binning χωρίς να «κολλά» στις 0° (βλ. `profileScore`).
 *   3. **Βεβαιότητα** στο [0, 1]: `1 − διάμεσος / μέγιστο` των σκορ της σάρωσης. Εικόνα χωρίς κυρίαρχες ευθείες (σκίτσο,
 *      θόρυβος) δίνει χαμηλή τιμή, και ο καλών **δεν** ισιώνει τυφλά (ADR-929 αρχή 4: καμία σιωπηλή μαντεψιά).
 *
 * 📐 **Σύμβαση γωνίας**: χώρος `raster-px` (`y` προς τα κάτω). Η επιστρεφόμενη `angleDeg` είναι η γωνία των κυρίαρχων
 *   ευθειών από τον άξονα `+x` προς τον `+y`. Ίσιωμα = περιστροφή της εικόνας κατά `−angleDeg` γύρω από το κέντρο.
 *
 * @module lib/geometry/raster/skew-estimate
 */

export interface SkewEstimateOptions {
  /** Εύρος αναζήτησης ±μοίρες. Ως 45°: πέρα από αυτό, `θ` και `θ ± 90°` είναι το ίδιο «ίσιο». */
  readonly maxAngleDeg: number;
  readonly coarseStepDeg: number;
  /** Η διχοτόμηση σταματά κάτω από αυτό το βήμα. */
  readonly precisionDeg: number;
  /** Ανώτατο πλήθος δειγμάτων μελανιού (ντετερμινιστική αραίωση με σταθερό βήμα, όχι τυχαία). */
  readonly maxSamples: number;
}

export const DEFAULT_SKEW_ESTIMATE: SkewEstimateOptions = {
  maxAngleDeg: 15, coarseStepDeg: 0.5, precisionDeg: 0.005, maxSamples: 300_000,
};

export interface SkewEstimate {
  readonly angleDeg: number;
  /** 0 = καμία κυρίαρχη διεύθυνση · 1 = απολύτως αιχμηρό προφίλ. */
  readonly confidence: number;
  readonly sampleCount: number;
}

interface InkSamples {
  readonly xs: Float64Array;
  readonly ys: Float64Array;
  /** Μισή διαγώνιος: κάθε προβολή πέφτει στο `[−radius, radius]`. */
  readonly radius: number;
}

function inkSamples(mask: Uint8Array, cols: number, rows: number, maxSamples: number): InkSamples {
  let total = 0;
  for (let i = 0; i < mask.length; i++) total += mask[i];
  const stride = Math.max(1, Math.ceil(total / maxSamples));
  const n = Math.floor(total / stride);
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const cx = cols / 2;
  const cy = rows / 2;
  let seen = 0;
  let k = 0;
  for (let i = 0; i < mask.length && k < n; i++) {
    if (mask[i] !== 1) continue;
    if (seen++ % stride !== 0) continue;
    xs[k] = (i % cols) + 0.5 - cx;
    ys[k] = Math.floor(i / cols) + 0.5 - cy;
    k++;
  }
  return { xs, ys, radius: Math.hypot(cx, cy) + 1 };
}

/**
 * Λεπτά bins (κλάσμα pixel) + γκαουσιανή εξομάλυνση σ = 1 px: η απάντηση σε μια ευθεία **δεν εξαρτάται από τη φάση** της
 * ως προς το πλέγμα των pixel. Μετρημένο: με γραμμική κατανομή σε bins του 1 px, ένα πλέγμα ακριβώς στις 0° διαβαζόταν
 * 0,14° — κάθε δείγμα έπεφτε στη μέση δύο bins και «θόλωνε» το προφίλ ακριβώς στη σωστή γωνία. Οι πραγματικές σαρώσεις
 * έχουν το ίδιο σχήμα (οι γραμμές ζουν σε ακέραιες σειρές), άρα η μεροληψία ήταν αληθινή, όχι του test.
 */
const BINS_PER_PX = 4;
const KERNEL_SIGMA_PX = 1;

const GAUSSIAN: Float64Array = (() => {
  const sigma = KERNEL_SIGMA_PX * BINS_PER_PX;
  const radius = Math.ceil(3 * sigma);
  const k = Float64Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  const sum = k.reduce((a, b) => a + b, 0);
  return k.map((v) => v / sum);
})();

interface ProfileBuffers {
  readonly across: Float64Array;
  readonly along: Float64Array;
  readonly smooth: Float64Array;
}

const HALF_KERNEL = (GAUSSIAN.length - 1) / 2;

function profileBuffers(radius: number): ProfileBuffers {
  const length = Math.ceil(radius * 2 * BINS_PER_PX) + GAUSSIAN.length + 2;
  return { across: new Float64Array(length), along: new Float64Array(length), smooth: new Float64Array(length) };
}

/** Διαφορικό άθροισμα τετραγώνων του εξομαλυμένου προφίλ `raw`. */
function smoothedDifferentialScore(raw: Float64Array, smooth: Float64Array): number {
  smooth.fill(0);
  for (let b = 0; b < raw.length; b++) {
    const v = raw[b];
    if (v === 0) continue;
    for (let j = 0; j < GAUSSIAN.length; j++) smooth[b + j - HALF_KERNEL] += v * GAUSSIAN[j];
  }
  let score = 0;
  for (let b = 1; b < smooth.length; b++) { const d = smooth[b] - smooth[b - 1]; score += d * d; }
  return score;
}

/**
 * Σκορ στη γωνία `angleDeg`: προφίλ **κάθετα** και **κατά μήκος**, σε **ένα** πέρασμα των δειγμάτων. `stride > 1` =
 * αραιωμένα δείγματα για τη χονδρή σάρωση (τα σκορ συγκρίνονται μόνο με σκορ του ίδιου `stride`).
 */
function scoreAt(samples: InkSamples, angleDeg: number, buffers: ProfileBuffers, stride: number): number {
  const { xs, ys, radius } = samples;
  const { across, along, smooth } = buffers;
  const t = (angleDeg * Math.PI) / 180;
  const s = Math.sin(t);
  const c = Math.cos(t);
  const offset = radius * BINS_PER_PX + HALF_KERNEL;
  across.fill(0);
  along.fill(0);
  for (let k = 0; k < xs.length; k += stride) {
    const x = xs[k];
    const y = ys[k];
    across[Math.floor((-x * s + y * c) * BINS_PER_PX + offset)]++;
    along[Math.floor((x * c + y * s) * BINS_PER_PX + offset)]++;
  }
  return smoothedDifferentialScore(across, smooth) + smoothedDifferentialScore(along, smooth);
}

/** Αραίωση της χονδρής σάρωσης: ~75 χιλ. δείγματα αρκούν για να βρεθεί η σωστή κορυφή στο βήμα των 0,5°. */
const COARSE_SAMPLES = 75_000;

/** **Η γωνία των κυρίαρχων ευθειών** μιας μάσκας μελανιού (`1` = μελάνι). */
export function estimateSkew(
  mask: Uint8Array, cols: number, rows: number, options: SkewEstimateOptions = DEFAULT_SKEW_ESTIMATE,
): SkewEstimate {
  const samples = inkSamples(mask, cols, rows, options.maxSamples);
  if (samples.xs.length < 2) return { angleDeg: 0, confidence: 0, sampleCount: samples.xs.length };
  const bins = profileBuffers(samples.radius);
  const coarseStride = Math.max(1, Math.floor(samples.xs.length / COARSE_SAMPLES));
  const sweep: number[] = [];
  let best = 0;
  let coarseBest = -Infinity;
  const steps = Math.round(options.maxAngleDeg / options.coarseStepDeg);
  for (let i = -steps; i <= steps; i++) {
    const angle = i * options.coarseStepDeg;
    const score = scoreAt(samples, angle, bins, coarseStride);
    sweep.push(score);
    if (score > coarseBest) { coarseBest = score; best = angle; }
  }
  const median = [...sweep].sort((a, b) => a - b)[Math.floor(sweep.length / 2)];
  const confidence = coarseBest > 0 ? Math.max(0, Math.min(1, 1 - median / coarseBest)) : 0;
  let bestScore = scoreAt(samples, best, bins, 1);
  for (let delta = options.coarseStepDeg / 2; delta >= options.precisionDeg; delta /= 2) {
    const lower = scoreAt(samples, best - delta, bins, 1);
    const upper = scoreAt(samples, best + delta, bins, 1);
    if (lower > bestScore && lower >= upper) { bestScore = lower; best -= delta; } else if (upper > bestScore) { bestScore = upper; best += delta; }
  }
  return { angleDeg: best, confidence, sampleCount: samples.xs.length };
}
