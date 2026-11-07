/**
 * ADR-929 Φ5.3γ — από τις **διαβασμένες διαστάσεις** που δέθηκαν στη σύντηξη σε **αναφορές βαθμονόμησης**: δύο σημεία σε
 * αρχικά pixel της εικόνας + το γραμμένο μήκος. Είναι η είσοδος του **ενός** επιλυτή (`solveCalibration`), ο ίδιος που
 * λύνει τη βαθμονόμηση δύο σημείων με το χέρι.
 *
 * 🔑 **Ποιες μπαίνουν.** Μόνο όσες η συνόρθωση κράτησε **και** ελέγχει (`status === 'consistent'`: ενεργές στο δίκτυο, με
 * ανιχνεύσιμο λάθος γραφής κάτω από το όριο). Οι υπόλοιπες φαίνονται στον άνθρωπο **με λόγο**: σύγκρουση (Baarda),
 * αμφίσημη δέση, χωρίς δέση, ή «δεν ελέγχεται από τις υπόλοιπες». Μια διάσταση που κανείς δεν ελέγχει δεν ορίζει κλίμακα.
 * 🔑 **Πού μετρά.** Τα άκρα βρίσκονται πάνω στις δύο ευθείες παρειών της δέσης, στην κάθετο της οικογένειάς τους, στο
 * σημείο της κοινής έκτασης που είναι πλησιέστερα στο κείμενο της διάστασης: εκεί που τη σημείωσε ο σχεδιαστής.
 * Χρησιμοποιείται η **παρατηρημένη** θέση των παρειών (όπως είναι στην εικόνα), όχι η συνορθωμένη: η βαθμονόμηση
 * τοποθετεί την **εικόνα**.
 * 🔑 **Χώροι pixel (Δ3).** Οι ευθείες ζουν σε ευθυγραμμισμένα px. Τα άκρα επιστρέφουν σε αρχικά px **μόνο** με το SSoT
 * `alignedPointToOriginal`. Το raster της αναγνώρισης είναι το πλέγμα `naturalBounds` (`readPlanRaster`), άρα ο ίδιος
 * χώρος με τα `pointA/B` της βαθμονόμησης.
 *
 * ΚΑΘΑΡΟ (pure) — μηδέν React/store/DOM. Ντετερμινιστικό.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/fusion/scale-references
 * @see ../../../floorplan-background/geometry/calibration-solve.ts — ο ένας επιλυτής
 */

import type { Homography, PlanePoint } from '@/lib/geometry/homography';
import type { RasterRectPx } from '../../../types/coordinate-space';
import { alignedPointToOriginal, originalRectToAligned } from '../alignment/alignment-region';
import { CALIBRATION_LIMITS } from '../../../floorplan-background/geometry/calibration-solve';
import { familyDirection, familyNormal } from './fusion-frame';
import type { FaceLine, FusedDimension, PlanDirectionFamily, PlanFusionResult } from './plan-fusion-types';

/** Γιατί μια διάσταση **δεν** μπαίνει στη λύση — πάντα με όνομα (Δ16 #4). */
type ScaleDimensionRejection = 'conflict' | 'ambiguous' | 'unbound' | 'uncheckable';

/** Μία αναφορά από διάσταση: άκρα σε **αρχικά** px της εικόνας. */
export interface PlanScaleReference {
  readonly textId: string;
  readonly valueMm: number;
  readonly a: PlanePoint;
  readonly b: PlanePoint;
  /** Το κείμενο της διάστασης (αρχικά px). */
  readonly rect: RasterRectPx;
}

export interface RejectedScaleDimension {
  readonly textId: string;
  readonly valueMm: number;
  readonly reason: ScaleDimensionRejection;
  /** Τυποποιημένο υπόλοιπο Baarda, όταν υπάρχει (εξηγεί τη σύγκρουση). */
  readonly w: number | null;
  readonly rect: RasterRectPx;
}

export interface PlanScaleReferenceSet {
  readonly used: readonly PlanScaleReference[];
  readonly rejected: readonly RejectedScaleDimension[];
}

type ReferenceFusion = Pick<PlanFusionResult, 'dimensions' | 'faceLines' | 'families'>;

