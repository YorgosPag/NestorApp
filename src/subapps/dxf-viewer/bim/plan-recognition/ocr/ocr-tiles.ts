/**
 * =============================================================================
 * ΠΛΑΚΙΔΙΑ, ΠΕΡΑΣΜΑΤΑ ΚΑΙ ΣΥΓΧΩΝΕΥΣΗ ΚΟΥΤΙΩΝ OCR (ADR-929 Φ0.3)
 * =============================================================================
 *
 * Η γεωμετρία της μετρημένης ροής του `ocr_onnx.py` (Φ0.1, με το (α) της Φ0.1δ):
 * - **Δύο περάσματα ανίχνευσης**: όρθιο, και η εικόνα στραμμένη 90° αριστερόστροφα — τα κατακόρυφα κείμενα (από κάτω
 *   προς τα πάνω, όπως γράφονται οι διαστάσεις στις κατόψεις) διαβάζονται εκεί οριζόντια.
 * - **Πλακίδια** 1280 px με επικάλυψη 200 (ο ανιχνευτής βλέπει σταθερή κλίμακα όσο μεγάλη κι αν είναι η σάρωση).
 * - **NMS ανά πέρασμα** (επικάλυψη / μικρότερο εμβαδόν > 0,3, κατά βαθμό ανίχνευσης): τα διπλά των επικαλύψεων.
 * - **(α) Διπλά πριν την ανάγνωση**: πετιέται ΜΟΝΟ κουτί που δεν «ταιριάζει» στο πέρασμά του και επικαλύπτει (> 0,5)
 *   κουτί του άλλου περάσματος που ταιριάζει — εκεί το +1 του ταιριάσματος στη συγχώνευση κερδίζει κάθε recScore ∈ [0, 1],
 *   άρα θα χανόταν ούτως ή άλλως. Μετρημένο: έξοδοι ταυτόσημες κουτί-προς-κουτί, −37…38% αναγνώσεις.
 * - **Συγχώνευση μετά την ανάγνωση**, μόνο ανάμεσα σε περάσματα (> 0,5): κερδίζει το `recScore + 1 αν ταιριάζει`.
 *
 * 🔑 «Ταιριάζει» = το κουτί είναι **επίμηκες στη φορά του περάσματος** (≥ 1,5). Το λάθος πέρασμα σπάει μια συμβολοσειρά
 *   σε σχεδόν τετράγωνα κουτιά ενός γλυφού, που δεν πρέπει να κερδίσουν.
 * 📏 Συντεταγμένες: **δείκτες pixel** (κέντρο = ακέραιος, όπως το `np.where`/OpenCV) για ανίχνευση και κόψιμο· στην έξοδο
 *   **συνεχή raster-px της αρχικής εικόνας** (κέντρο pixel = `i + ½`, ADR-794). Οι λόγοι επικάλυψης και επιμήκυνσης δεν
 *   αλλάζουν από τη μετάθεση/κλίμακα ανάμεσά τους, άρα οι αποφάσεις είναι ίδιες με τη μέτρηση.
 *
 * @module bim/plan-recognition/ocr/ocr-tiles
 */

import type { PlanePoint, Quad } from '@/lib/geometry/homography';
import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
import { rotatedRectCorners } from './min-area-rect';
import type { DetectedBox } from './ocr-det-postprocess';

/** `0` = όρθιο · `1` = εικόνα στραμμένη 90° αριστερόστροφα. */
export type OcrPass = 0 | 1;
export const OCR_PASSES: readonly OcrPass[] = [0, 1];

