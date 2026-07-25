/**
 * Regression anchors for the DXF scene fit/projection SSoT.
 *
 * These pin the EXACT numbers the five surfaces produced before centralization
 * (gallery renderer, upload thumbnail, BIM transform bridge, project floorplan
 * tab, overlay renderer). If a future edit changes the formulas, thumbnails and
 * overlays silently misalign — these tests are the tripwire.
 */

import {
  computeFitTransform,
  projectX,
  projectY,
  rectBoundsToScene,
  screenToWorld,
  worldToScreen,
  type SceneBounds,
} from '../scene-fit-transform';

const BOUNDS: SceneBounds = { min: { x: 10, y: 20 }, max: { x: 110, y: 70 } };

describe('computeFitTransform', () => {
  it('centers an aspect-fit drawing with no padding, no zoom, no pan', () => {
    // drawing 100×50 into 400×400 → scale = min(4, 8) = 4
    const fit = computeFitTransform(400, 400, BOUNDS);

    expect(fit.scale).toBe(4);
    expect(fit.offsetX).toBe((400 - 100 * 4) / 2);
    expect(fit.offsetY).toBe((400 - 50 * 4) / 2);
  });

  it('multiplies the base fit by zoom and adds pan (gallery renderer contract)', () => {
    const fit = computeFitTransform(400, 400, BOUNDS, 2, { x: 15, y: -5 });

    expect(fit.scale).toBe(8);
    expect(fit.offsetX).toBe((400 - 100 * 8) / 2 + 15);
    expect(fit.offsetY).toBe((400 - 50 * 8) / 2 - 5);
  });

  it('applies paddingRatio to the fit box but centers against the full viewport', () => {
    // thumbnail contract: 5% margin per side → fit box 270×180 inside 300×200
    const fit = computeFitTransform(300, 200, BOUNDS, 1, undefined, 0.05);

    const expectedScale = Math.min(270 / 100, 180 / 50);
    expect(fit.scale).toBeCloseTo(expectedScale, 12);
    expect(fit.offsetX).toBeCloseTo((300 - 100 * expectedScale) / 2, 12);
    expect(fit.offsetY).toBeCloseTo((200 - 50 * expectedScale) / 2, 12);
  });

  it('keeps scale finite for a degenerate zero-extent drawing', () => {
    const degenerate: SceneBounds = { min: { x: 5, y: 5 }, max: { x: 5, y: 5 } };
    const fit = computeFitTransform(400, 400, degenerate);

    expect(Number.isFinite(fit.scale)).toBe(true);
    expect(Number.isFinite(fit.offsetX)).toBe(true);
    expect(Number.isFinite(fit.offsetY)).toBe(true);
  });
});

describe('projection', () => {
  const fit = computeFitTransform(400, 400, BOUNDS);

  it('maps world X against bounds.min.x and world Y flipped against bounds.max.y', () => {
    expect(projectX(10, BOUNDS, fit)).toBe(fit.offsetX);
    expect(projectY(70, BOUNDS, fit)).toBe(fit.offsetY);
    // Y grows DOWNWARD on canvas: the world minimum lands at the bottom
    expect(projectY(20, BOUNDS, fit)).toBe(50 * fit.scale + fit.offsetY);
  });

  it('worldToScreen composes the scalar projections', () => {
    expect(worldToScreen(60, 45, BOUNDS, fit)).toEqual({
      x: projectX(60, BOUNDS, fit),
      y: projectY(45, BOUNDS, fit),
    });
  });

  it('screenToWorld is the exact inverse of worldToScreen', () => {
    const screen = worldToScreen(37.5, 62.25, BOUNDS, fit);
    const world = screenToWorld(screen.x, screen.y, BOUNDS, fit);

    expect(world.x).toBeCloseTo(37.5, 10);
    expect(world.y).toBeCloseTo(62.25, 10);
  });
});

describe('rectBoundsToScene', () => {
  it('builds origin-anchored bounds for a raster source', () => {
    expect(rectBoundsToScene(800, 600)).toEqual({
      min: { x: 0, y: 0 },
      max: { x: 800, y: 600 },
    });
  });
});
