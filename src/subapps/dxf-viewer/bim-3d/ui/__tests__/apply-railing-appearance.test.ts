/**
 * ADR-407 Φ8 — writers `applyRailingWholeAppearance` / `applyRailingComponentAppearance`: γράφουν το
 * appearance στα σωστά `params` πεδία (`appearance` / `componentAppearance[component]`), immutably,
 * διατηρώντας τα υπόλοιπα, και εκτελούν `UpdateRailingParamsCommand` (ΕΝΑ undo). Οι deps mocked ώστε
 * να ελέγχεται ΜΟΝΟ το merge/routing (όχι geometry recompute).
 */

import type { RailingEntity, RailingParams } from '../../../bim/types/railing-types';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';

const mockExecute = jest.fn();
const mockCommandArgs: Array<{ railingId: string; next: RailingParams; prev: RailingParams }> = [];
const mockState: { railing: RailingEntity | undefined } = { railing: undefined };

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: mockExecute }),
}));
jest.mock('../../../core/commands/entity-commands/UpdateRailingParamsCommand', () => ({
  UpdateRailingParamsCommand: class {
    constructor(railingId: string, next: RailingParams, prev: RailingParams) {
      mockCommandArgs.push({ railingId, next, prev });
    }
  },
}));
jest.mock('../current-level-adapter', () => ({
  currentLevelAdapter: () => ({ getEntity: () => mockState.railing }),
}));

import { applyRailingWholeAppearance, applyRailingComponentAppearance } from '../apply-railing-appearance';

const levels = { currentLevelId: 'lvl1' } as unknown as LevelsHookReturn;

function fakeRailing(params: Partial<RailingParams>): RailingEntity {
  return { id: 'railing_1', type: 'railing', params } as unknown as RailingEntity;
}

beforeEach(() => {
  mockExecute.mockClear();
  mockCommandArgs.length = 0;
  mockState.railing = undefined;
});

describe('applyRailingWholeAppearance', () => {
  it('γράφει params.appearance, διατηρώντας τα υπόλοιπα params', () => {
    mockState.railing = fakeRailing({ totalHeightMm: 1000 } as Partial<RailingParams>);
    applyRailingWholeAppearance(levels, 'railing_1', { colorHex: '#654321' });
    expect(mockExecute).toHaveBeenCalledTimes(1);
    const { next } = mockCommandArgs[0]!;
    expect(next.appearance).toEqual({ colorHex: '#654321' });
    expect(next.totalHeightMm).toBe(1000); // δεν χάθηκε
  });

  it('clear (value=null) → appearance undefined', () => {
    mockState.railing = fakeRailing({ appearance: { colorHex: '#fff' } });
    applyRailingWholeAppearance(levels, 'railing_1', null);
    expect(mockCommandArgs[0]!.next.appearance).toBeUndefined();
  });
});

describe('applyRailingComponentAppearance', () => {
  it('γράφει componentAppearance[component], διατηρώντας άλλα components', () => {
    mockState.railing = fakeRailing({ componentAppearance: { post: { colorHex: '#111' } } });
    applyRailingComponentAppearance(levels, 'railing_1', 'baluster', { materialId: 'wc-brick' });
    const { next } = mockCommandArgs[0]!;
    expect(next.componentAppearance?.baluster).toEqual({ materialId: 'wc-brick' });
    expect(next.componentAppearance?.post).toEqual({ colorHex: '#111' }); // ανέγγιχτο
  });

  it('clear (value=null) → του component το appearance undefined', () => {
    mockState.railing = fakeRailing({ componentAppearance: { rail: { colorHex: '#abc' } } });
    applyRailingComponentAppearance(levels, 'railing_1', 'rail', null);
    expect(mockCommandArgs[0]!.next.componentAppearance?.rail).toBeUndefined();
  });

  it('no-op όταν λείπει το κάγκελο (getEntity → undefined)', () => {
    mockState.railing = undefined;
    applyRailingComponentAppearance(levels, 'railing_1', 'post', { colorHex: '#000' });
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('no-op όταν το entity δεν είναι κάγκελο', () => {
    mockState.railing = { id: 'x', type: 'wall', params: {} } as unknown as typeof mockState.railing;
    applyRailingWholeAppearance(levels, 'railing_1', { colorHex: '#000' });
    expect(mockExecute).not.toHaveBeenCalled();
  });
});
