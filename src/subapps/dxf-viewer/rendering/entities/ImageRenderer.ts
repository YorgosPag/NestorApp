/**
 * ImageRenderer — ADR-651 Φάση Ε.
 *
 * 2Δ renderer για το standalone `ImageEntity` (raster εικόνα σε ορθογώνιο πλαίσιο, y-up
 * DXF INSERT σύμβαση: `position` = κάτω-αριστερή γωνία). Mirrors `ScaleBarRenderer` /
 * `HatchRenderer`: pure leaf, ΜΗΔΕΝ subscriptions σε high-frequency stores (ADR-040) — παίρνει
 * transform μέσω `setTransform()` push (BaseEntityRenderer).
 *
 * REUSE (N.18 anti-clone) — ΚΑΜΙΑ νέα cache/decode λογική:
 *  - `HatchImageCache` (ADR-643 Φ1) — η ΙΔΙΑ live decoded-image cache που τρέφει το image-fill
 *    hatch. `resolveSrc` εδώ είναι IDENTITY (το `url` του entity ΕΙΝΑΙ ήδη το src, καμία
 *    ανάγκη asset-catalog resolve). `crossOrigin: 'anonymous'` ώστε το remote asset να ΜΗΝ
 *    «μολύνει» (taint) τον καμβά — αλλιώς σπάει το `toDataURL` της raster εκτύπωσης.
 *  - `imageIntrinsicSize` (ADR-643 Φ1, hatch-image-paint.ts) — το ίδιο instanceof-ladder
 *    (HTMLImageElement/ImageBitmap/canvas → w/h) που χρησιμοποιεί το tile matrix.
 *  - `createRectangleVertices` (ADR-587 Φ9) — το ΙΔΙΟ rotated-rectangle vertex SSoT που
 *    χρησιμοποιεί το `RectangleEntity` (rotation γύρω από corner1 = `position`).
 *
 * Fill (big-player parity — Figma/Illustrator/C4D): η εικόνα ΓΕΜΙΖΕΙ ολόκληρο το ορθογώνιο
 * `width × height` ⇒ ορατό sprite ≡ πλαίσιο ≡ λαβές ≡ bounds ≡ hit-test ΠΑΝΤΑ (μηδέν
 * letterbox με λαβές «στον αέρα»). Μη-ομοιόμορφη μεσοπλευρική λαβή (E/W/S) τεντώνει την εικόνα
 * — εσκεμμένο· η ΤΟΠΟΘΕΤΗΣΗ δεν παραμορφώνει γιατί το catalog `width/height` φέρει ήδη το
 * pixel-aspect (`getSizeMm ← def.aspect = wPx/hPx`, ADR-654). Η rotation εφαρμόζεται μέσω
 * `ctx.transform()` (COMPOSE, όχι `setTransform` — σέβεται οποιοδήποτε ambient DPR scale ήδη
 * ενεργό στο context) πάνω σε 3 screen-γωνίες (bottom-left/bottom-right/top-left), ήδη rotated
 * στο WORLD frame από το `createRectangleVertices`.
 *
 * @see types/image.ts — ImageEntity contract
 * @see rendering/entities/shared/hatch-image-cache.ts — HatchImageCache (reused SSoT)
 * @see rendering/entities/shared/hatch-image-paint.ts — imageIntrinsicSize (reused SSoT)
 * @see docs/centralized-systems/reference/adrs/ADR-651-auto-title-block-generator.md
 */

import { BaseEntityRenderer } from './BaseEntityRenderer';
import type { EntityModel, Point2D, GripInfo, RenderOptions } from '../types/Types';
import type { Entity } from '../../types/entities';
import type { ImageEntity } from '../../types/image';
import { isImageEntity } from '../../types/image';
import { createRectangleVertices } from './shared/geometry-utils';
// ADR-654 — ΕΝΑ grip SSoT για render + interaction (move / rotation / 4 γωνιακές + 3 μεσοπλευρικές).
import { getImageGrips } from '../../bim/image/image-grips';
// ADR-397 — glyph shape registry (move cross / rotation arc), ίδιο pattern με κάθε άλλο renderer.
import { gripGlyphShape } from '../../bim/grips/grip-glyph-registry';
import { gripKindOf } from '../../hooks/grip-kinds';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { toRenderGripInfo } from './shared/grip-utils';
import { HatchImageCache } from './shared/hatch-image-cache';
import { imageIntrinsicSize } from './shared/image-intrinsic-size';
// ADR-040 — async asset load «σπρώχνει» ένα dirty-frame (ο renderer δεν subscribe-άρει).
import { markAllCanvasDirty } from '../core/frame-scheduler-api';
import { CAD_UI_COLORS } from '../../config/color-config';

/** [κάτω-αριστερά, κάτω-δεξιά, πάνω-δεξιά, πάνω-αριστερά] — ίδια σειρά με RectangleEntity. */
function imageEntityVertices(e: ImageEntity): Point2D[] {
  return createRectangleVertices(
    e.position,
    { x: e.position.x + e.width, y: e.position.y + e.height },
    e.rotation ?? 0,
  );
}

export class ImageRenderer extends BaseEntityRenderer {
  /**
   * ADR-643 Φ1 SSoT (reused) — identity `resolveSrc` (το `url` ΕΙΝΑΙ ήδη το src) +
   * `crossOrigin: 'anonymous'` (remote asset δεν πρέπει να «μολύνει» τον καμβά).
   */
  private readonly imageCache = new HatchImageCache(
    markAllCanvasDirty,
    async (url) => url,
    'anonymous',
  );

