/**
 * @module snapping/engines/GuideSnapEngine
 * @description Snap engine for construction guide lines (ADR-189)
 *
 * Produces snap candidates along guide lines:
 * - X guide at offset=N → snap point (N, cursor.y), distance = |cursor.x - N|
 * - Y guide at offset=N → snap point (cursor.x, N), distance = |cursor.y - N|
 * - XZ diagonal → perpendicular projection onto segment
 *
 * Reads directly from GuideStore singleton — no manual sync needed.
 *
 * @see ADR-189 (Construction Grid & Guide System)
 * @see ConstructionPointSnapEngine.ts (same singleton-read pattern)
 * @since 2026-02-19
 */

import type { Point2D, EntityModel } from '../../rendering/types/Types';
import { ExtendedSnapType, type SnapCandidate } from '../extended-types';
import { BaseSnapEngine, type SnapEngineContext, type SnapEngineResult } from '../shared/BaseSnapEngine';
import { SNAP_ENGINE_PRIORITIES } from '../../config/tolerance-config';
import { projectPointOnSegment } from '../../systems/guides/guide-types';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { isSnapDrawingMode } from '../../systems/cursor/SnapDrawingModeStore';
import { generateFractalSubdivisions } from '../../systems/guides/guide-advanced-geometry';

/**
 * Snap engine for construction guide lines.
 * Reads directly from GuideStore singleton on every findSnapCandidates() call,
 * ensuring data is always current without manual sync.
 */
export class GuideSnapEngine extends BaseSnapEngine {
  constructor() {
    super(ExtendedSnapType.GUIDE);
  }

  /** Guides don't use scene entities — this is a no-op. */
  initialize(_entities: EntityModel[]): void {
    // Guide snap does not depend on scene entities.
    // Guides are read directly from the singleton GuideStore.
  }

  /**
   * @deprecated Use singleton read pattern instead. Kept for backward compat with SnapEngineRegistry.
   */
  setGuides(_guides: readonly import('../../systems/guides/guide-types').Guide[]): void {
    // No-op: engine now reads directly from GuideStore singleton
  }

  /**
   * Find snap candidates on guide lines near the cursor.
   *
   * Reads directly from GuideStore singleton — no manual sync needed.
   * For each visible guide within snap radius:
   * - X guide → candidate at (guide.offset, cursor.y)
   * - Y guide → candidate at (cursor.x, guide.offset)
   * - XZ guide → perpendicular projection onto segment
   */
  findSnapCandidates(cursorPoint: Point2D, context: SnapEngineContext): SnapEngineResult {
    const candidates: SnapCandidate[] = [];
    const store = getGlobalGuideStore();
    const guides = store.getGuides();

    if (guides.length === 0 || !store.isVisible()) {
      return { candidates };
    }

    const radius = context.worldRadiusForType(cursorPoint, ExtendedSnapType.GUIDE);

    // ADR-189 (2026-06-12): while DRAWING/placing, guides attract ONLY at their
    // INTERSECTIONS (✕). The single-guide "slide along the line" snaps (X/Y/XZ line,
    // midpoint, fractal) are suppressed so the cursor moves freely except at crossings
    // (Giorgio). Outside drawing mode the full guide snapping stays active.
    const intersectionOnly = isSnapDrawingMode();

    // ADR-189 §3.17 (2026-06-11): Marker policy — a guide *line* snap slides one axis
    // along the guide while the other tracks the cursor, so a floating glyph would glide
    // with the cursor at every pixel (Giorgio: «πολύ κουραστικό, καμία ωφέλεια»). The
    // guide line is already drawn on the canvas, so the *line* snap is SILENT (the overlay
    // suppresses type 'guide', like 'grid'). A marker is shown ONLY at a discrete point:
    // the crossing of a vertical + horizontal guide → emitted as an INTERSECTION (✕).
    // We therefore track only the *nearest in-range* orthogonal guide per axis.
    let nearestX: { offset: number; dist: number; label?: string; id: string } | null = null;
    let nearestY: { offset: number; dist: number; label?: string; id: string } | null = null;

    for (const guide of guides) {
      if (!guide.visible) continue;

      if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
        // ADR-189 §3.3: Diagonal guide — perpendicular snap to segment (slides → silent line).
        // Suppressed while drawing (intersection-only mode) — a single diagonal is a slide.
        if (intersectionOnly) continue;
        const result = projectPointOnSegment(cursorPoint, guide.startPoint, guide.endPoint);
        if (result.distance <= radius) {
          candidates.push(this.createCandidate(
            result.snapPoint,
            guide.label ? `Guide "${guide.label}"` : `Guide (XZ)`,
            result.distance,
            SNAP_ENGINE_PRIORITIES.GUIDE,
            guide.id,
          ));
        }
      } else if (guide.axis === 'X') {
        // Vertical guide — snap X to guide offset, keep cursor Y.
        const dist = Math.abs(cursorPoint.x - guide.offset);
        if (dist <= radius && (!nearestX || dist < nearestX.dist)) {
          nearestX = { offset: guide.offset, dist, label: guide.label ?? undefined, id: guide.id };
        }
      } else {
        // Horizontal guide — snap Y to guide offset, keep cursor X.
        const dist = Math.abs(cursorPoint.y - guide.offset);
        if (dist <= radius && (!nearestY || dist < nearestY.dist)) {
          nearestY = { offset: guide.offset, dist, label: guide.label ?? undefined, id: guide.id };
        }
      }
    }

