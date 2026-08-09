/**
 * Ο ζωγράφος του υποβάθρου: παίρνει τα πλακίδια και τα ακουμπά στο χαρτί, **παραμορφωμένα** κατά
 * το πλέγμα του {@link ./basemap-warp}.
 *
 * ## Πώς ζωγραφίζεται ένα καμπύλο τετράπλευρο σε καμβά 2Δ
 * Ο καμβάς 2Δ δεν ξέρει από υφές: ξέρει `drawImage` με **αφινικό** μετασχηματισμό. Ένα αφινικό
 * αντιστοιχίζει ακριβώς **τρία** σημεία, δηλαδή ένα τρίγωνο. Άρα κάθε κελί του πλέγματος
 * κόβεται σε δύο τρίγωνα, και για καθένα: `clip` στο τρίγωνο → `setTransform` στο αφινικό που
 * φέρνει τις τρεις κορυφές της εικόνας πάνω στις τρεις της οθόνης → `drawImage` ολόκληρης της
 * εικόνας. Το clip κρατά μόνο το κομμάτι που ανήκει. Είναι η ίδια τεχνική που χρησιμοποιεί κάθε
 * μηχανή επαναπροβολής raster στον browser.
 *
 * ## ⚠️ Η διαστολή του clip δεν είναι καλλωπισμός
 * Δύο γειτονικά τρίγωνα που μοιράζονται ακμή ζωγραφίζονται με anti-aliasing στα άκρα τους, και
 * τα δύο ημιδιαφανή περιγράμματα **δεν** αθροίζονται σε αδιαφανές: μένει μια γραμμή φόντου ενός
 * εικονοστοιχείου. Σε πλέγμα 8×8 αυτό είναι εκατόν είκοσι οκτώ ορατές ραφές πάνω στον χάρτη. Η
 * διαστολή κατά μισό εικονοστοιχείο προς τα έξω τις καλύπτει· η επικάλυψη είναι αόρατη γιατί τα
 * γειτονικά τρίγωνα προέρχονται από την **ίδια συνεχή** εικόνα.
 */

import { CoordinateTransforms as CT } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { WorldToDisplayProjector } from '../geo-referencing/geo-transform';
import { buildTileWarpMesh, meshVertex, type TileWarpMesh, type WarpVertex } from './basemap-warp';
import { getTileImage } from './basemap-tile-cache';
import type { BasemapSource } from './basemap-source';
import type { TileId } from './web-mercator';

/** Διαστολή του clip προς τα έξω, σε εικονοστοιχεία — δες την επικεφαλίδα για το γιατί. */
const SEAM_BLEED_PX = 0.5;

export interface BasemapPaintOptions {
  readonly source: BasemapSource;
  readonly tiles: readonly TileId[];
  readonly projector: WorldToDisplayProjector | null;
  readonly opacity: number;
}

/** Ένα τρίγωνο έτοιμο για ζωγραφική: κορυφές στην εικόνα (px) και στην οθόνη (px). */
interface Triangle {
  readonly image: readonly Point2D[];
  readonly screen: readonly Point2D[];
}

/** Η κορυφή σε εικονοστοιχεία **της εικόνας** του πλακιδίου. */
function imagePoint(vertex: WarpVertex, tileSizePx: number): Point2D {
  return { x: vertex.u * tileSizePx, y: vertex.v * tileSizePx };
}

/**
 * Τα τρίγωνα ενός πλέγματος, με τις κορυφές ήδη μεταφρασμένες σε οθόνη.
 *
 * Κάθε κελί σπάει στη διαγώνιο ΒΔ→ΝΑ. Η επιλογή διαγωνίου είναι αυθαίρετη αλλά **σταθερή**:
 * αν άλλαζε ανά κελί, γειτονικά κελιά θα προσέγγιζαν την ίδια ακμή με διαφορετικό τρόπο και θα
 * εμφανιζόταν ραφή που καμία διαστολή δεν καλύπτει.
 */
function meshTriangles(
  mesh: TileWarpMesh,
  tileSizePx: number,
  transform: ViewTransform,
  viewport: Viewport,
): Triangle[] {
  const toScreen = (v: WarpVertex): Point2D => CT.worldToScreen(v.display, transform, viewport);
  const triangles: Triangle[] = [];
  for (let row = 0; row < mesh.divisions; row += 1) {
    for (let col = 0; col < mesh.divisions; col += 1) {
      const tl = meshVertex(mesh, row, col);
      const tr = meshVertex(mesh, row, col + 1);
      const br = meshVertex(mesh, row + 1, col + 1);
      const bl = meshVertex(mesh, row + 1, col);
      triangles.push(
        {
          image: [imagePoint(tl, tileSizePx), imagePoint(tr, tileSizePx), imagePoint(br, tileSizePx)],
          screen: [toScreen(tl), toScreen(tr), toScreen(br)],
        },
        {
          image: [imagePoint(tl, tileSizePx), imagePoint(br, tileSizePx), imagePoint(bl, tileSizePx)],
          screen: [toScreen(tl), toScreen(br), toScreen(bl)],
        },
      );
    }
  }
  return triangles;
}

