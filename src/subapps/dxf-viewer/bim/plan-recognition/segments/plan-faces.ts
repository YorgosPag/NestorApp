/**
 * ADR-929 Φ2 — **ζώνη → παρειές**: η κρίση «πινελιά ή γέμισμα» και οι παρειές που δίνει κάθε ζώνη.
 *
 * 🔑 **Μία αναπαράσταση για δύο στυλ: παρειές.** Ο περιγραμμένος τοίχος είναι δύο πινελιές. Η παρειά του είναι η
 * **μέση γραμμή** κάθε πινελιάς. Ο γεμάτος τοίχος (poché) είναι μία παχιά περιοχή, και οι παρειές του είναι τα **δύο
 * όριά** της. Και στις δύο περιπτώσεις βγαίνουν παράλληλες παρειές σε απόσταση πάχους, οπότε **μία** στρατηγική
 * (`createParallelPairStrategy`, Δ7) τις κάνει τοίχους.
 *
 * 🔑 **Πινελιά ή γέμισμα; Πρώτα χωρίς κλίμακα.** Κάθε κάτοψη έχει λεπτές γραμμές (διαστάσεις, κουφώματα). Το
 * χαμηλό εκατοστημόριο του πάχους των ζωνών, σταθμισμένο με το μήκος, είναι η **τυπική πινελιά** του σχεδίου. Ζώνη
 * πολύ παχύτερη από αυτήν είναι γέμισμα. Μόνο σε καθαρό poché, χωρίς λεπτές γραμμές, αποφασίζει η κλίμακα
 * (`minFillPx`), όταν είναι γνωστή. Ποτέ «1 px = x mm».
 *
 * Οι παρειές βγαίνουν στο **πλαίσιο της ζώνης** (ευθυγραμμισμένο ή στραμμένο). Η μεταφορά τους είναι δουλειά του
 * καλούντος (`plan-segments.ts`).
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/segments/plan-faces
 */

import { bandEdgeExposure, strokeExtent, type AxisBand } from '@/lib/geometry/raster/axis-bands';
import type { Point2D } from '../../../rendering/types/Types';
import type { RasterSegment } from '../plan-recognition-types';

export interface PlanFaceOptions {
  /** Εκατοστημόριο (σταθμισμένο με μήκος) του πάχους των ζωνών που ορίζει την τυπική πινελιά. */
  readonly strokePercentile: number;
  /** Ζώνη παχύτερη από `max(fillRatio × πινελιά, πινελιά + fillMarginPx)` είναι γέμισμα. */
  readonly fillRatio: number;
  readonly fillMarginPx: number;
  /** Γέμισμα με πλήρωση κάτω από αυτό δεν είναι συμπαγές (διαγράμμιση, κείμενο): μένει πινελιά. */
  readonly minFillSolidity: number;
  /**
   * Το ελάχιστο πάχος τοίχου σε px εργασίας, όταν η κλίμακα είναι γνωστή (`null` ⇒ άγνωστη). Χρειάζεται μόνο σε
   * κάτοψη **χωρίς** λεπτές γραμμές (καθαρό poché): εκεί η «τυπική πινελιά» βγαίνει όσο ο λεπτότερος τοίχος, και το
   * σχετικό κριτήριο θα έκανε τους λεπτούς τοίχους πινελιές.
   */
  readonly minFillPx: number | null;
}

/**
 * Η μάσκα στο πλαίσιο των ζωνών (ευθυγραμμισμένο ή στραμμένο): από εκεί μετριέται πού είναι παρειά ένα όριο. Είναι
 * πάντα το **πλήρες** μελάνι του σχεδίου, ποτέ το υπόλοιπο ενός περάσματος. Στο υπόλοιπο, η σφήνα της ένωσης ενός
 * λοξού τοίχου έχει σβηστεί μαζί με τον αξονικό γείτονα, και η παρειά σταματούσε 4–7 px νωρίς (μετρημένο στη Φ2).
 */
export interface BandFrame {
  readonly mask: Uint8Array;
  readonly cols: number;
  readonly rows: number;
}

/** Κενό στο όριο ως τόσα px είναι θόρυβος, όχι κόμβος. */
const EDGE_BRIDGE_PX = 2;