    if (nearestX && nearestY) {
      // Discrete crossing of two orthogonal guides → INTERSECTION marker (✕).
      // Priority just above the guide line tier so it always wins over the silent
      // line/midpoint/fractal guide candidates near the crossing, yet stays well below
      // real-geometry endpoints/intersections (no regression to drawn entities).
      candidates.push({
        point: { x: nearestX.offset, y: nearestY.offset },
        type: ExtendedSnapType.INTERSECTION,
        description: 'Guide Intersection',
        distance: Math.hypot(nearestX.dist, nearestY.dist),
        priority: SNAP_ENGINE_PRIORITIES.GUIDE - 0.5,
        entityId: nearestX.id,
      });
    } else if (nearestX && !intersectionOnly) {
      // Single vertical guide in range → silent line snap (overlay hides type 'guide').
      candidates.push(this.createCandidate(
        { x: nearestX.offset, y: cursorPoint.y },
        nearestX.label ? `Guide "${nearestX.label}"` : `Guide (X)`,
        nearestX.dist,
        SNAP_ENGINE_PRIORITIES.GUIDE,
        nearestX.id,
      ));
    } else if (nearestY && !intersectionOnly) {
      // Single horizontal guide in range → silent line snap.
      candidates.push(this.createCandidate(
        { x: cursorPoint.x, y: nearestY.offset },
        nearestY.label ? `Guide "${nearestY.label}"` : `Guide (Y)`,
        nearestY.dist,
        SNAP_ENGINE_PRIORITIES.GUIDE,
        nearestY.id,
      ));
    }

    // B12/B80: Midpoint + fractal "slide" snaps between adjacent same-axis guides.
    // Both are single-line slides → suppressed while drawing (intersection-only).
    if (!intersectionOnly) {
      if (candidates.length < 6) {
        this.addMidpointCandidates(candidates, guides, cursorPoint, radius);
      }
      if (candidates.length < 8) {
        this.addFractalCandidates(candidates, guides, cursorPoint, radius);
      }
    }

