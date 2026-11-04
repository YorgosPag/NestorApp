/**
 * SSoT — «σε ποιο σημείο της σκηνής πέφτει αυτό το pixel της εικόνας υποβάθρου, και ανάποδα;»
 *
 * 🔴 **Γιατί υπάρχει (ADR-929 Δ3, 2026-11-04).** Η απάντηση δεν υπήρχε ως συνάρτηση. Ζούσε **μόνο** ως
 * σειρά από `ctx.translate/rotate/scale` μέσα στον ζωγράφο του υποβάθρου (`provider-canvas-transforms`),
 * δηλαδή ως παρενέργεια πάνω σε καμβά που δεν μπορεί να ρωτηθεί για ένα σημείο. Η αναγνώριση κάτοψης από
 * εικόνα χρειάζεται την **ίδια** απάντηση για κάθε εύρημα. Δύο γραφές της (μία για τη ζωγραφική, μία για
 * την αναγνώριση) σημαίνουν ότι η προεπισκόπηση και το αποτέλεσμα θα αποκλίνουν σιωπηλά: η πρόταση τοίχου
 * θα «έπεφτε» δίπλα στη γραμμή της εικόνας. Τώρα **ο ζωγράφος περνά από εδώ** (ένας πίνακας, ένα
 * `ctx.transform`) και η αναγνώριση ρωτά τον **ίδιο** πίνακα.
 *
 * 🔑 **Η σύνθεση, μία φορά** (σημείο `p` σε φυσικά px, Y προς τα κάτω):
 *
 *     σκηνή = T(translate) · R(rotation) · S(scaleX, scaleY) · A · p
 *
 * όπου `A` είναι η σύμβαση αξόνων:
 * - `cad-y-up` (η σκηνή του DXF viewer): `A·(x, y) = (x, h − y)`. Η κάτω-αριστερή γωνία της εικόνας
 *   κάθεται στην αρχή του υποβάθρου και το Y ανεβαίνει. Είναι η σημασιολογία του παλιού
 *   «`scale(1,−1)` + `drawImage(img, 0, −h)`», γραμμένη ως πίνακας.
 * - `screen-y-down` (σελίδα επίδειξης, χωρίς CAD): `A = I`.
 *
 * ⚠️ **Τι ΔΕΝ μπαίνει εδώ.** Η μετρική κλίμακα (μέτρα ανά pixel) είναι **άλλη** ερώτηση, με δικές της
 * πηγές και δική της αβεβαιότητα: `./raster-pixel-scale.ts`. Η απεικόνιση είναι γεωμετρία και απαντά
 * πάντα· η κλίμακα μπορεί να μην είναι γνωστή.
 *
 * @module subapps/dxf-viewer/floorplan-background/geometry/raster-scene-mapping
 * @see docs/centralized-systems/reference/adrs/ADR-929-raster-plan-recognition.md — Δ3
 * @see ../providers/provider-canvas-transforms.ts — ο ζωγράφος, ο πρώτος καταναλωτής
 */

import type { Point2D } from '../../rendering/types/Types';
import { type Affine2x3, applyAffine, composeAffine, invertAffine } from '@/lib/geometry/affine-2x3';
import type { BackgroundTransform, FloorplanBackground, NaturalBounds } from '../providers/types';

/** Η σύμβαση αξόνων της σκηνής στην οποία προβάλλεται η εικόνα. */
export type RasterAxisConvention = 'cad-y-up' | 'screen-y-down';

/**
 * Η σκηνή του DXF viewer, και άρα **κάθε** εύρημα αναγνώρισης, είναι `cad-y-up` (ο `CanvasLayerStack`
 * περνά πάντα `mode: 'cad-y-up'`). Γραμμένο ως σταθερά για να μη μαντεύει κανείς καλών.
 */
export const SCENE_RASTER_CONVENTION: RasterAxisConvention = 'cad-y-up';

/** Ό,τι χρειάζεται η απεικόνιση από ένα υπόβαθρο: πού κάθεται και πόσο ψηλή είναι η εικόνα. */
export type RasterPlacement = Pick<FloorplanBackground, 'transform' | 'naturalBounds'>;

/** Ο χρήστης δίνει μοίρες (BackgroundTransform.rotation)· ο πίνακας θέλει ακτίνια. */
const DEG_TO_RAD = Math.PI / 180;

/** `T · R · S`: θέση, περιστροφή και κλίμακα του υποβάθρου, όπως τις αποθηκεύει το ADR-340. */
export function backgroundPlacementAffine(t: BackgroundTransform): Affine2x3 {
  const rad = t.rotation * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    a: cos * t.scaleX,
    b: sin * t.scaleX,
    c: -sin * t.scaleY,
    d: cos * t.scaleY,
    e: t.translateX,
    f: t.translateY,
  };
}

/** Η σύμβαση αξόνων `A`: φυσικά px (Y κάτω) → τοπικές συντεταγμένες υποβάθρου. */
function rasterAxisAffine(bounds: NaturalBounds, convention: RasterAxisConvention): Affine2x3 {
  return convention === 'cad-y-up'
    ? { a: 1, b: 0, c: 0, d: -1, e: 0, f: bounds.height }
    : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

/** **Ο πίνακας** φυσικά px → σκηνή. Τον χρησιμοποιούν και ο ζωγράφος και η αναγνώριση. */
export function rasterToSceneAffine(
  placement: RasterPlacement,
  convention: RasterAxisConvention = SCENE_RASTER_CONVENTION,
): Affine2x3 {
  return composeAffine(
    backgroundPlacementAffine(placement.transform),
    rasterAxisAffine(placement.naturalBounds, convention),
  );
}

/**
 * Ο αντίστροφος πίνακας σκηνή → φυσικά px, ή `null` όταν η τοποθέτηση είναι εκφυλισμένη (π.χ.
 * `scaleX = 0`). Ο καλών αποφασίζει τι σημαίνει αυτό· ποτέ σιωπηλό `NaN` (ADR-929 αρχή 4).
 */
export function sceneToRasterAffine(
  placement: RasterPlacement,
  convention: RasterAxisConvention = SCENE_RASTER_CONVENTION,
): Affine2x3 | null {
  return invertAffine(rasterToSceneAffine(placement, convention));
}

/** Φυσικό pixel της εικόνας → σημείο σκηνής. */
export function rasterPixelToScene(
  pixel: Point2D,
  placement: RasterPlacement,
  convention: RasterAxisConvention = SCENE_RASTER_CONVENTION,
): Point2D {
  return applyAffine(rasterToSceneAffine(placement, convention), pixel);
}

/** Σημείο σκηνής → φυσικό pixel της εικόνας, ή `null` όταν η τοποθέτηση είναι εκφυλισμένη. */
export function sceneToRasterPixel(
  point: Point2D,
  placement: RasterPlacement,
  convention: RasterAxisConvention = SCENE_RASTER_CONVENTION,
): Point2D | null {
  const inverse = sceneToRasterAffine(placement, convention);
  return inverse ? applyAffine(inverse, point) : null;
}
