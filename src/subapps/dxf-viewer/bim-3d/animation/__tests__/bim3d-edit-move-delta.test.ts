/**
 * ADR-688 Φ3 / ADR-049 — resolveMovePlanDeltaCanvas tests.
 *
 * The SSoT plan delta shared by the 3D move command builder and the Ctrl copy-drag commit:
 * masks the DXF-mm delta by the keyboard axis lock (X/Z), then scales into the primary
 * entity's native canvas units (`mmToEntityUnitFactor` — 1 for an mm drawing, 0.001 for a
 * meter scene). This guarantees the moved element and the dropped copy land identically.
 * Only `mmToEntityUnitFactor` is mocked; the axis-lock masking is exercised for real.
 */

import type { BridgeOutcome } from '../../gizmo/bim-gizmo-drag-bridge';

let mockFactor = 1;
jest.mock('../../utils/bim3d-edit-math', () => ({
  ...jest.requireActual('../../utils/bim3d-edit-math'),
  mmToEntityUnitFactor: () => mockFactor,
}));

import { resolveMovePlanDeltaCanvas } from '../bim3d-edit-command-builders';

type MoveOutcome = Extract<BridgeOutcome, { kind: 'move' }>;
const move = (x: number, y: number): MoveOutcome => ({ kind: 'move', deltaDxf: { x, y }, deltaUpMm: 0 });
const primary = { type: 'wall' } as never;

beforeEach(() => { mockFactor = 1; });

describe('resolveMovePlanDeltaCanvas (ADR-688 Φ3)', () => {
  it('passes the plan delta through unchanged in an mm scene (factor 1)', () => {
    expect(resolveMovePlanDeltaCanvas(move(200, 300), primary, null)).toEqual({ x: 200, y: 300 });
  });

  it('scales the plan delta by the native-units factor in a meter scene (0.001)', () => {
    mockFactor = 0.001;
    expect(resolveMovePlanDeltaCanvas(move(200, 300), primary, null)).toEqual({ x: 0.2, y: 0.3 });
  });

  it('masks the Y component under axis lock X', () => {
    expect(resolveMovePlanDeltaCanvas(move(200, 300), primary, 'X')).toEqual({ x: 200, y: 0 });
  });

  it('masks the X component under axis lock Z', () => {
    expect(resolveMovePlanDeltaCanvas(move(200, 300), primary, 'Z')).toEqual({ x: 0, y: 300 });
  });

  it('defaults to factor 1 (no scaling) when the primary entity is undefined', () => {
    mockFactor = 0.001; // must be ignored — primary undefined never calls the factor
    expect(resolveMovePlanDeltaCanvas(move(200, 300), undefined, null)).toEqual({ x: 200, y: 300 });
  });
});