    return { candidates };
  }

  /**
   * B12: Find midpoint snap candidates between adjacent same-axis guides.
   * For each axis (X, Y), sorts guides by offset, finds the pair bracketing the cursor,
   * and emits a midpoint snap if close enough.
   */
  private addMidpointCandidates(
    candidates: SnapCandidate[],
    guides: readonly import('../../systems/guides/guide-types').Guide[],
    cursor: Point2D,
    radius: number,
  ): void {
    // Collect visible X and Y guide offsets
    const xOffsets: number[] = [];
    const yOffsets: number[] = [];

    for (const g of guides) {
      if (!g.visible || g.axis === 'XZ') continue;
      if (g.axis === 'X') xOffsets.push(g.offset);
      else yOffsets.push(g.offset);
    }

    // X guides: find bracketing pair for cursor.x → midpoint snap
    if (xOffsets.length >= 2) {
      xOffsets.sort((a, b) => a - b);
      for (let i = 0; i < xOffsets.length - 1; i++) {
        if (xOffsets[i] <= cursor.x && cursor.x <= xOffsets[i + 1]) {
          const mid = (xOffsets[i] + xOffsets[i + 1]) / 2;
          const dist = Math.abs(cursor.x - mid);
          if (dist <= radius) {
            candidates.push(this.createCandidate(
              { x: mid, y: cursor.y },
              'Guide Midpoint (X)',
              dist,
              SNAP_ENGINE_PRIORITIES.GUIDE,
              `midpoint_x_${i}`,
            ));
          }
          break;
        }
      }
    }

    // Y guides: find bracketing pair for cursor.y → midpoint snap
    if (yOffsets.length >= 2) {
      yOffsets.sort((a, b) => a - b);
      for (let i = 0; i < yOffsets.length - 1; i++) {
        if (yOffsets[i] <= cursor.y && cursor.y <= yOffsets[i + 1]) {
          const mid = (yOffsets[i] + yOffsets[i + 1]) / 2;
          const dist = Math.abs(cursor.y - mid);
          if (dist <= radius) {
            candidates.push(this.createCandidate(
              { x: cursor.x, y: mid },
              'Guide Midpoint (Y)',
              dist,
              SNAP_ENGINE_PRIORITIES.GUIDE,
              `midpoint_y_${i}`,
            ));
          }
          break;
        }
      }
    }
  }

  /**
   * B80: Find fractal subdivision snap candidates between adjacent same-axis guides.
   * Generates 1/4 and 3/4 positions (depth=2 fractal) for finer snapping.
   */
  private addFractalCandidates(
    candidates: SnapCandidate[],
    guides: readonly import('../../systems/guides/guide-types').Guide[],
    cursor: Point2D,
    radius: number,
  ): void {
    const xOffsets: number[] = [];
    const yOffsets: number[] = [];

    for (const g of guides) {
      if (!g.visible || g.axis === 'XZ') continue;
      if (g.axis === 'X') xOffsets.push(g.offset);
      else yOffsets.push(g.offset);
    }

    // X axis: fractal snaps between bracketing guides
    if (xOffsets.length >= 2) {
      xOffsets.sort((a, b) => a - b);
      for (let i = 0; i < xOffsets.length - 1; i++) {
        if (xOffsets[i] <= cursor.x && cursor.x <= xOffsets[i + 1]) {
          const subdivisions = generateFractalSubdivisions(xOffsets[i], xOffsets[i + 1], 2);
          // Skip the midpoint (already covered by B12), keep 1/4 and 3/4
          for (const pos of subdivisions) {
            const mid = (xOffsets[i] + xOffsets[i + 1]) / 2;
            if (Math.abs(pos - mid) < 0.001) continue; // Skip midpoint
            const dist = Math.abs(cursor.x - pos);
            if (dist <= radius && candidates.length < 8) {
              candidates.push(this.createCandidate(
                { x: pos, y: cursor.y },
                'Guide Fractal (X)',
                dist,
                SNAP_ENGINE_PRIORITIES.GUIDE,
                `fractal_x_${i}_${pos.toFixed(2)}`,
              ));
            }
          }
          break;
        }
      }
    }

    // Y axis: fractal snaps between bracketing guides
    if (yOffsets.length >= 2) {
      yOffsets.sort((a, b) => a - b);
      for (let i = 0; i < yOffsets.length - 1; i++) {
        if (yOffsets[i] <= cursor.y && cursor.y <= yOffsets[i + 1]) {
          const subdivisions = generateFractalSubdivisions(yOffsets[i], yOffsets[i + 1], 2);
          for (const pos of subdivisions) {
            const mid = (yOffsets[i] + yOffsets[i + 1]) / 2;
            if (Math.abs(pos - mid) < 0.001) continue;
            const dist = Math.abs(cursor.y - pos);
            if (dist <= radius && candidates.length < 8) {
              candidates.push(this.createCandidate(
                { x: cursor.x, y: pos },
                'Guide Fractal (Y)',
                dist,
                SNAP_ENGINE_PRIORITIES.GUIDE,
                `fractal_y_${i}_${pos.toFixed(2)}`,
              ));
            }
          }
          break;
        }
      }
    }
  }

  /** No resources to clean up. */
  dispose(): void {
    // No local state — reads from singleton store
  }
}