/** Παρειά στο πλαίσιο της ζώνης της, πριν από κάθε ομογραφία. */
export interface BandFace {
  readonly start: Point2D;
  readonly end: Point2D;
  /** Πάχος της ζώνης κάθετα, σε px του πλαισίου (για την τοπική μέτρηση στα αρχικά px). */
  readonly width: number;
  readonly style: RasterSegment['style'];
  readonly confidence: number;
}

/** Ζώνη κοντύτερη από το πάχος της είναι η **κάθετη** τομή ενός παχιού σώματος, όχι γραμμή αυτού του άξονα. */
export const isBandLine = (band: AxisBand): boolean => band.end - band.start >= band.thickness;

/** Το εκατοστημόριο του πάχους, σταθμισμένο με το μήκος κάθε ζώνης. `null` ⇒ καμία ζώνη. */
export function weightedThicknessPercentile(bands: readonly AxisBand[], fraction: number): number | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a.thickness - b.thickness);
  const total = sorted.reduce((s, b) => s + (b.end - b.start), 0);
  let acc = 0;
  for (const b of sorted) {
    acc += b.end - b.start;
    if (acc >= fraction * total) return b.thickness;
  }
  return sorted[sorted.length - 1].thickness;
}

/**
 * Το κατώφλι γεμίσματος. Σχετικό με την τυπική πινελιά, εκτός αν η ίδια η τυπική γραμμή είναι ήδη όσο ένας τοίχος:
 * τότε το σχέδιο είναι όλο poché, και αποφασίζει η κλίμακα.
 */
export function fillThreshold(stroke: number, o: PlanFaceOptions): number {
  if (o.minFillPx !== null && stroke >= o.minFillPx) return o.minFillPx;
  return Math.max(o.fillRatio * stroke, stroke + o.fillMarginPx);
}

/** Σημείο στο πλαίσιο της ζώνης από (κατά μήκος, κάθετα). */
function bandPoint(band: AxisBand, along: number, across: number): Point2D {
  return band.axis === 'horizontal' ? { x: along, y: across } : { x: across, y: along };
}

function bandConfidence(band: AxisBand, minLength: number): number {
  return Math.min(1, band.fill) * Math.min(1, (band.end - band.start) / (4 * minLength));
}

/**
 * Πόσο έξω από το όριο μιας κάθετης πινελιάς μπορεί να πέσει το άκρο που καταλήγει σε αυτήν: ένα κρόσσι μετά το
 * ίσιωμα (μερική γραμμή, μετρημένο ως 1 px) και μισό px στρογγυλοποίησης.
 */
const STROKE_MEET_TOL_PX = 1.5;

/**
 * Η μέση γραμμή της κάθετης πινελιάς μέσα στην οποία πέφτει το άκρο `at` της `band` (`null` ⇒ ελεύθερο άκρο). Η
 * πλησιέστερη, αν είναι περισσότερες.
 */
function meetingCentre(band: AxisBand, at: number, strokes: readonly AxisBand[]): number | null {
  let best: number | null = null;
  for (const p of strokes) {
    if (p.axis === band.axis) continue;
    if (band.center < p.envelopeStart - STROKE_MEET_TOL_PX || band.center > p.envelopeEnd + STROKE_MEET_TOL_PX) continue;
    if (Math.abs(at - p.center) > p.thickness / 2 + STROKE_MEET_TOL_PX) continue;
    if (best === null || Math.abs(at - p.center) < Math.abs(at - best)) best = p.center;
  }
  return best;
}

