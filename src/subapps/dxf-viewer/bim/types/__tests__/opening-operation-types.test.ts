/**
 * Tests — Opening Operation Type SSoT (ADR-421 §A1).
 *
 * Coverage:
 *   - IFC enum value counts (door 20 / window 14 / partitioning 11) — guards
 *     against accidental drops vs buildingSMART IFC4.
 *   - DEFAULT_OPERATION_BY_KIND exhaustive (every OpeningKind mapped).
 *   - resolveOperationType handing variants + non-door fallback.
 */

import {
  IFC_DOOR_OPERATION_VALUES,
  IFC_WINDOW_OPERATION_VALUES,
  IFC_WINDOW_PARTITIONING_VALUES,
  DEFAULT_OPERATION_BY_KIND,
  resolveOperationType,
} from '../opening-operation-types';
import { OPENING_KIND_DEFAULTS } from '../opening-types';
import type { OpeningKind } from '../opening-types';

describe('IFC operation enums (buildingSMART IFC4)', () => {
  it('IfcDoorTypeOperationEnum has 20 values', () => {
    expect(IFC_DOOR_OPERATION_VALUES).toHaveLength(20);
  });

  it('IfcWindowPanelOperationEnum has 14 values', () => {
    expect(IFC_WINDOW_OPERATION_VALUES).toHaveLength(14);
  });

  it('IfcWindowTypePartitioningEnum has 11 values', () => {
    expect(IFC_WINDOW_PARTITIONING_VALUES).toHaveLength(11);
  });

  it('door enum contains canonical swing/sliding/folding/revolving', () => {
    for (const v of ['SINGLE_SWING_LEFT', 'DOUBLE_DOOR_SINGLE_SWING', 'SLIDING_TO_LEFT', 'FOLDING_TO_LEFT', 'REVOLVING', 'ROLLINGUP']) {
      expect(IFC_DOOR_OPERATION_VALUES).toContain(v);
    }
  });
});

describe('DEFAULT_OPERATION_BY_KIND', () => {
  it('maps every OpeningKind (exhaustive vs OPENING_KIND_DEFAULTS)', () => {
    const kinds = Object.keys(OPENING_KIND_DEFAULTS) as OpeningKind[];
    for (const kind of kinds) {
      expect(DEFAULT_OPERATION_BY_KIND[kind]).toBeDefined();
    }
  });

  it('double-door → DOUBLE_DOOR_SINGLE_SWING', () => {
    expect(DEFAULT_OPERATION_BY_KIND['double-door']).toBe('DOUBLE_DOOR_SINGLE_SWING');
  });

  it('SLICE B door families map to canonical IFC4 door operations', () => {
    expect(DEFAULT_OPERATION_BY_KIND['double-sliding-door']).toBe('DOUBLE_DOOR_SLIDING');
    expect(DEFAULT_OPERATION_BY_KIND['pocket-door']).toBe('SLIDING_TO_LEFT');
    expect(DEFAULT_OPERATION_BY_KIND['bifold-door']).toBe('FOLDING_TO_LEFT');
    expect(DEFAULT_OPERATION_BY_KIND['overhead-door']).toBe('ROLLINGUP');
    expect(DEFAULT_OPERATION_BY_KIND['revolving-door']).toBe('REVOLVING');
  });

  it('SLICE B window families map to canonical IFC4 panel operations', () => {
    expect(DEFAULT_OPERATION_BY_KIND['double-hung-window']).toBe('SLIDINGVERTICAL');
    expect(DEFAULT_OPERATION_BY_KIND['sliding-window']).toBe('SLIDINGHORIZONTAL');
    expect(DEFAULT_OPERATION_BY_KIND['awning-window']).toBe('TOPHUNG');
    expect(DEFAULT_OPERATION_BY_KIND['hopper-window']).toBe('BOTTOMHUNG');
    expect(DEFAULT_OPERATION_BY_KIND['tilt-turn-window']).toBe('TILTANDTURNRIGHTHAND');
    expect(DEFAULT_OPERATION_BY_KIND['bay-window']).toBe('SIDEHUNGRIGHTHAND');
  });
});

describe('resolveOperationType', () => {
  it("door + handing='left' → SINGLE_SWING_LEFT", () => {
    expect(resolveOperationType('door', 'left')).toBe('SINGLE_SWING_LEFT');
  });

  it("door + handing='right' → SINGLE_SWING_RIGHT", () => {
    expect(resolveOperationType('door', 'right')).toBe('SINGLE_SWING_RIGHT');
  });

  it('door without handing → default (SINGLE_SWING_LEFT)', () => {
    expect(resolveOperationType('door')).toBe('SINGLE_SWING_LEFT');
  });

  it('handing ignored for non-door kinds (double-door stays default)', () => {
    expect(resolveOperationType('double-door', 'right')).toBe('DOUBLE_DOOR_SINGLE_SWING');
  });

  it('window → SIDEHUNGRIGHTHAND', () => {
    expect(resolveOperationType('window')).toBe('SIDEHUNGRIGHTHAND');
  });

  it('sliding/pocket door handing → SLIDING_TO_LEFT/RIGHT', () => {
    expect(resolveOperationType('sliding-door', 'right')).toBe('SLIDING_TO_RIGHT');
    expect(resolveOperationType('sliding-door', 'left')).toBe('SLIDING_TO_LEFT');
    expect(resolveOperationType('pocket-door', 'right')).toBe('SLIDING_TO_RIGHT');
  });

  it('bifold door handing → FOLDING_TO_LEFT/RIGHT', () => {
    expect(resolveOperationType('bifold-door', 'right')).toBe('FOLDING_TO_RIGHT');
    expect(resolveOperationType('bifold-door')).toBe('FOLDING_TO_LEFT');
  });

  it('tilt-turn window handing → TILTANDTURN LEFT/RIGHT (default right)', () => {
    expect(resolveOperationType('tilt-turn-window', 'left')).toBe('TILTANDTURNLEFTHAND');
    expect(resolveOperationType('tilt-turn-window')).toBe('TILTANDTURNRIGHTHAND');
  });

  it('overhead/revolving ignore handing (fixed operation)', () => {
    expect(resolveOperationType('overhead-door', 'right')).toBe('ROLLINGUP');
    expect(resolveOperationType('revolving-door', 'left')).toBe('REVOLVING');
  });
});
