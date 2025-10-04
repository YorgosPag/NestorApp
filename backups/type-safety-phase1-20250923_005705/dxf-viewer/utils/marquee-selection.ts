/**
 * MARQUEE SELECTION UTILITIES
 * AutoCAD-style window and crossing selection for DXF entities
 */

import { coordTransforms } from '../systems/rulers-grid/config';
import type { SceneModel, AnySceneEntity } from '../types/scene';
import type { Point2D, ViewTransform } from '../systems/rulers-grid/config';

type WorldRect = { minX: number; minY: number; maxX: number; maxY: number };

export const rectFromScreenPoints = (
  a: Point2D, 
  b: Point2D,
  transform: ViewTransform,
  canvasRect: DOMRect
): WorldRect => {
  const wA = coordTransforms.screenToWorld(a, transform, canvasRect);
  const wB = coordTransforms.screenToWorld(b, transform, canvasRect);
  return {
    minX: Math.min(wA.x, wB.x),
    minY: Math.min(wA.y, wB.y),
    maxX: Math.max(wA.x, wB.x),
    maxY: Math.max(wA.y, wB.y),
  };
};

const ptInRect = (p: Point2D, r: WorldRect) =>
  p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;

const bboxIntersects = (bb: {min: {x: number; y: number}; max: {x: number; y: number}}, r: WorldRect) =>
  !(bb.max.x < r.minX || bb.min.x > r.maxX || bb.max.y < r.minY || bb.min.y > r.maxY);

// Βοηθητική συνάρτηση για έλεγχο επιλογής με bounding box
const checkBboxSelection = (bb: any, rect: WorldRect, mode: 'window' | 'crossing', entityId: string, hits: string[]) => {
  const allInside = bb.min.x >= rect.minX && bb.max.x <= rect.maxX &&
                    bb.min.y >= rect.minY && bb.max.y <= rect.maxY;
  const crosses = bboxIntersects(bb, rect);
  if ((mode === 'window' && allInside) || (mode === 'crossing' && crosses)) {
    hits.push(entityId);
  }
};

// Γραμμή τέμνει ορθογώνιο; (γρήγορο: endpoint μέσα ή bbox intersects και μετά segment vs edges)
const segIntersectsRect = (a: Point2D, b: Point2D, r: WorldRect) => {
  // 1) Αν endpoint μέσα ⇒ intersect
  if (ptInRect(a, r) || ptInRect(b, r)) return true;
  
  // 2) Αν όλο εκτός bbox ⇒ όχι
  const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
  if (maxX < r.minX || minX > r.maxX || maxY < r.minY || minY > r.maxY) return false;
  
  // 3) Έλεγχος τέμνης με ακμές
  const rectEdges = [
    [{x: r.minX, y: r.minY}, {x: r.maxX, y: r.minY}],
    [{x: r.maxX, y: r.minY}, {x: r.maxX, y: r.maxY}],
    [{x: r.maxX, y: r.maxY}, {x: r.minX, y: r.maxY}],
    [{x: r.minX, y: r.maxY}, {x: r.minX, y: r.minY}],
  ];
  
  const orient = (p: Point2D, q: Point2D, r: Point2D) => Math.sign((q.y-p.y)*(r.x-q.x)-(q.x-p.x)*(r.y-q.y));
  const onSeg = (p: Point2D, q: Point2D, r: Point2D) =>
    Math.min(p.x, r.x) <= q.x && q.x <= Math.max(p.x, r.x) &&
    Math.min(p.y, r.y) <= q.y && q.y <= Math.max(p.y, r.y);
    
  const intersects = (p1: Point2D, q1: Point2D, p2: Point2D, q2: Point2D) => {
    const o1 = orient(p1, q1, p2), o2 = orient(p1, q1, q2), o3 = orient(p2, q2, p1), o4 = orient(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSeg(p1, p2, q1)) return true;
    if (o2 === 0 && onSeg(p1, q2, q1)) return true;
    if (o3 === 0 && onSeg(p2, p1, q2)) return true;
    if (o4 === 0 && onSeg(p2, q1, q2)) return true;
    return false;
  };
  
  for (const [p, q] of rectEdges) if (intersects(a, b, p, q)) return true;
  return false;
};