/**
 * Πινελιά ⇒ η μέση γραμμή της. Σε περιγραμμένη κάτοψη κάθε παρειά τελειώνει πάνω σε κάθετη πινελιά (γωνία,
 * παραστάδα, κόμβος), και το άκρο της είναι η **μέση γραμμή εκείνης**: μετρημένη ήδη, υπο-pixel, ως κέντρο της κάθετης
 * ζώνης (`meetingCentre`). Ελεύθερο άκρο ⇒ μαζεύεται κατά μισό δικό του πάχος.
 * Πριν, το άκρο ήταν πάντα «τέλος διαδρομής − μισό δικό του πάχος». Αυτό υποθέτει ότι η διαδρομή σταματά ακριβώς στο
 * εξωτερικό όριο της κάθετης, ενώ μετά το ίσιωμα το κρόσσι της την πάει 1 px πιο πέρα (μετρημένο: 1,3 px σε γωνία L,
 * ADR-929 §6.3 #6).
 * Η έκταση είναι του **συνεχούς μελανιού** του πυρήνα (`strokeExtent`), όχι ο διάμεσος των γραμμών: σε πινελιά 2
 * γραμμών ο διάμεσος είναι μέσος όρος, και η μερική γραμμή μετά το ίσιωμα τραβούσε το άκρο μέσα. `reachPx > 0` (ζώνη
 * από **υπόλοιπο** μελάνι): η σάρωση συνεχίζει πέρα από την περιβάλλουσα, πάνω στο πλήρες μελάνι του πλαισίου.
 */
function strokeFace(
  band: AxisBand, strokes: readonly AxisBand[], frame: BandFrame, minLength: number, reachPx: number,
): BandFace {
  const span = strokeExtent(frame.mask, frame.cols, frame.rows, band, reachPx);
  const inset = Math.min(band.thickness / 2, (span.end - span.start) / 4);
  const metStart = meetingCentre(band, span.start, strokes);
  const metEnd = meetingCentre(band, span.end, strokes);
  const start = metStart ?? span.start + inset;
  const end = metEnd ?? span.end - inset;
  const [from, to] = end > start ? [start, end] : [span.start + inset, span.end - inset];
  return {
    start: bandPoint(band, from, band.center),
    end: bandPoint(band, to, band.center),
    width: band.thickness,
    style: 'stroke',
    confidence: bandConfidence(band, minLength),
  };
}

/**
 * Γέμισμα ⇒ τα δύο όριά του, παρειές ενός γεμάτου τοίχου, **μόνο όπου βλέπουν χαρτί** (`bandEdgeExposure`). Η ζώνη
 * ενός γεμάτου τοίχου περιλαμβάνει και το τετράγωνο της γωνίας. Μια παρειά σε όλο της το μήκος θα έφερνε τον τοίχο
 * ως την εξωτερική γωνία (μετρημένο στη Φ2: +125 mm σε τοίχο 25 cm). Έτσι η παρειά poché σπάει σε Τ και σταματά στη
 * γωνία, ακριβώς όπως η πινελιά του περιγραμμένου, και η στρατηγική ζευγών βλέπει την ίδια γεωμετρία στα δύο στυλ.
 */
function fillFaces(band: AxisBand, frame: BandFrame, minLength: number): BandFace[] {
  const half = band.thickness / 2;
  return ([-1, 1] as const).flatMap((side) => {
    const across = band.center + side * half;
    const pieces = bandEdgeExposure(frame.mask, frame.cols, frame.rows, band, side, minLength, EDGE_BRIDGE_PX, band.thickness);
    return pieces.map((piece) => ({
      start: bandPoint(band, piece.start, across),
      end: bandPoint(band, piece.end, across),
      width: band.thickness,
      style: 'fill-face' as const,
      confidence: bandConfidence(band, minLength),
    }));
  });
}

/**
 * Οι παρειές των ζωνών-γραμμών, με κατώφλι γεμίσματος `fillAbove` (από {@link fillThreshold}). `strokeReachPx`: πόσο
 * μπορεί να μακρύνει μια πινελιά πέρα από την περιβάλλουσά της, πάνω στο πλήρες μελάνι του `frame` (0 ⇒ οι ζώνες
 * βρέθηκαν ήδη στο πλήρες μελάνι).
 */
export function bandFaces(
  bands: readonly AxisBand[], frame: BandFrame, fillAbove: number, minLength: number, o: PlanFaceOptions,
  strokeReachPx = 0,
): BandFace[] {
  const lines = bands.filter(isBandLine);
  const isFill = (band: AxisBand): boolean => band.thickness >= fillAbove && band.fill >= o.minFillSolidity;
  const strokes = lines.filter((band) => !isFill(band));
  return lines.flatMap((band) => (
    isFill(band) ? fillFaces(band, frame, minLength) : [strokeFace(band, strokes, frame, minLength, strokeReachPx)]
  ));
}
