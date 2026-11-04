/**
 * SSoT — «πόσα μέτρα του πραγματικού κόσμου είναι ένα pixel αυτής της εικόνας υποβάθρου;»
 *
 * 🔴 **Γιατί υπάρχει (ADR-929 Δ3/Δ4, 2026-11-04).** Η απάντηση ζει σε **δύο** αποθηκευμένα πεδία του
 * ίδιου εγγράφου, που τα γράφουν **δύο** διάλογοι με διαφορετική σημασιολογία:
 *
 * | Πεδίο | Ποιος το γράφει | Τι σημαίνει |
 * |---|---|---|
 * | `calibration` + `transform.scaleX/Y` | `CalibrationDialog` του DXF viewer (`useCalibration`) | Η βαθμονόμηση 2 σημείων **πολλαπλασιάζει** την κλίμακα του υποβάθρου ώστε η γνωστή απόσταση να μετρά τόσα **χιλιοστά** σκηνής (`UNIT_TO_MM`) |
 * | `scale.unitsPerMeter` (`sourceUnit: 'pixel'`) | `CalibrateScaleDialog` της συλλογής (ADR-340 Φ9) | **Pixel της εικόνας ανά μέτρο**, μετρημένα σε φυσικά pixel (`lib/geometry/scale-calibration`) |
 *
 * Η αναγνώριση κάτοψης χρειάζεται **μία** απάντηση, με την **πηγή** της (ADR-929 Δ4: η υπάρχουσα
 * βαθμονόμηση κερδίζει, οι υπόλοιπες γίνονται έλεγχος συνέπειας). Δύο καλούντες που θα διάβαζαν
 * ο καθένας «το δικό του» πεδίο θα έβγαζαν διαφορετική κλίμακα για την ίδια εικόνα.
 *
 * 🔑 **Σειρά.** 1) βαθμονόμηση 2 σημείων του viewer: είναι αυτή που **τοποθετεί** την εικόνα στη σκηνή,
 * άρα ό,τι δείχνει η οθόνη συμφωνεί μαζί της. 2) η κλίμακα της συλλογής. 3) τίποτα: `null`, ποτέ
 * υπόθεση «1 px = 1 mm».
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ [Α].** Η κλίμακα της συλλογής γίνεται δεκτή **μόνο για εικόνες**. Για PDF, ο χώρος
 * pixel στον οποίο μετρά η συλλογή **δεν έχει επαληθευτεί** ότι είναι ο ίδιος με το πλέγμα που
 * αποδίδει ο `PdfPageProvider` (απόδοση ×2). Ένας λάθος λόγος εδώ θα γινόταν σιωπηλό σφάλμα κλίμακας
 * σε κάθε τοίχο. Μέχρι να μετρηθεί, το PDF χωρίς βαθμονόμηση viewer απαντά `null`.
 *
 * @module subapps/dxf-viewer/floorplan-background/geometry/raster-pixel-scale
 * @see ./raster-scene-mapping.ts — η απεικόνιση px → σκηνή (γεωμετρία, απαντά πάντα)
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md — Δ4
 */

import { rasterToSceneAffine } from './raster-scene-mapping';
import type { FloorplanBackground } from '../providers/types';

/** Η βαθμονόμηση 2 σημείων του viewer εκφράζει την κλίμακα σε χιλιοστά σκηνής (`useCalibration`). */
const METRES_PER_CALIBRATED_SCENE_UNIT = 0.001;

/** Από πού ήρθε η κλίμακα: χρειάζεται για τη βεβαιότητα και για τον έλεγχο συνέπειας (Δ4). */
export type RasterPixelScaleSource = 'viewer-two-point-calibration' | 'gallery-scale';

export interface RasterPixelScale {
  /** Μέτρα ανά pixel κατά μήκος του άξονα X της **εικόνας**. */
  readonly metresPerPixelX: number;
  /** Μέτρα ανά pixel κατά μήκος του άξονα Y της **εικόνας**. */
  readonly metresPerPixelY: number;
  readonly source: RasterPixelScaleSource;
}

export type RasterScaleInput = Pick<
  FloorplanBackground,
  'transform' | 'naturalBounds' | 'calibration' | 'scale' | 'providerId'
>;

const isPositiveFinite = (n: number): boolean => Number.isFinite(n) && n > 0;

/**
 * Το μήκος των διανυσμάτων-στηλών του πίνακα px → σκηνή είναι το μέγεθος ενός pixel σε μονάδες σκηνής,
 * ανεξάρτητα από την περιστροφή και την αναστροφή του άξονα Y.
 */
function fromViewerCalibration(bg: RasterScaleInput): RasterPixelScale | null {
  if (!bg.calibration) return null;
  const m = rasterToSceneAffine(bg);
  const x = Math.hypot(m.a, m.b) * METRES_PER_CALIBRATED_SCENE_UNIT;
  const y = Math.hypot(m.c, m.d) * METRES_PER_CALIBRATED_SCENE_UNIT;
  if (!isPositiveFinite(x) || !isPositiveFinite(y)) return null;
  return { metresPerPixelX: x, metresPerPixelY: y, source: 'viewer-two-point-calibration' };
}

function fromGalleryScale(bg: RasterScaleInput): RasterPixelScale | null {
  if (bg.providerId !== 'image') return null; // ⚠️ ΔΗΛΩΜΕΝΟ ΟΡΙΟ: βλ. κεφαλίδα
  const s = bg.scale;
  if (!s || s.sourceUnit !== 'pixel' || !isPositiveFinite(s.unitsPerMeter)) return null;
  const metres = 1 / s.unitsPerMeter;
  return { metresPerPixelX: metres, metresPerPixelY: metres, source: 'gallery-scale' };
}

/** Η μία απάντηση, με την πηγή της· `null` όταν καμία πηγή δεν είναι γνωστή. */
export function resolveRasterPixelScale(bg: RasterScaleInput): RasterPixelScale | null {
  return fromViewerCalibration(bg) ?? fromGalleryScale(bg);
}
