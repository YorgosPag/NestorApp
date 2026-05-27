/**
 * ADR-363 BIM Entity Key Points — 2D SSoT
 *
 * Single Source of Truth για 2D key-point extraction από BIM entities.
 * Καταναλώνεται από GeometricCalculations (snap engine), grips, move/mirror/
 * rotate geometry helpers. Αποτρέπει inline params.outline.vertices / startPoint
 * scatter σε 20+ αρχεία.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Idempotent.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6
 * @see snapping/shared/GeometricCalculations.ts (primary consumer)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isBeamEntity,
  isSlabEntity,
  isSlabOpeningEntity,
  isOpeningEntity,
  isWallEntity,
  isColumnEntity,
} from '../../types/entities';
import { getColumnAnchorWorldPoints } from '../columns/column-anchors';

/**
 * Κύρια vertex/endpoint collection για BIM entity (2D projection).
 *
 * - beam      → axis endpoints (startPoint + endPoint)
 * - slab      → outline vertices (closed polygon corners)
 * - slab-opening → outline vertices
 * - opening   → outline vertices (4-vertex cutout rectangle)
 * - wall      → axis endpoints (straight/curved) OR all spine vertices (polyline)
 * - column    → 9 anchor world points (center + 8 cardinals/diagonals)
 *
 * Returns [] for entity types not in the BIM domain.
 */
export function getBimEntityKeyPoints2D(entity: Entity): Point2D[] {
  if (isBeamEntity(entity)) {
    return [
      { x: entity.params.startPoint.x, y: entity.params.startPoint.y },
      { x: entity.params.endPoint.x, y: entity.params.endPoint.y },
    ];
  }

  if (isSlabEntity(entity) || isSlabOpeningEntity(entity)) {
    const verts = entity.params.outline?.vertices;
    if (!verts) return [];
    return verts.map(v => ({ x: v.x, y: v.y }));
  }

  if (isOpeningEntity(entity)) {
    const verts = entity.geometry?.outline?.vertices;
    if (!verts) return [];
    return verts.map(v => ({ x: v.x, y: v.y }));
  }

  if (isWallEntity(entity)) {
    const params = entity.params;
    if (entity.kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
      return params.polylineVertices.map(v => ({ x: v.x, y: v.y }));
    }
    return [
      { x: params.start.x, y: params.start.y },
      { x: params.end.x, y: params.end.y },
    ];
  }

  if (isColumnEntity(entity)) {
    return getColumnAnchorWorldPoints(entity).map(a => a.point);
  }

  return [];
}

/**
 * Edge midpoints για BIM entity (2D projection).
 *
 * - beam          → axis midpoint (single point)
 * - slab          → per-edge midpoints of closed polygon
 * - slab-opening  → per-edge midpoints of closed polygon
 * - opening       → per-edge midpoints of 4-edge rectangle
 * - wall (straight) → axis midpoint
 * - wall (polyline) → per-segment midpoints
 *
 * Column και άλλα BIM types → [].
 */
export function getBimEntityEdgeMidpoints2D(entity: Entity): Point2D[] {
  if (isBeamEntity(entity)) {
    const { startPoint: s, endPoint: e } = entity.params;
    return [{ x: (s.x + e.x) / 2, y: (s.y + e.y) / 2 }];
  }

  if (isSlabEntity(entity) || isSlabOpeningEntity(entity)) {
    const verts = entity.params.outline?.vertices;
    if (!verts) return [];
    return verts.map((v, i) => {
      const next = verts[(i + 1) % verts.length]!;
      return { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 };
    });
  }

  if (isOpeningEntity(entity)) {
    const verts = entity.geometry?.outline?.vertices;
    if (!verts) return [];
    return verts.map((v, i) => {
      const next = verts[(i + 1) % verts.length]!;
      return { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 };
    });
  }

  if (isWallEntity(entity)) {
    const params = entity.params;
    if (entity.kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
      const verts = params.polylineVertices;
      const midpoints: Point2D[] = [];
      for (let i = 1; i < verts.length; i++) {
        midpoints.push({ x: (verts[i - 1].x + verts[i].x) / 2, y: (verts[i - 1].y + verts[i].y) / 2 });
      }
      return midpoints;
    }
    return [{ x: (params.start.x + params.end.x) / 2, y: (params.start.y + params.end.y) / 2 }];
  }

  return [];
}
