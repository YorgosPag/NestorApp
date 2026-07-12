/**
 * Unit tests — scale reference math SSoT (ADR-348 / ADR-646).
 * Focus: `computeLiveScale` (ADR-646 #1) — the live drag factor shared verbatim by
 * the ghost tooltip, the WYSIWYG copies, and the click-commit.
 */
import { ScaleToolStore, type ScaleToolState } from '../ScaleToolStore';
import { computeLiveScale, computeUniformRef, referenceDistance } from '../scale-reference-calc';

function stateWith(overrides: Partial<ScaleToolState>): ScaleToolState {
  ScaleToolStore.reset();
  return { ...ScaleToolStore.getState(), ...overrides };
}

const BASE = { x: 0, y: 0 };

describe('computeLiveScale — live drag factor (ADR-646 #1)', () => {
  it('returns 1 before a drag reference is captured', () => {
    const s = stateWith({ subPhase: 'direct', dragRefPoint: null });
    expect(computeLiveScale(s, { x: 50, y: 0 }, BASE)).toBe(1);
  });

  it('is the ratio of cursor distance to the reference distance (factor 1 at the sample)', () => {
    const s = stateWith({ subPhase: 'direct', dragRefPoint: { x: 10, y: 0 } });
    expect(computeLiveScale(s, { x: 10, y: 0 }, BASE)).toBeCloseTo(1, 10); // at reference → 1
    expect(computeLiveScale(s, { x: 20, y: 0 }, BASE)).toBeCloseTo(2, 10); // twice as far → 2
    expect(computeLiveScale(s, { x: 5, y: 0 }, BASE)).toBeCloseTo(0.5, 10); // half → 0.5
  });

  it('is not tied to any arbitrary constant (no hardcoded /100)', () => {
    const s = stateWith({ subPhase: 'direct', dragRefPoint: { x: 3, y: 4 } }); // refLen = 5
    expect(computeLiveScale(s, { x: 6, y: 8 }, BASE)).toBeCloseTo(2, 10); // dist 10 / 5
  });

  it('guards a degenerate reference (cursor sampled on the base point) → 1', () => {
    const s = stateWith({ subPhase: 'direct', dragRefPoint: { x: 0, y: 0 } });
    expect(computeLiveScale(s, { x: 100, y: 0 }, BASE)).toBe(1);
  });

  it('defers to the typed factor outside the direct sub-phase', () => {
    const s = stateWith({ subPhase: 'direct_x', currentSx: 3, dragRefPoint: { x: 10, y: 0 } });
    expect(computeLiveScale(s, { x: 999, y: 0 }, BASE)).toBe(3);
  });
});

describe('reference math regression (unchanged SSoT)', () => {
  it('referenceDistance is Euclidean', () => {
    expect(referenceDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('computeUniformRef = newLength / refLength, null on degenerate ref', () => {
    expect(computeUniformRef({ x: 0, y: 0 }, { x: 0, y: 2 }, 4)).toBe(2);
    expect(computeUniformRef({ x: 1, y: 1 }, { x: 1, y: 1 }, 4)).toBeNull();
  });
});