  render(entity: EntityModel, options: RenderOptions = {}): void {
    if (!isImageEntity(entity as Entity)) return;
    const e = entity as unknown as ImageEntity;
    this.renderWithPhases(entity, options, () => this.drawImage(e));
  }

  /** Ζωγραφίζει την εικόνα fill (γεμίζει το πλαίσιο) μέσα στο (περιστρεφόμενο) ορθογώνιο. */
  private drawImage(e: ImageEntity): void {
    const corners = imageEntityVertices(e);
    const img = this.imageCache.resolve(e.url);
    if (!img) {
      this.drawPlaceholder(corners);
      return;
    }
    // `imageIntrinsicSize` παραμένει ΜΟΝΟ ως validity guard (broken/μη-decoded image → naturalW/H = 0
    // → placeholder). Το fill ΔΕΝ χρειάζεται iw/ih για κλίμακα — γεμίζει πάντα το πλαίσιο (βλ. κάτω).
    const { w: iw, h: ih } = imageIntrinsicSize(img);
    if (iw <= 0 || ih <= 0 || e.width <= 0 || e.height <= 0) {
      this.drawPlaceholder(corners);
      return;
    }

    // Screen-γωνίες του πλαισίου: [0]=κάτω-αριστερά, [1]=κάτω-δεξιά, [3]=πάνω-αριστερά.
    const p0 = this.worldToScreen(corners[0]);
    const p1 = this.worldToScreen(corners[1]);
    const p3 = this.worldToScreen(corners[3]);

    // Screen-space vector ΑΝΑ world-unit κατά μήκος κάθε άξονα (κουβαλά zoom + rotation + Y-flip).
    const eu = { x: (p1.x - p0.x) / e.width, y: (p1.y - p0.y) / e.width };
    const ev = { x: (p3.x - p0.x) / e.height, y: (p3.y - p0.y) / e.height };

    this.ctx.save();
    // COMPOSE (ΟΧΙ setTransform) — σέβεται οποιοδήποτε ambient DPR/scale ήδη ενεργό. Το τοπικό
    // frame (local x,y σε WORLD μονάδες) αγκυρώνεται στο p3 (πάνω-αριστερά) γιατί το drawImage
    // τοπικό y αυξάνει ΠΡΟΣ ΤΑ ΚΑΤΩ ενώ το `height`-axis (ev) δείχνει ΠΡΟΣ ΤΑ ΠΑΝΩ (y-up SSoT).
    // FILL (big-player parity) — η εικόνα καλύπτει ΟΛΟΚΛΗΡΟ το [width × height] πλαίσιο (top-left
    // στο local 0,0), χωρίς fitScale/centering ⇒ ορατό sprite ≡ πλαίσιο ≡ λαβές ΠΑΝΤΑ. Μη-ομοιόμορφη
    // λαβή → η εικόνα τεντώνει και ΑΚΟΛΟΥΘΕΙ τις λαβές (Figma parity).
    this.ctx.transform(eu.x, eu.y, -ev.x, -ev.y, p3.x, p3.y);
    this.ctx.drawImage(img, 0, 0, e.width, e.height);
    this.ctx.restore();
  }

  /** Διακεκομμένο πλαίσιο όσο η εικόνα φορτώνει / απέτυχε το decode (ίδιο idiom με τα hatch fallbacks). */
  private drawPlaceholder(corners: readonly Point2D[]): void {
    const screenCorners = corners.map((c) => this.worldToScreen(c));
    this.ctx.save();
    this.ctx.strokeStyle = CAD_UI_COLORS.entity.default;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    screenCorners.forEach((p, i) => (i === 0 ? this.ctx.moveTo(p.x, p.y) : this.ctx.lineTo(p.x, p.y)));
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * ADR-654 — οι λαβές που ΖΩΓΡΑΦΙΖΟΝΤΑΙ είναι ΑΚΡΙΒΩΣ αυτές που ΠΙΑΝΟΝΤΑΙ: ένα SSoT
   * (`getImageGrips`), κοινό με το `GRIP_PRODUCERS['image']` του interaction registry.
   * Πριν: εδώ ζωγραφίζονταν 8 άτυπες (4 corner + 4 edge) λαβές χωρίς `gripKind`, ενώ το
   * registry δεν είχε producer → `[]` → οι λαβές φαίνονταν αλλά ΔΕΝ μετακινούσαν την εικόνα.
   *
   * Το `shape` ανατίθεται ΕΔΩ μέσω του κοινού `gripGlyphShape` registry (ίδιο pattern με
   * ScaleBar/OpeningInfoTag/Line/Text renderers): `image-move` → σταυρός 4-βελών, `image-rotation`
   * → καμπύλο βέλος· γωνίες/μεσοπλευρικές → default 'square'. Χωρίς αυτό, το `GripPhaseRenderer`
   * (`grip.shape ?? 'square'`) ζωγράφιζε ΟΛΕΣ τις λαβές ως τετράγωνα → τα σήματα μετακίνησης/
   * περιστροφής ΔΕΝ φαίνονταν (Giorgio 2026-07-14).
   */
  getGrips(entity: EntityModel): GripInfo[] {
    if (!isImageEntity(entity as Entity)) return [];
    return getImageGrips(entity as unknown as ImageEntity).map((g) =>
      toRenderGripInfo(g, gripGlyphShape(gripKindOf(g, 'image'))),
    );
  }

  /** Fill hit-test (point-in-polygon) — κλικ οπουδήποτε μέσα στην εικόνα την επιλέγει (mirror hatch). */
  hitTest(entity: EntityModel, point: Point2D, _tolerance: number): boolean {
    if (!isImageEntity(entity as Entity)) return false;
    const e = entity as unknown as ImageEntity;
    return isPointInPolygon(point, imageEntityVertices(e));
  }
}
