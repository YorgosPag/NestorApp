/**
 * ADR-394 — Z fit-to-selection on a SINGLE axis-aligned line.
 *
 * A horizontal line has boundsHeight=0, a vertical line has boundsWidth=0. Both
 * methods previously rejected such bounds ("Invalid bounds dimensions") so pressing
 * Z with exactly one axis-aligned line selected did nothing (it worked only when a
 * 2D entity was co-selected). The degenerate axis now borrows the dominant span so
 * the line frames; a true point (both axes zero) is still rejected.
 */

import { FitToViewService } from '../FitToViewService';

const viewport = { width: 1000, height: 800 };

describe('ADR-394 — FitToViewService degenerate bounds (single line)', () => {
  it('horizontal line (height=0) → succeeds with a finite positive scale', () => {
    const bounds = { min: { x: 0, y: 50 }, max: { x: 200, y: 50 } };
    const res = FitToViewService.calculateFitToViewFromBounds(bounds, viewport);
    expect(res.success).toBe(true);
    expect(res.transform).not.toBeNull();
    expect(Number.isFinite(res.transform!.scale)).toBe(true);
    expect(res.transform!.scale).toBeGreaterThan(0);
  });

  it('vertical line (width=0) → succeeds with a finite positive scale', () => {
    const bounds = { min: { x: 100, y: 0 }, max: { x: 100, y: 200 } };
    const res = FitToViewService.calculateFitToViewFromBounds(bounds, viewport);
    expect(res.success).toBe(true);
    expect(res.transform).not.toBeNull();
    expect(Number.isFinite(res.transform!.scale)).toBe(true);
    expect(res.transform!.scale).toBeGreaterThan(0);
  });

  it('a true point (both axes 0) is still rejected', () => {
    const bounds = { min: { x: 10, y: 10 }, max: { x: 10, y: 10 } };
    const res = FitToViewService.calculateFitToViewFromBounds(bounds, viewport);
    expect(res.success).toBe(false);
    expect(res.transform).toBeNull();
  });

  it('a normal 2D box still fits unchanged', () => {
    const bounds = { min: { x: 0, y: 0 }, max: { x: 400, y: 300 } };
    const res = FitToViewService.calculateFitToViewFromBounds(bounds, viewport);
    expect(res.success).toBe(true);
    expect(res.transform!.scale).toBeGreaterThan(0);
  });
});
