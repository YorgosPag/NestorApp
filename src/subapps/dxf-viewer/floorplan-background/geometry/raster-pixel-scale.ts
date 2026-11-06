/**
 * SSoT — «πόσα μέτρα του πραγματικού κόσμου είναι ένα pixel αυτής της εικόνας υποβάθρου;»
 *
 * 🔴 **Γιατί υπάρχει (ADR-929 Δ3/Δ4, 2026-11-04).** Η απάντηση ζει σε **δύο** αποθηκευμένα πεδία του
 * ίδιου εγγράφου, που τα γράφουν **δύο** διάλογοι με διαφορετική σημασιολογία:
 *
 * | Πεδίο | Ποιος το γράφει | Τι σημαίνει |
 * |---|---|---|
 * | `calibration` + `transform.scaleX/Y` | `CalibrationDialog` του DXF viewer (`calibration-solve`) | Η βαθμονόμηση **θέτει** την κλίμακα του υποβάθρου ώστε οι γνωστές αποστάσεις να μετρούν σωστά στις **μονάδες της σκηνής** (`calibration.sceneUnits`) |
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
import { sceneUnitsToMeters } from '../../utils/scene-units';
import type { CalibrationData, FloorplanBackground } from '../providers/types';

/**
 * Μέτρα ανά μονάδα σκηνής για μια βαθμονόμηση. ADR-929 Φ5.2 (§6.1 #1): εδώ ήταν σταθερά `0.001` — η
 * υπόθεση «σκηνή σε mm» — και σε σκηνή σε μέτρα η κλίμακα έβγαινε 1000× λάθος. Οι εγγραφές από τη Φ5.2
 * κρατούν τις μονάδες τους· οι παλιότερες υπολογίστηκαν με την υπόθεση mm, άρα απουσία = `'mm'`.
 */
function metresPerCalibratedSceneUnit(calibration: CalibrationData): number {
  return sceneUnitsToMeters(calibration.sceneUnits ?? 'mm');
}

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
  const metresPerUnit = metresPerCalibratedSceneUnit(bg.calibration);
  const x = Math.hypot(m.a, m.b) * metresPerUnit;
  const y = Math.hypot(m.c, m.d) * metresPerUnit;
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

/**
 * ADR-929 Φ5.2γ — η κλίμακα της **συλλογής** (`scale`, pixel εικόνας ανά μέτρο) που αντιστοιχεί σε μια
 * βαθμονόμηση του viewer, ώστε viewer και συλλογή να λένε το ίδιο (ADR-929 Δ4). Τη γράφει ο server στο ίδιο
 * batch με τη βαθμονόμηση. Χωριστή κλίμακα X/Y ⇒ γεωμετρικός μέσος (η συλλογή έχει μία τιμή).
 *
 * ⚠️ Μόνο για **εικόνες** — ίδιο δηλωμένο όριο [Α] με το `fromGalleryScale`: για PDF ο χώρος pixel της
 * συλλογής δεν έχει επαληθευτεί ότι είναι το πλέγμα του `PdfPageProvider`.
 */
export function galleryScaleForCalibration(
  bg: Omit<RasterScaleInput, 'scale'>,
): { unitsPerMeter: number; sourceUnit: 'pixel' } | null {
  if (bg.providerId !== 'image') return null;
  const viewer = fromViewerCalibration(bg);
  if (!viewer) return null;
  const metresPerPixel = Math.sqrt(viewer.metresPerPixelX * viewer.metresPerPixelY);
  return isPositiveFinite(metresPerPixel) ? { unitsPerMeter: 1 / metresPerPixel, sourceUnit: 'pixel' } : null;
}
