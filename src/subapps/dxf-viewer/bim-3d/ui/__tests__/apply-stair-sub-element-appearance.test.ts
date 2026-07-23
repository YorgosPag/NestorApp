/**
 * ADR-539 Φ7 — writer `applyStairSubElementAppearance`: γράφει το appearance ΜΙΑΣ υποενότητας σκάλας
 * στο σωστό `params` override record (tread/riser/landing/waist), immutably, διατηρώντας τα υπόλοιπα
 * πεδία & indices, και εκτελεί `UpdateStairParamsCommand` (ΕΝΑ undo). Οι deps είναι mocked ώστε το
 * test να ελέγχει ΜΟΝΟ το merge/routing (όχι geometry recompute).
 */

import type { StairEntity, StairParams } from '../../../bim/types/stair-types';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';

const mockExecute = jest.fn();
const mockCommandArgs: Array<{ stairId: string; next: StairParams; prev: StairParams }> = [];
const mockState: { stair: StairEntity | undefined } = { stair: undefined };

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: mockExecute }),
}));
jest.mock('../../../core/commands/entity-commands/UpdateStairParamsCommand', () => ({
  UpdateStairParamsCommand: class {
    constructor(stairId: string, next: StairParams, prev: StairParams) {
      mockCommandArgs.push({ stairId, next, prev });
    }
  },
}));
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: () => ({ getEntity: () => mockState.stair }),
}));

import { applyStairSubElementAppearance } from '../apply-stair-sub-element-appearance';

const levels = {
  currentLevelId: 'lvl1',
  getLevelScene: () => null,
  setLevelScene: () => {},
} as unknown as LevelsHookReturn;

function fakeStair(params: Partial<StairParams>): StairEntity {
  return { id: 'stair_1', type: 'stair', params } as unknown as StairEntity;
}

beforeEach(() => {
  mockExecute.mockClear();
  mockCommandArgs.length = 0;
  mockState.stair = undefined;
});

describe('applyStairSubElementAppearance', () => {
  it('γράφει tread appearance στο perTreadOverrides[index], διατηρώντας το legacy material', () => {
    mockState.stair = fakeStair({ perTreadOverrides: { 2: { material: 'oak' } } });
    applyStairSubElementAppearance(levels, 'stair_1', 'tread', 2, { colorHex: '#C0392B' });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const { next } = mockCommandArgs[0]!;
    expect(next.perTreadOverrides?.[2]?.appearance).toEqual({ colorHex: '#C0392B' });
    expect(next.perTreadOverrides?.[2]?.material).toBe('oak'); // δεν χάθηκε
  });

  it('clear (value=null) → appearance undefined στο override', () => {
    mockState.stair = fakeStair({ perTreadOverrides: { 0: { appearance: { colorHex: '#fff' } } } });
    applyStairSubElementAppearance(levels, 'stair_1', 'tread', 0, null);
    const { next } = mockCommandArgs[0]!;
    expect(next.perTreadOverrides?.[0]?.appearance).toBeUndefined();
  });

  it('routes riser → perRiserOverrides', () => {
    mockState.stair = fakeStair({});
    applyStairSubElementAppearance(levels, 'stair_1', 'riser', 3, { materialId: 'wc-brick' });
    const { next } = mockCommandArgs[0]!;
    expect(next.perRiserOverrides?.[3]?.appearance).toEqual({ materialId: 'wc-brick' });
  });

  it('routes landing → perLandingOverrides, waist → perWaistOverrides', () => {
    mockState.stair = fakeStair({});
    applyStairSubElementAppearance(levels, 'stair_1', 'landing', 0, { colorHex: '#111' });
    applyStairSubElementAppearance(levels, 'stair_1', 'waist', 1, { colorHex: '#222' });
    expect(mockCommandArgs[0]!.next.perLandingOverrides?.[0]?.appearance).toEqual({ colorHex: '#111' });
    expect(mockCommandArgs[1]!.next.perWaistOverrides?.[1]?.appearance).toEqual({ colorHex: '#222' });
  });

  it('διατηρεί άλλα indices του ίδιου record', () => {
    mockState.stair = fakeStair({ perTreadOverrides: { 0: { material: 'oak' }, 5: { material: 'steel' } } });
    applyStairSubElementAppearance(levels, 'stair_1', 'tread', 0, { colorHex: '#abc' });
    const { next } = mockCommandArgs[0]!;
    expect(next.perTreadOverrides?.[5]?.material).toBe('steel'); // ανέγγιχτο
    expect(next.perTreadOverrides?.[0]?.appearance).toEqual({ colorHex: '#abc' });
  });

  it('no-op όταν λείπει η σκάλα (getEntity → undefined)', () => {
    mockState.stair = undefined;
    applyStairSubElementAppearance(levels, 'stair_1', 'tread', 0, { colorHex: '#000' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('no-op όταν λείπει currentLevelId', () => {
    mockState.stair = fakeStair({});
    const noLevel = { currentLevelId: undefined } as unknown as LevelsHookReturn;
    applyStairSubElementAppearance(noLevel, 'stair_1', 'tread', 0, { colorHex: '#000' });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
