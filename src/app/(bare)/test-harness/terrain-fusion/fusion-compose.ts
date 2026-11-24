/**
 * ADR-920 §14.12 Β0 — ο ψηφιδωτής του πρωτοτύπου: `(z, x, y)` + χοντρό πλακίδιο + επιφάνεια → pixels Terrarium.
 *
 * 🔑 **Το ύψος είναι καθαρή συνάρτηση του (lng, lat)** στο **κέντρο** κάθε pixel: δύο γειτονικά πλακίδια, και δύο
 * επίπεδα ζουμ, δίνουν την ίδια τιμή στο ίδιο σημείο. Καθαρό — χωρίς I/O.
 *
 * ⚠️ Γνωστό όριο του πρωτοτύπου: η διγραμμική ανάγνωση του χοντρού **κόβεται στην ακμή** του χοντρού πλακιδίου (δεν
 * διαβάζει τον γείτονα) ⇒ πάνω στο σύνορο δύο πλακιδίων z12 η κλίση μπορεί να «σπάει». Το κέντρο της δοκιμής
 * διαλέγεται μακριά από τέτοιο σύνορο· το Β3 διαβάζει και τους γείτονες.
 */

import {
  FUSION_TILE_SIZE,
  latOfMercatorY,
  lngOfMercatorX,
  smoothstep,
  writeTerrarium,
  type LngLat,
  type TileId,
} from './fusion-math';
import { classifyLocalPoint, type ProbeSurface, type SurfaceVerdict } from './synthetic-site';

/** Αποκωδικοποιημένο πλακίδιο του χοντρού: ύψη σε μέτρα, γραμμή-γραμμή από τον βορρά. */
export interface CoarseTile {
  readonly id: TileId;
  readonly size: number;
  readonly heights: Float32Array;
}

interface ComposedTile {
  readonly rgba: Uint8ClampedArray<ArrayBuffer>;
  /** `fused` = τουλάχιστον ένα pixel πήρε τιμή από τη μέτρηση ή τη ζώνη μετάβασης. */
  readonly kind: 'fused' | 'coarse' | 'flat';
  readonly measuredPixels: number;
  readonly transitionPixels: number;
}

/** Διγραμμική ανάγνωση του χοντρού στο σημείο Mercator (u, v). Χωρίς χοντρό ⇒ 0 m (στάθμη θάλασσας), ποτέ κενό. */
export function sampleCoarse(coarse: CoarseTile | null, u: number, v: number): number {
  if (coarse === null) return 0;
  const { id, size, heights } = coarse;
  const n = 2 ** id.z;
  const px = Math.min(size - 1, Math.max(0, (u * n - id.x) * size - 0.5));
  const py = Math.min(size - 1, Math.max(0, (v * n - id.y) * size - 0.5));
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const x1 = Math.min(size - 1, x0 + 1), y1 = Math.min(size - 1, y0 + 1);
  const fx = px - x0, fy = py - y0;
  const top = heights[y0 * size + x0] * (1 - fx) + heights[y0 * size + x1] * fx;
  const bottom = heights[y1 * size + x0] * (1 - fx) + heights[y1 * size + x1] * fx;
  return top * (1 - fy) + bottom * fy;
}

/** Το πλαίσιο του πλακιδίου σε τοπικά μέτρα της επιφάνειας — για το γρήγορο «δεν αγγίζει το οικόπεδο». */
function tileTouchesReach(tile: TileId, surface: ProbeSurface): boolean {
  const n = 2 ** tile.z;
  const { center } = surface.spec;
  const west = (lngOfMercatorX(tile.x / n) - center.lng) * surface.metresPerDegLng;
  const east = (lngOfMercatorX((tile.x + 1) / n) - center.lng) * surface.metresPerDegLng;
  const north = (latOfMercatorY(tile.y / n) - center.lat) * surface.metresPerDegLat;
  const south = (latOfMercatorY((tile.y + 1) / n) - center.lat) * surface.metresPerDegLat;
  const { reach } = surface;
  return east >= reach.minX && west <= reach.maxX && north >= reach.minY && south <= reach.maxY;
}

/** Η μέτρηση μένει αμετάβλητη· στη ζώνη το χοντρό έλκεται προς το ύψος της ακμής· έξω ισχύει το χοντρό. */
function fuse(coarseHeightM: number, verdict: SurfaceVerdict): number {
  if (verdict.kind === 'measured') return verdict.heightM;
  if (verdict.kind === 'transition') return coarseHeightM + verdict.weight * (verdict.edgeHeightM - coarseHeightM);
  return coarseHeightM;
}

interface RowContext {
  readonly tile: TileId;
  readonly coarse: CoarseTile | null;
  /** `null` ⇒ το πλακίδιο δεν αγγίζει το οικόπεδο: μόνο αναδειγματοληψία του χοντρού. */
  readonly surface: ProbeSurface | null;
  readonly rgba: Uint8ClampedArray;
}

/** Ψηφιδώνει τη γραμμή `row` και επιστρέφει `[μετρημένα, μετάβασης]` pixels. */
function composeRow(context: RowContext, row: number): readonly [number, number] {
  const { tile, coarse, surface, rgba } = context;
  const size = FUSION_TILE_SIZE;
  const n = 2 ** tile.z;
  const v = (tile.y + (row + 0.5) / size) / n;
  const localY = surface === null ? 0 : (latOfMercatorY(v) - surface.spec.center.lat) * surface.metresPerDegLat;
  let measured = 0, transition = 0;
  for (let column = 0; column < size; column++) {
    const u = (tile.x + (column + 0.5) / size) / n;
    let heightM = sampleCoarse(coarse, u, v);
    if (surface !== null) {
      const localX = (lngOfMercatorX(u) - surface.spec.center.lng) * surface.metresPerDegLng;
      const verdict = classifyLocalPoint(surface, localX, localY, smoothstep);
      heightM = fuse(heightM, verdict);
      if (verdict.kind === 'measured') measured++;
      else if (verdict.kind === 'transition') transition++;
    }
    writeTerrarium(rgba, (row * size + column) * 4, heightM);
  }
  return [measured, transition];
}

export function composeTile(tile: TileId, coarse: CoarseTile | null, surface: ProbeSurface | null): ComposedTile {
  const size = FUSION_TILE_SIZE;
  const rgba = new Uint8ClampedArray(size * size * 4);
  const touching = surface !== null && tileTouchesReach(tile, surface) ? surface : null;
  const context: RowContext = { tile, coarse, surface: touching, rgba };
  let measuredPixels = 0, transitionPixels = 0;
  for (let row = 0; row < size; row++) {
    const [measured, transition] = composeRow(context, row);
    measuredPixels += measured;
    transitionPixels += transition;
  }
  const kind = measuredPixels + transitionPixels > 0 ? 'fused' : coarse === null ? 'flat' : 'coarse';
  return { rgba, kind, measuredPixels, transitionPixels };
}

/** Το ύψος της σύντηξης σε ένα σημείο — η **ίδια** συνάρτηση που γεμίζει τα pixels, για τους ελέγχους της σελίδας. */
export function fusedHeightAt(point: LngLat, coarseHeightM: number, surface: ProbeSurface | null): number {
  if (surface === null) return coarseHeightM;
  const x = (point.lng - surface.spec.center.lng) * surface.metresPerDegLng;
  const y = (point.lat - surface.spec.center.lat) * surface.metresPerDegLat;
  return fuse(coarseHeightM, classifyLocalPoint(surface, x, y, smoothstep));
}