export type MarqueeMode = 'window' | 'crossing';

export const pickEntitiesInRect = (
  scene: SceneModel,
  rect: WorldRect,
  mode: MarqueeMode
): string[] => {
  const hits: string[] = [];
  
  for (const e of scene.entities) {
    if (scene.layers[e.layer]?.visible === false) continue;

    if (e.type === 'line' && e.start && e.end) {
      const inside = ptInRect(e.start, rect) && ptInRect(e.end, rect);
      const cross = segIntersectsRect(e.start, e.end, rect);
      if ((mode === 'window' && inside) || (mode === 'crossing' && (inside || cross))) {
        hits.push(e.id);
      }
      continue;
    }

    // Πολύγωνα/πολυγραμμές: ελέγχει τόσο για points[] όσο και για vertices[]
    if (e.type === 'polyline') {
      let pts: Point2D[] | null = null;
      
      // Έλεγχος για vertices (standard polyline format)
      if (Array.isArray((e as any).vertices)) {
        pts = (e as any).vertices as Point2D[];
      }
      // Fallback για points (legacy format)
      else if (Array.isArray((e as any).points)) {
        pts = (e as any).points as Point2D[];
      }
      
      if (pts && pts.length > 0) {
        const allInside = pts.every(p => ptInRect(p, rect));
        const anyInside = pts.some(p => ptInRect(p, rect));
        let anyCross = false;
        
        // Ελέγχει όλες τις ακμές
        for (let i = 0; i < pts.length - 1 && !anyCross; i++) {
          if (segIntersectsRect(pts[i], pts[i + 1], rect)) anyCross = true;
        }
        
        // Αν είναι κλειστή polyline, ελέγχει και την τελευταία ακμή
        if ((e as any).closed && pts.length > 2 && !anyCross) {
          if (segIntersectsRect(pts[pts.length - 1], pts[0], rect)) anyCross = true;
        }
        
        if ((mode === 'window' && allInside) || (mode === 'crossing' && (anyInside || anyCross))) {
          hits.push(e.id);
        }
      }
      continue;
    }

    // Rectangle entities (νέος proper τύπος)
    if (e.type === 'rectangle' && (e as any).corner1 && (e as any).corner2) {
      const c1 = (e as any).corner1 as Point2D;
      const c2 = (e as any).corner2 as Point2D;
      
      // Δημιουργώ τα vertices από τις γωνίες
      const vertices = [
        c1,
        { x: c2.x, y: c1.y },
        c2,
        { x: c1.x, y: c2.y }
      ];
      
      const allInside = vertices.every(p => ptInRect(p, rect));
      const anyInside = vertices.some(p => ptInRect(p, rect));
      let anyCross = false;
      
      // Ελέγχει όλες τις ακμές του ορθογωνίου
      for (let i = 0; i < vertices.length && !anyCross; i++) {
        const next = (i + 1) % vertices.length;
        if (segIntersectsRect(vertices[i], vertices[next], rect)) anyCross = true;
      }
      
      if ((mode === 'window' && allInside) || (mode === 'crossing' && (anyInside || anyCross))) {
        hits.push(e.id);
      }
      continue;
    }

    // Κύκλος/τόξο (προσεγγιστικά με bbox)
    if ((e.type === 'circle' || e.type === 'arc') && (e as any).center && (e as any).radius) {
      const c = (e as any).center as Point2D;
      const r = (e as any).radius as number;
      const bb = { min: {x: c.x - r, y: c.y - r}, max: {x: c.x + r, y: c.y + r} };
      checkBboxSelection(bb, rect, mode, e.id, hits);
      continue;
    }

    // Fallback: αν έχει e.bounds
    if ((e as any).bounds) {
      const bb = (e as any).bounds;
      checkBboxSelection(bb, rect, mode, e.id, hits);
    }
  }
  
  return hits;
};