/** Οι μετρημένες παράμετροι της ροής (Φ0.1): αλλαγή εδώ = νέα μέτρηση στις εικόνες αναφοράς. */
export const OCR_TILING = {
  tileSize: 1280,
  tileOverlap: 200,
  /** NMS ανά πέρασμα (επικάλυψη / μικρότερο εμβαδόν). */
  passSuppression: 0.3,
  /** (α) Διπλά πριν την ανάγνωση. */
  unfitDuplicate: 0.5,
  /** Συγχώνευση των περασμάτων μετά την ανάγνωση. */
  crossPassMerge: 0.5,
  /** Λόγος πλευρών για «επίμηκες στη φορά του περάσματος». */
  fitElongation: 1.5,
  /**
   * ADR-929 Φ0.6 — ανώτατα pixel της εικόνας της ανίχνευσης: πάνω από αυτά μειώνεται με ακέραιο συντελεστή (`ocrDownscaleFor`).
   * ⏳ **ΠΡΟΣΩΡΙΝΟ**: η Φ0.1 μέτρησε ½ ανάλυση σε σάρωση 200 dpi (7696 × 7200 ⇒ 2). Οριστικό μετά τη μέτρηση στον browser
   * (Παλαιολόγου · Μαιάνδρου, συντελεστής 1 και 2: χρόνος + διαστάσεις με τιμή).
   */
  maxDetectPixels: 16_000_000,
} as const;

export interface TileRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Αξονικό κουτί `[x0, x1] × [y0, y1]`. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

/** Υποψήφιο κουτί κειμένου ενός περάσματος, πριν την ανάγνωση. */
export interface OcrCandidate {
  readonly pass: OcrPass;
  readonly detScore: number;
  /** Κορυφές με σειρά ανάγνωσης (πάνω-αριστερά · πάνω-δεξιά · κάτω-δεξιά · κάτω-αριστερά), σε δείκτες pixel της εικόνας ανίχνευσης. */
  readonly cropQuad: Quad;
  /** Το ίδιο τετράπλευρο σε συνεχή raster-px της **αρχικής** εικόνας. */
  readonly polygon: Quad;
  readonly bbox: Box;
  readonly fits: boolean;
}

/** Οι διαστάσεις της «όψης» ενός περάσματος. */
export function passViewSize(image: Pick<PlanRaster, 'width' | 'height'>, pass: OcrPass): { width: number; height: number } {
  return pass === 0 ? { width: image.width, height: image.height } : { width: image.height, height: image.width };
}

/** Η θέση (byte RGBA) στην εικόνα του pixel `(u, v)` της όψης — χωρίς να φτιαχτεί στραμμένο αντίγραφο της σάρωσης. */
export function viewPixelOffset(image: PlanRaster, pass: OcrPass, u: number, v: number): number {
  return pass === 0 ? (v * image.width + u) * 4 : (u * image.width + (image.width - 1 - v)) * 4;
}

/** Σημείο της όψης → σημείο της εικόνας (δείκτες pixel): στο πέρασμα 1 `x = W − 1 − v`, `y = u`. */
function viewToImage(pass: OcrPass, imageWidth: number, p: PlanePoint): PlanePoint {
  return pass === 0 ? p : { x: imageWidth - 1 - p.y, y: p.x };
}

/** Τα πλακίδια μιας όψης: βήμα `μέγεθος − επικάλυψη`, αρχές στο `[0, max(διάσταση − επικάλυψη, 1))`. */
export function tileRegions(width: number, height: number): TileRegion[] {
  const { tileSize, tileOverlap } = OCR_TILING;
  const step = tileSize - tileOverlap;
  const out: TileRegion[] = [];
  for (let y = 0; y < Math.max(height - tileOverlap, 1); y += step) {
    for (let x = 0; x < Math.max(width - tileOverlap, 1); x += step) {
      out.push({ x, y, width: Math.min(tileSize, width - x), height: Math.min(tileSize, height - y) });
    }
  }
  return out;
}

/** Σειρά ανάγνωσης όπως το μετρημένο `crop_rect`: πάνω-αριστερά = min(x+y) · πάνω-δεξιά = min(y−x) · κάτω-δεξιά = max(x+y) · κάτω-αριστερά = max(y−x). */
function readingOrder(corners: readonly PlanePoint[]): Quad {
  const first = (key: (p: PlanePoint) => number): PlanePoint => {
    let best = corners[0];
    for (const p of corners) if (key(p) < key(best)) best = p;
    return best;
  };
  return [first((p) => p.x + p.y), first((p) => p.y - p.x), first((p) => -(p.x + p.y)), first((p) => p.x - p.y)];
}

