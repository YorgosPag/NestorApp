/**
 * ADR-362 Phase L1 — center-mark-builder unit tests.
 *
 * Coverage:
 *   computeCenterMarkGeometry:
 *     - dimcen = 0 → empty geometry (no lines rendered)
 *     - dimcen > 0 → cross arms only (no extLines)
 *     - dimcen < 0 → cross arms + 4 extension lines
 *     - dimscale scales arm length proportionally
 *     - cross arm length = abs(dimcen) × dimscale
 *     - cross arms centered on the provided center point
 *     - extLines start at circle edge (radius) and extend by abs(dimcen)×dimscale
 *     - arbitrary center point (not origin)
 *     - negative dimcen: extLines direction correct (outward from circle center)
 */

import { computeCenterMarkGeometry } from '../center-mark-builder';
import type { CenterMarkGeometry } from '../center-mark-builder';

const EPS = 1e-9;

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

// ── dimcen = 0 ────────────────────────────────────────────────────────────────

describe('dimcen = 0', () => {
  it('returns empty geometry', () => {
    const result = computeCenterMarkGeometry({ x: 0, y: 0 }, 50, 0, 1);
    expect(result.crossLines).toHaveLength(0);
    expect(result.extLines).toHaveLength(0);
  });
});

// ── dimcen > 0 — cross arms only ──────────────────────────────────────────────

describe('dimcen > 0 (cross arms only)', () => {
  const center = { x: 0, y: 0 };

  it('produces 2 cross lines', () => {
    const result = computeCenterMarkGeometry(center, 50, 2, 1);
    expect(result.crossLines).toHaveLength(2);
  });

  it('no extension lines', () => {
    const result = computeCenterMarkGeometry(center, 50, 2, 1);
    expect(result.extLines).toHaveLength(0);
  });

  it('horizontal arm half-length = dimcen × dimscale', () => {
    const result = computeCenterMarkGeometry(center, 50, 3, 2);
    const hArm = result.crossLines[0];
    // arm extends from -e to +e (e = 3×2 = 6)
    expect(approx(hArm.start.x, -6)).toBe(true);
    expect(approx(hArm.end.x, 6)).toBe(true);
    expect(approx(hArm.start.y, 0)).toBe(true);
    expect(approx(hArm.end.y, 0)).toBe(true);
  });

  it('vertical arm half-length = dimcen × dimscale', () => {
    const result = computeCenterMarkGeometry(center, 50, 3, 2);
    const vArm = result.crossLines[1];
    expect(approx(vArm.start.y, -6)).toBe(true);
    expect(approx(vArm.end.y, 6)).toBe(true);
    expect(approx(vArm.start.x, 0)).toBe(true);
    expect(approx(vArm.end.x, 0)).toBe(true);
  });

  it('arbitrary center shifts all coordinates', () => {
    const cx = 100, cy = 200;
    const result = computeCenterMarkGeometry({ x: cx, y: cy }, 50, 5, 1);
    const hArm = result.crossLines[0];
    expect(approx(hArm.start.x, cx - 5)).toBe(true);
    expect(approx(hArm.end.x, cx + 5)).toBe(true);
    expect(approx(hArm.start.y, cy)).toBe(true);
    expect(approx(hArm.end.y, cy)).toBe(true);
  });
});

// ── dimcen < 0 — cross arms + extension lines ─────────────────────────────────

describe('dimcen < 0 (cross arms + 4 extension lines)', () => {
  const center = { x: 0, y: 0 };
  const radius = 30;
  const dimcen = -4;
  const dimscale = 1;
  let result: CenterMarkGeometry;

  beforeEach(() => {
    result = computeCenterMarkGeometry(center, radius, dimcen, dimscale);
  });

  it('produces 2 cross lines', () => {
    expect(result.crossLines).toHaveLength(2);
  });

  it('produces 4 extension lines', () => {
    expect(result.extLines).toHaveLength(4);
  });

  it('extension lines start at circle edge', () => {
    const e = Math.abs(dimcen) * dimscale; // 4
    // Right ext: start.x = radius, end.x = radius + e
    const rightExt = result.extLines[0];
    expect(approx(rightExt.start.x, radius)).toBe(true);
    expect(approx(rightExt.end.x, radius + e)).toBe(true);
    // Left ext: start.x = -radius, end.x = -radius - e
    const leftExt = result.extLines[1];
    expect(approx(leftExt.start.x, -radius)).toBe(true);
    expect(approx(leftExt.end.x, -radius - e)).toBe(true);
  });

  it('top/bottom extension lines at correct Y positions', () => {
    const e = Math.abs(dimcen) * dimscale;
    const topExt = result.extLines[2];
    expect(approx(topExt.start.y, radius)).toBe(true);
    expect(approx(topExt.end.y, radius + e)).toBe(true);
    const botExt = result.extLines[3];
    expect(approx(botExt.start.y, -radius)).toBe(true);
    expect(approx(botExt.end.y, -radius - e)).toBe(true);
  });

  it('dimscale scales extension length correctly', () => {
    const r2 = computeCenterMarkGeometry(center, radius, -2, 3);
    const e = 2 * 3; // 6
    expect(approx(r2.extLines[0].start.x, radius)).toBe(true);
    expect(approx(r2.extLines[0].end.x, radius + e)).toBe(true);
  });

  it('arbitrary center: extension lines offset correctly', () => {
    const cx = 10, cy = 20;
    const r2 = computeCenterMarkGeometry({ x: cx, y: cy }, radius, -4, 1);
    const e = 4;
    expect(approx(r2.extLines[0].start.x, cx + radius)).toBe(true);
    expect(approx(r2.extLines[0].end.x, cx + radius + e)).toBe(true);
    expect(approx(r2.extLines[2].start.y, cy + radius)).toBe(true);
    expect(approx(r2.extLines[2].end.y, cy + radius + e)).toBe(true);
  });
});
