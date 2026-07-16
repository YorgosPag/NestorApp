/**
 * ADR-608 Φ-import-svg (export) — **SVG glyph → neutral `Entity[]`** (SSoT).
 *
 * Το τρίτο μέλος του `AnnotationSymbolPrimitive` union (`kind: 'svg'`, Bézier paths +
 * circles + lines) «σπάει» σε flat γεωμετρία για DXF/PDF-vector — όπως Revit/ArchiCAD/
 * AutoCAD κάνουν explode τα σύμβολα κατά την εξαγωγή. Οι Bézier καμπύλες
 * δειγματοληπτούνται μέσω του καθαρού SSoT `flattenSvgPathData`· τα σημεία περνούν από
 * το **ΙΔΙΟ** viewBox→world affine με τον on-screen renderer (`stampSvgGlyph`), ώστε η
 * εξαγόμενη γεωμετρία να κάθεται ακριβώς εκεί που τη βλέπει ο χρήστης.
 *
 * viewBox (Y-down) → unit space (Y-up, height-normalized, κεντραρισμένο στο σημείο
 * εισαγωγής): `u = [(px − cx)/h, −(py − cy)/h]`, όπου `cx,cy` το κέντρο του viewBox και
 * `h` το ύψος του — μετά `toWorld(u)` (position + modelSize·R). Τα ΜΗΚΗ (ακτίνα κύκλου)
 * κλιμακώνονται με `(L/h)·modelSize`, όπως τα primitive glyphs.
 *
 * @see rendering/entities/shared/symbol-primitive-stamp.ts — ο on-screen αντίστοιχος (`stampSvgGlyph`)
 * @see utils/geometry/svg-path-flatten.ts — ο SSoT parser/flattener
 * @see export/core/neutral-primitive-factory.ts — οι neutral entity builders (+ `circlePolygon`)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import type { AnnotationSymbolPoint } from '../../config/annotation-symbol-catalog';
import type { AnnotationSymbolSvg } from '../../config/annotation-symbol-svg-types';
import { flattenSvgPathData } from '../../utils/geometry/svg-path-flatten';
import { makeLine, makePolyline, makeCircle, makeSolidFill, circlePolygon } from './neutral-primitive-factory';

/** Ανοχή χορδής flattening ως κλάσμα της διαγωνίου του viewBox — ομαλή καμπύλη σε κάθε zoom. */
const FLATTEN_TOLERANCE_FRACTION = 0.0025;

/**
 * Decompose ενός SVG glyph σε neutral entities. `toWorld` + `modelSize` παρέχονται από
 * τον `annotation-to-primitives` (ίδια με τα υπόλοιπα symbol primitives). Εκφυλισμένο
 * viewBox (ύψος 0) → `[]`.
 */
export function svgGlyphToEntities(
  prim: AnnotationSymbolSvg,
  source: Entity,
  toWorld: (p: AnnotationSymbolPoint) => Point2D,
  modelSize: number,
  idFor: () => string,
): Entity[] {
  const [minX, minY, w, h] = prim.viewBox;
  if (h === 0) return [];
  const cx = minX + w / 2, cy = minY + h / 2;
  const svgToWorld = (px: number, py: number): Point2D => toWorld([(px - cx) / h, -(py - cy) / h]);
  const lengthToWorld = (len: number): number => (len / h) * modelSize;
  const tol = Math.hypot(w, h) * FLATTEN_TOLERANCE_FRACTION;

  const out: Entity[] = [];
  for (const el of prim.elements) {
    if (el.el === 'path') {
      appendPath(el.d, el.fill, tol, svgToWorld, source, idFor, out);
    } else if (el.el === 'circle') {
      appendCircle(el, lengthToWorld, svgToWorld, source, idFor, out);
    } else {
      out.push(makeLine(source, idFor(), svgToWorld(el.x1, el.y1), svgToWorld(el.x2, el.y2)));
    }
  }
  return out;
}

/** `<path>` → subpaths → πολυγραμμές (fill → solid-fill + περίγραμμα, mirror του polyline case). */
function appendPath(
  d: string, fill: boolean, tol: number,
  svgToWorld: (px: number, py: number) => Point2D,
  source: Entity, idFor: () => string, out: Entity[],
): void {
  for (const sub of flattenSvgPathData(d, { tolerance: tol })) {
    const verts = sub.points.map((p) => svgToWorld(p.x, p.y));
    if (verts.length < 2) continue;
    if (fill && sub.closed) {
      out.push(makeSolidFill(source, idFor(), verts));
      out.push(makePolyline(source, idFor(), verts, true));
    } else {
      out.push(makePolyline(source, idFor(), verts, sub.closed));
    }
  }
}

/** `<circle>` → filled solid ή περίγραμμα κύκλου (mirror του annotation `circle` case). */
function appendCircle(
  el: { cx: number; cy: number; r: number; fill: boolean },
  lengthToWorld: (len: number) => number,
  svgToWorld: (px: number, py: number) => Point2D,
  source: Entity, idFor: () => string, out: Entity[],
): void {
  const center = svgToWorld(el.cx, el.cy);
  const radius = lengthToWorld(el.r);
  if (el.fill) out.push(makeSolidFill(source, idFor(), circlePolygon(center, radius)));
  else out.push(makeCircle(source, idFor(), center, radius));
}
