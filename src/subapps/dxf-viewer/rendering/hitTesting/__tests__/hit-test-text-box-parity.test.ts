/**
 * ADR-557 Φ-attachment (Giorgio 2026-07-07) — the hover HIT zone for TEXT/MTEXT must
 * coincide with the DRAWN hover frame. Both now read the attachment-aware text-box SSoT
 * (`resolveTextBox`): the frame via `textBoxCornersWorld`, the hit-test via `hitTestText`.
 *
 * Regression guarded: `hitTestText` previously used a hardcoded monospace, baseline-
 * bottom-left box (`position.x → +width`, `position.y-height → position.y`) that ignored
 * the attachment point + widthFactor + glyph metrics + rotation, so the glow lit up
 * before/after the cursor crossed the visible rectangle. These tests assert the hit-test
 * agrees with `resolveTextBox`'s own local-frame containment — the one geometry SSoT.
 */

import { performDetailedHitTest } from '../hit-test-entity-tests';
import { BoundsCalculator } from '../Bounds';
import { resolveTextBox, textBoxCornersWorld } from '../../../bim/text/text-box';
import { projectToLocalFrame } from '../../../bim/grips/grip-math';
import type { Entity } from '../../../types/entities';
import type { EntityModel } from '../../types/Types';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import type { Point2D } from '../../types/Types';

function makeText(overrides: Partial<DxfText> = {}): Entity {
  return {
    id: 't_1',
    type: 'text',
    layerId: '0',
    visible: true,
    position: { x: 100, y: 50 },
    text: 'HELLO',
    height: 10,
    rotation: 0,
    ...overrides,
  } as unknown as Entity;
}

/** True iff `point` lies inside the SSoT box (the drawn-frame geometry), with `tol` slack. */
function insideDrawnBox(entity: Entity, point: Point2D, tol: number): boolean {
  const box = resolveTextBox(entity as unknown as DxfText);
  const local = projectToLocalFrame({ x: point.x - box.center.x, y: point.y - box.center.y }, box.rotationDeg);
  return Math.abs(local.x) <= box.halfWidth + tol && Math.abs(local.y) <= box.halfLength + tol;
}

describe('hitTestText — parity with the drawn hover box (ADR-557)', () => {
  const tol = 0.01;

  it('hits the centre of the attachment-aware box', () => {
    const entity = makeText();
    const box = resolveTextBox(entity as unknown as DxfText);
    const hit = performDetailedHitTest(entity, box.center, tol);
    expect(hit).not.toBeNull();
    expect(hit?.hitType).toBe('entity');
  });

  it('misses a point clearly outside the box', () => {
    const entity = makeText();
    const box = resolveTextBox(entity as unknown as DxfText);
    const far: Point2D = { x: box.center.x + box.halfWidth * 4, y: box.center.y + box.halfLength * 4 };
    expect(performDetailedHitTest(entity, far, tol)).toBeNull();
  });

  it('agrees with resolveTextBox containment on a grid of sampled points', () => {
    const entity = makeText();
    const box = resolveTextBox(entity as unknown as DxfText);
    // Sample a grid spanning ±2× the box extent, well past the edges on all four sides.
    for (let i = -8; i <= 8; i++) {
      for (let j = -8; j <= 8; j++) {
        const p: Point2D = {
          x: box.center.x + (i / 4) * box.halfWidth,
          y: box.center.y + (j / 4) * box.halfLength,
        };
        const hit = performDetailedHitTest(entity, p, tol) != null;
        expect(hit).toBe(insideDrawnBox(entity, p, tol));
      }
    }
  });

  it('multi-line — broad-phase bounds enclose EVERY line + narrow-phase hits lower lines', () => {
    // Giorgio 2026-07-07: single-line hover worked, multi-line did not — the cursor over the
    // lower lines was not detected. Root cause: the broad-phase text bounds were single-line
    // tall, so lines 2..N sat outside the spatial-index bbox and the narrow phase never ran.
    const entity = makeText({ text: 'LINE ONE\nLINE TWO\nLINE THREE', height: 10 });
    const box = resolveTextBox(entity as unknown as DxfText);
    // The multi-line visual box is much taller than one line's height.
    expect(box.halfLength).toBeGreaterThan(10);

    // Broad phase (spatial-index bbox) MUST enclose the whole visual box (all lines).
    const bounds = BoundsCalculator.calculateEntityBounds(entity as unknown as EntityModel, tol);
    expect(bounds).not.toBeNull();
    for (const corner of textBoxCornersWorld(entity as unknown as DxfText)) {
      expect(corner.x).toBeGreaterThanOrEqual(bounds!.minX - 1e-6);
      expect(corner.x).toBeLessThanOrEqual(bounds!.maxX + 1e-6);
      expect(corner.y).toBeGreaterThanOrEqual(bounds!.minY - 1e-6);
      expect(corner.y).toBeLessThanOrEqual(bounds!.maxY + 1e-6);
    }

    // Narrow phase: a point near the BOTTOM of the multi-line box (over the last line) hits.
    const nearBottom: Point2D = { x: box.center.x, y: box.center.y - box.halfLength * 0.8 };
    expect(insideDrawnBox(entity, nearBottom, tol)).toBe(true);
    expect(performDetailedHitTest(entity, nearBottom, tol)).not.toBeNull();
  });

  it('respects rotation — the box is rotated about the insertion point', () => {
    const entity = makeText({ rotation: 30 });
    const box = resolveTextBox(entity as unknown as DxfText);
    // A point on the rotated box centre hits; the same-distance point along the UNROTATED
    // long axis (where the old axis-aligned box would have reported a hit) agrees with the SSoT.
    expect(performDetailedHitTest(entity, box.center, tol)).not.toBeNull();
    const offAxis: Point2D = { x: box.center.x + box.halfWidth * 0.9, y: box.center.y };
    expect(performDetailedHitTest(entity, offAxis, tol) != null).toBe(insideDrawnBox(entity, offAxis, tol));
  });
});