export interface ReferenceAlignment {
  readonly originalToAligned: Homography;
  readonly alignedToOriginal: Homography;
}

const dot = (p: PlanePoint, q: PlanePoint): number => p.x * q.x + p.y * q.y;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Η θέση κατά μήκος της διεύθυνσης: το σημείο του κειμένου, μέσα στην κοινή έκταση των δύο παρειών. */
function stationAlong(lineA: FaceLine, lineB: FaceLine, textCentre: number): number {
  const lo = Math.max(lineA.extentMinPx, lineB.extentMinPx);
  const hi = Math.min(lineA.extentMaxPx, lineB.extentMaxPx);
  // Χωρίς κοινή έκταση (παρειές «κλιμακωτές»): το μέσο του κενού ανάμεσά τους, όπου θα έπεφτε η γραμμή διάστασης.
  return lo <= hi ? clamp(textCentre, lo, hi) : (lo + hi) / 2;
}

function referenceOf(d: FusedDimension, lines: ReadonlyMap<string, FaceLine>, families: ReadonlyMap<number, PlanDirectionFamily>, al: ReferenceAlignment): PlanScaleReference | null {
  if (d.binding === null) return null;
  const lineA = lines.get(d.binding.lineA);
  const lineB = lines.get(d.binding.lineB);
  const family = lineA ? families.get(lineA.familyId) : undefined;
  if (!lineA || !lineB || !family || lineB.familyId !== lineA.familyId) return null;
  const u = familyDirection(family);
  const n = familyNormal(family);
  const box = originalRectToAligned(d.rect, al.originalToAligned);
  const t = stationAlong(lineA, lineB, dot({ x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }, u));
  const at = (offset: number): PlanePoint => alignedPointToOriginal({ x: u.x * t + n.x * offset, y: u.y * t + n.y * offset }, al.alignedToOriginal);
  return { textId: d.textId, valueMm: d.valueMm, a: at(lineA.offsetPx), b: at(lineB.offsetPx), rect: d.rect };
}

function rejectionOf(d: FusedDimension): ScaleDimensionRejection {
  if (d.binding?.ambiguous) return 'ambiguous';
  if (d.status === 'conflict') return 'conflict';
  if (d.status === 'uncheckable') return 'uncheckable';
  return 'unbound';
}

/** Οι πιο βέβαιες πρώτες· ισοπαλία ⇒ σειρά κειμένου (ντετερμινιστικό). */
const byConfidence = (a: FusedDimension, b: FusedDimension): number =>
  b.confidence.score - a.confidence.score || a.textId.localeCompare(b.textId);

/**
 * Οι αναφορές κλίμακας μιας σύντηξης, και οι διαστάσεις που έμειναν έξω με τον λόγο τους. Το πολύ
 * `CALIBRATION_LIMITS.maxReferences` αναφορές (οι πιο βέβαιες): όριο της εγγραφής, όχι των μαθηματικών.
 */
export function planScaleReferences(fusion: ReferenceFusion, alignment: ReferenceAlignment): PlanScaleReferenceSet {
  const lines = new Map(fusion.faceLines.map((l) => [l.id, l]));
  const families = new Map(fusion.families.map((f) => [f.id, f]));
  const used: PlanScaleReference[] = [];
  const rejected: RejectedScaleDimension[] = [];
  const reject = (d: FusedDimension, reason: ScaleDimensionRejection): void => {
    rejected.push({ textId: d.textId, valueMm: d.valueMm, reason, w: d.w, rect: d.rect });
  };
  for (const d of [...fusion.dimensions].sort(byConfidence)) {
    if (d.status !== 'consistent') { reject(d, rejectionOf(d)); continue; }
    // Συμφωνεί, αλλά η λύση είναι γεμάτη: δεν απορρίπτεται, απλώς δεν χρειάζεται (οι πιο βέβαιες ήδη μέσα).
    if (used.length >= CALIBRATION_LIMITS.maxReferences) continue;
    const ref = referenceOf(d, lines, families, alignment);
    // Δέση χωρίς ευθείες στο πλαίσιο δεν πρέπει να υπάρχει· αν συμβεί, λέγεται, δεν χάνεται σιωπηλά.
    if (ref) used.push(ref);
    else reject(d, 'unbound');
  }
  return { used, rejected };
}