function mapQuad(q: Quad, f: (p: PlanePoint) => PlanePoint): Quad {
  return [f(q[0]), f(q[1]), f(q[2]), f(q[3])];
}

function boundsOf(quad: Quad): Box {
  const xs = quad.map((p) => p.x);
  const ys = quad.map((p) => p.y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function fitsPass(b: Box, pass: OcrPass): boolean {
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  return pass === 0 ? w >= OCR_TILING.fitElongation * h : h >= OCR_TILING.fitElongation * w;
}

/**
 * Κουτί του ανιχνευτή (σε δείκτες του πλακιδίου) → υποψήφιο: μετατόπιση πλακιδίου, σειρά ανάγνωσης **στην όψη**, μετά
 * στην εικόνα ανίχνευσης και τέλος σε συνεχή px της αρχικής εικόνας (`(i + ½) · συντελεστής μείωσης`).
 */
export function toCandidate(box: DetectedBox, tile: TileRegion, pass: OcrPass, imageWidth: number, downscale: number): OcrCandidate {
  const rect = { ...box.rect, cx: box.rect.cx + tile.x, cy: box.rect.cy + tile.y };
  const ordered = readingOrder(rotatedRectCorners(rect));
  const cropQuad = mapQuad(ordered, (p) => viewToImage(pass, imageWidth, p));
  const polygon = mapQuad(cropQuad, (p) => ({ x: (p.x + 0.5) * downscale, y: (p.y + 0.5) * downscale }));
  const bbox = boundsOf(polygon);
  return { pass, detScore: box.score, cropQuad, polygon, bbox, fits: fitsPass(bbox, pass) };
}

/** Επικάλυψη ως λόγος προς το **μικρότερο** από τα δύο εμβαδά (μικρό κουτί μέσα σε μεγάλο = 1). */
export function overlapOfSmaller(a: Box, b: Box): number {
  const iw = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));
  const ih = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return small > 0 ? (iw * ih) / small : 0;
}

/**
 * Άπληστη καταστολή: κατά φθίνουσα `score` (σταθερή ταξινόμηση), κρατιέται ό,τι δεν επικαλύπτει πάνω από `threshold`
 * κάποιο ήδη κρατημένο **με το οποίο συγκρίνεται** (`comparable`).
 */
function suppress<T extends { readonly bbox: Box }>(
  items: readonly T[], score: (t: T) => number, threshold: number, comparable: (a: T, b: T) => boolean,
): T[] {
  const sorted = [...items].sort((a, b) => score(b) - score(a));
  const keep: T[] = [];
  for (const it of sorted) {
    if (!keep.some((k) => comparable(k, it) && overlapOfSmaller(k.bbox, it.bbox) > threshold)) keep.push(it);
  }
  return keep;
}

/** NMS μέσα σε ένα πέρασμα (τα διπλά των επικαλύψεων των πλακιδίων). */
export function suppressWithinPass(cands: readonly OcrCandidate[]): OcrCandidate[] {
  return suppress(cands, (c) => c.detScore, OCR_TILING.passSuppression, () => true);
}

/** (α) Πετά ό,τι η συγχώνευση μετά την ανάγνωση θα έχανε ούτως ή άλλως (βλ. κεφαλίδα). Η σειρά διατηρείται. */
export function dropUnfitDuplicates(cands: readonly OcrCandidate[]): OcrCandidate[] {
  const fit = cands.filter((c) => c.fits);
  return cands.filter((c) => c.fits
    || !fit.some((k) => k.pass !== c.pass && overlapOfSmaller(c.bbox, k.bbox) > OCR_TILING.unfitDuplicate));
}

/** Συγχώνευση των περασμάτων: ανάμεσα σε επικαλυπτόμενα κουτιά **διαφορετικών** περασμάτων κερδίζει το `recScore + ταίριασμα`. */
export function mergePasses<T extends { readonly bbox: Box; readonly pass: OcrPass; readonly fits: boolean; readonly recScore: number }>(
  reads: readonly T[],
): T[] {
  return suppress(reads, (r) => r.recScore + (r.fits ? 1 : 0), OCR_TILING.crossPassMerge, (a, b) => a.pass !== b.pass);
}
