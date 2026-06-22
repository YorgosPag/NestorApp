/**
 * ADR-404 Phase 5c — Tests για την κεκλιμένη/ρύση πλάκα στο ribbon.
 *
 * Καλύπτει: μονάδα εμφάνισης (%/μοίρες/λόγος round-trip), το geometryType↔slope
 * invariant μέσω resolver, on/off, τιμή ανά μονάδα, φορά normalize, άξονα pivot.
 * Selected-path (dispatchParams spy)· drawing-mode store μένει null.
 */

import {
  isSlabSlopeUnit,
  slabSlopeUnitStore,
  slopeDisplayToPercent,
  slopePercentToDisplay,
} from '../slab-slope-unit';
import {
  SLOPE_ENABLED_OFF,
  SLOPE_ENABLED_ON,
  applySlabSlopeComboboxChange,
  resolveSlabSlopeComboboxState,
} from '../slab-slope-param';
import { SLAB_RIBBON_KEYS } from '../slab-command-keys';
import { slabToolBridgeStore } from '../slab-tool-bridge-store';
import type { SlabEntity, SlabParams, SlabSlope } from '../../../../../bim/types/slab-types';

const KEYS = SLAB_RIBBON_KEYS.slope;

const SQUARE = {
  vertices: [
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
    { x: 10000, y: 10000 },
    { x: 0, y: 10000 },
  ],
};

function makeSlab(slope?: SlabSlope): SlabEntity {
  const params: SlabParams = {
    kind: 'roof',
    outline: SQUARE,
    levelElevation: 3000,
    thickness: 200,
    geometryType: slope ? 'tilted' : 'box',
    ...(slope ? { slope } : {}),
  } as SlabParams;
  return { params } as unknown as SlabEntity;
}

beforeEach(() => {
  slabSlopeUnitStore.set('percent');
  slabToolBridgeStore.set(null);
});

describe('slab-slope-unit — μετατροπές μονάδας (stored % ↔ display)', () => {
  it('percent = identity', () => {
    expect(slopePercentToDisplay(2, 'percent')).toBe('2');
    expect(slopeDisplayToPercent('2', 'percent')).toBe(2);
  });

  it('degrees round-trip (tan/atan)', () => {
    expect(slopeDisplayToPercent('45', 'degrees')).toBeCloseTo(100, 6); // tan45·100
    expect(Number(slopePercentToDisplay(100, 'degrees'))).toBeCloseTo(45, 2);
  });

  it('ratio 1:N — display=N, parse N→%', () => {
    expect(slopePercentToDisplay(2, 'ratio')).toBe('50'); // 100/2
    expect(slopeDisplayToPercent('50', 'ratio')).toBeCloseTo(2, 6);
  });

  it('≤0 / άκυρο → null (parse) / "0" (display)', () => {
    expect(slopeDisplayToPercent('0', 'percent')).toBeNull();
    expect(slopeDisplayToPercent('abc', 'degrees')).toBeNull();
    expect(slopePercentToDisplay(0, 'ratio')).toBe('0');
  });

  it('isSlabSlopeUnit guard', () => {
    expect(isSlabSlopeUnit('ratio')).toBe(true);
    expect(isSlabSlopeUnit('nonsense')).toBe(false);
  });
});

describe('resolveSlabSlopeComboboxState (read)', () => {
  const unit = () => slabSlopeUnitStore.get();

  it('enabled: box→off, tilted→on', () => {
    expect(resolveSlabSlopeComboboxState(KEYS.enabled, makeSlab(), unit())?.value).toBe(SLOPE_ENABLED_OFF);
    const tilted = makeSlab({ direction: 0, angle: 2, pivotEdge: 'center' });
    expect(resolveSlabSlopeComboboxState(KEYS.enabled, tilted, unit())?.value).toBe(SLOPE_ENABLED_ON);
  });

  it('angle εμφανίζεται στη επιλεγμένη μονάδα', () => {
    const tilted = makeSlab({ direction: 0, angle: 2, pivotEdge: 'center' });
    expect(resolveSlabSlopeComboboxState(KEYS.angle, tilted, 'percent')?.value).toBe('2');
    expect(resolveSlabSlopeComboboxState(KEYS.angle, tilted, 'ratio')?.value).toBe('50'); // 1:50
  });

  it('direction + pivot', () => {
    const tilted = makeSlab({ direction: 135, angle: 2, pivotEdge: 'N' });
    expect(resolveSlabSlopeComboboxState(KEYS.direction, tilted, unit())?.value).toBe('135');
    expect(resolveSlabSlopeComboboxState(KEYS.pivot, tilted, unit())?.value).toBe('N');
  });

  it('unit → πάντα (display pref, ακόμη και χωρίς slab)', () => {
    expect(resolveSlabSlopeComboboxState(KEYS.unit, null, 'degrees')?.value).toBe('degrees');
  });
});

describe('applySlabSlopeComboboxChange (write, selected slab)', () => {
  it('enabled ON σε box → tilted + default slope (2%, dir 0, center)', () => {
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.enabled, SLOPE_ENABLED_ON, makeSlab(), spy);
    const next = spy.mock.calls[0][1] as SlabParams;
    expect(next.geometryType).toBe('tilted');
    expect(next.slope).toEqual({ direction: 0, angle: 2, pivotEdge: 'center' });
  });

  it('enabled OFF σε tilted → box + drop slope', () => {
    const spy = jest.fn();
    const tilted = makeSlab({ direction: 0, angle: 5, pivotEdge: 'center' });
    applySlabSlopeComboboxChange(KEYS.enabled, SLOPE_ENABLED_OFF, tilted, spy);
    const next = spy.mock.calls[0][1] as SlabParams;
    expect(next.geometryType).toBe('box');
    expect('slope' in next).toBe(false);
  });

  it('angle (percent) → slope.angle=%', () => {
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.angle, '5', makeSlab(), spy);
    expect((spy.mock.calls[0][1] as SlabParams).slope?.angle).toBe(5);
  });

  it('angle σε degrees → αποθηκεύεται % (tan)', () => {
    slabSlopeUnitStore.set('degrees');
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.angle, '45', makeSlab(), spy);
    expect((spy.mock.calls[0][1] as SlabParams).slope?.angle).toBeCloseTo(100, 6);
  });

  it('angle 0 → flat (box)', () => {
    const spy = jest.fn();
    const tilted = makeSlab({ direction: 0, angle: 5, pivotEdge: 'center' });
    applySlabSlopeComboboxChange(KEYS.angle, '0', tilted, spy);
    expect((spy.mock.calls[0][1] as SlabParams).geometryType).toBe('box');
  });

  it('direction 450 → normalize 90', () => {
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.direction, '450', makeSlab(), spy);
    expect((spy.mock.calls[0][1] as SlabParams).slope?.direction).toBe(90);
  });

  it('pivot N → slope.pivotEdge', () => {
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.pivot, 'N', makeSlab(), spy);
    expect((spy.mock.calls[0][1] as SlabParams).slope?.pivotEdge).toBe('N');
  });

  it('unit key → μόνο display pref, ΚΑΜΙΑ geometry mutation', () => {
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.unit, 'ratio', makeSlab(), spy);
    expect(spy).not.toHaveBeenCalled();
    expect(slabSlopeUnitStore.get()).toBe('ratio');
  });

  it('άκυρο pivot value → no-op', () => {
    const spy = jest.fn();
    applySlabSlopeComboboxChange(KEYS.pivot, 'BOGUS', makeSlab(), spy);
    expect(spy).not.toHaveBeenCalled();
  });
});