/** Το κεντροειδές τριών σημείων — η αναφορά της διαστολής. */
function centroid(points: readonly Point2D[]): Point2D {
  return {
    x: (points[0].x + points[1].x + points[2].x) / 3,
    y: (points[0].y + points[1].y + points[2].y) / 3,
  };
}

/** Το σημείο σπρωγμένο κατά `SEAM_BLEED_PX` μακριά από το κεντροειδές. */
function bleedOutward(point: Point2D, from: Point2D): Point2D {
  const dx = point.x - from.x;
  const dy = point.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return point;
  const factor = (length + SEAM_BLEED_PX) / length;
  return { x: from.x + dx * factor, y: from.y + dy * factor };
}

/**
 * Ο αφινικός μετασχηματισμός που φέρνει τις τρεις κορυφές της εικόνας πάνω στις τρεις της οθόνης,
 * ή `null` για εκφυλισμένο τρίγωνο (μηδενικό εμβαδόν στην εικόνα).
 *
 * Ο έλεγχος εκφυλισμού **δεν** παραλείπεται: μια διαίρεση με μηδέν εδώ δίνει `NaN` στη μήτρα, το
 * `setTransform` το δέχεται σιωπηλά, και ο καμβάς σταματά να ζωγραφίζει **για το υπόλοιπο του
 * καρέ**. Δηλαδή η βλάβη θα εμφανιζόταν ως «ο χάρτης εξαφανίζεται τυχαία».
 */
function affineFromTriangle(t: Triangle): DOMMatrix2DInit | null {
  const [i0, i1, i2] = t.image;
  const [s0, s1, s2] = t.screen;
  const du1 = i1.x - i0.x;
  const dv1 = i1.y - i0.y;
  const du2 = i2.x - i0.x;
  const dv2 = i2.y - i0.y;
  const den = du1 * dv2 - du2 * dv1;
  if (den === 0 || !Number.isFinite(den)) return null;

  const a = ((s1.x - s0.x) * dv2 - (s2.x - s0.x) * dv1) / den;
  const b = ((s1.y - s0.y) * dv2 - (s2.y - s0.y) * dv1) / den;
  const c = ((s2.x - s0.x) * du1 - (s1.x - s0.x) * du2) / den;
  const d = ((s2.y - s0.y) * du1 - (s1.y - s0.y) * du2) / den;
  return {
    a, b, c, d,
    e: s0.x - a * i0.x - c * i0.y,
    f: s0.y - b * i0.x - d * i0.y,
  };
}

/** Ζωγραφική ενός τριγώνου: clip (διεσταλμένο) → αφινικό → η εικόνα. */
function paintTriangle(ctx: CanvasRenderingContext2D, image: CanvasImageSource, t: Triangle): void {
  const matrix = affineFromTriangle(t);
  if (!matrix) return;
  const centre = centroid(t.screen);
  const [p0, p1, p2] = t.screen.map((p) => bleedOutward(p, centre));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(matrix.a ?? 1, matrix.b ?? 0, matrix.c ?? 0, matrix.d ?? 1, matrix.e ?? 0, matrix.f ?? 0);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/**
 * Ζωγραφική **ενός** πλακιδίου. Επιστρέφει `false` όταν η εικόνα δεν είναι ακόμη διαθέσιμη — ο
 * καλών δεν κάνει τίποτα γι' αυτό, απλώς το πλακίδιο θα εμφανιστεί σε επόμενο καρέ.
 */
function paintTile(
  ctx: CanvasRenderingContext2D,
  tile: TileId,
  options: BasemapPaintOptions,
  transform: ViewTransform,
  viewport: Viewport,
): boolean {
  const image = getTileImage(options.source, tile);
  if (!image) return false;
  const mesh = buildTileWarpMesh(tile, options.projector, transform.scale);
  for (const triangle of meshTriangles(mesh, options.source.tileSizePx, transform, viewport)) {
    paintTriangle(ctx, image, triangle);
  }
  return true;
}

/**
 * Ζωγραφική ολόκληρου του υποβάθρου.
 *
 * ⚠️ Η αδιαφάνεια μπαίνει **μία** φορά, γύρω από όλα τα πλακίδια, όχι ανά πλακίδιο: με
 * `globalAlpha` ανά πλακίδιο, οι επικαλύψεις που εισάγει η διαστολή ραφών θα ζωγραφίζονταν δύο
 * φορές και θα φαινόταν πιο σκούρο πλέγμα γραμμών πάνω στον χάρτη — δηλαδή η θεραπεία της ραφής
 * θα γεννούσε ορατή ραφή με άλλο χρώμα.
 */
export function paintBasemap(
  ctx: CanvasRenderingContext2D,
  transform: ViewTransform,
  viewport: Viewport,
  options: BasemapPaintOptions,
): void {
  if (options.tiles.length === 0 || options.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = options.opacity;
  // Η βελτιωμένη ποιότητα αφορά τη σμίκρυνση των πλακιδίων· χωρίς αυτήν, ο χάρτης «τρεμοπαίζει»
  // (aliasing) σε κάθε βήμα zoom, που διαβάζεται ως αστάθεια της προβολής.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const tile of options.tiles) {
    paintTile(ctx, tile, options, transform, viewport);
  }
  ctx.restore();
}
