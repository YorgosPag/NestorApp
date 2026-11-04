/**
 * Ο μετασχηματισμός καμβά που εφαρμόζει **κάθε** πάροχος υποβάθρου πριν ζωγραφίσει: **ένας** πίνακας,
 * φυσικά px της εικόνας → px του καμβά.
 *
 * 🔴 **Γιατί υπάρχει (CHECK 3.28, 2026-07-31).** Οι μετασχηματισμοί ήταν γραμμένοι δύο φορές, ταυτόσημοι,
 * στον `ImageProvider` και στον `PdfPageProvider`. Ο μετασχηματισμός CAD ορίζει **πού κάθεται η αρχή του
 * κόσμου** για το υπόβαθρο, και δύο αντίγραφα θα απέκλιναν «μόνο σε έναν από τους δύο τύπους αρχείου».
 *
 * 🔴 **Γιατί είναι πλέον ΕΝΑΣ πίνακας (ADR-929 Δ3, 2026-11-04).** Μέχρι τώρα ήταν μια σειρά από
 * `translate/scale/rotate/scale(1,−1)` και ένα `drawImage(img, 0, −h)`. Η ίδια γεωμετρία χρειάζεται τώρα
 * και **εκτός** καμβά: η αναγνώριση κάτοψης από εικόνα πρέπει να ξέρει σε ποιο σημείο της σκηνής πέφτει
 * κάθε pixel. Αν η ζωγραφική κρατούσε τη δική της γραφή, η πρόταση τοίχου θα «έπεφτε» δίπλα στη γραμμή
 * που βλέπει ο χρήστης. Τώρα και τα δύο ρωτούν το `rasterToSceneAffine`, και ο καμβάς παίρνει
 * `κόσμος→οθόνη ∘ px→κόσμος` με **ένα** `ctx.transform`. Η αντιστοιχία με την παλιά αλυσίδα κλειδώνεται
 * με test ισοδυναμίας (`__tests__/raster-scene-mapping.test.ts`).
 *
 * @module subapps/dxf-viewer/floorplan-background/providers/provider-canvas-transforms
 * @see ../geometry/raster-scene-mapping.ts — η απεικόνιση px → σκηνή (SSoT)
 * @see ADR-741 — «πού είναι η περιοχή σχεδίασης» (η άγκυρα του CAD τρόπου)
 * @see ADR-732 — floorplan painter
 */

import { type Affine2x3, composeAffine, transformContext } from '@/lib/geometry/affine-2x3';
import { worldToScreenAffine } from '../../rendering/core/world-to-screen-affine';
import { rasterToSceneAffine } from '../geometry/raster-scene-mapping';
import type { NaturalBounds, ProviderRenderParams } from './types';

/**
 * Κόσμος → καμβάς για τον τρόπο του καλούντος.
 * - CAD: ο τύπος του `worldToScreen` (Y πάνω, άγκυρα στην κάτω-αριστερή γωνία της περιοχής σχεδίασης,
 *   με το chrome που **ενίεται**· ADR-741).
 * - Οθόνη: Y κάτω, καμία άγκυρα — ο καμβάς όπως είναι.
 */
function worldToCanvasAffine(params: ProviderRenderParams): Affine2x3 {
  const { worldToCanvas: w, viewport, cad } = params;
  if (cad) return worldToScreenAffine(w, viewport, cad.chrome);
  return { a: w.scale, b: 0, c: 0, d: w.scale, e: w.offsetX, f: w.offsetY };
}

/**
 * Φυσικά px της εικόνας → px του καμβά, ως **ένας** πίνακας. Μετά από αυτό ο πάροχος ζωγραφίζει την
 * εικόνα στο `(0, 0)` στο φυσικό της μέγεθος.
 *
 * ⚠️ Ο καλών κατέχει το `save()`/`restore()`. Το `ctx.transform` πολλαπλασιάζεται πάνω στο DPR που έχει
 * ήδη ο καμβάς, δεν το αντικαθιστά.
 */
export function applyRasterCanvasTransform(
  ctx: CanvasRenderingContext2D,
  params: ProviderRenderParams,
  bounds: NaturalBounds,
): void {
  const toScene = rasterToSceneAffine(
    { transform: params.transform, naturalBounds: bounds },
    params.cad ? 'cad-y-up' : 'screen-y-down',
  );
  transformContext(ctx, composeAffine(worldToCanvasAffine(params), toScene));
}
