/**
 * ADR-421 SLICE C follow-up (a) — useRibbonOpeningBridge type-aware gating.
 *
 * Coverage:
 *   - getComboboxState: type-governed comboboxes (kind/width/height) report
 *     `disabled: true` when the opening is typed (`typeId` set), and
 *     `disabled: false` when untyped (zero regression).
 *   - getComboboxState: instance-owned comboboxes (sillHeight/handing) stay
 *     editable (`disabled: false`) even on a typed opening.
 *   - onComboboxChange: defense-in-depth — a programmatic edit of a gated field
 *     on a typed opening is a no-op (no UpdateOpeningParamsCommand dispatch),
 *     while untyped openings + instance fields still dispatch.
 */

import { renderHook, act } from '@testing-library/react';
import { useRibbonOpeningBridge } from '../useRibbonOpeningBridge';
import { OPENING_RIBBON_KEYS } from '../bridge/opening-command-keys';
import { UpdateOpeningParamsCommand } from '../../../../core/commands/entity-commands/UpdateOpeningParamsCommand';
import { resetGlobalCommandHistory } from '../../../../core/commands';

// ── Mock UpdateOpeningParamsCommand to capture writes ─────────────────────────
jest.mock(
  '../../../../core/commands/entity-commands/UpdateOpeningParamsCommand',
  () => ({
    UpdateOpeningParamsCommand: jest.fn().mockImplementation((id, next, prev) => ({
      execute: jest.fn(),
      undo: jest.fn(),
      __id: id,
      __next: next,
      __prev: prev,
    })),
  }),
);

// ── Test fixtures ─────────────────────────────────────────────────────────────
const baseOpening = {
  id: 'op-1',
  type: 'opening' as const,
  layerId: 'lvl-1',
  visible: true,
  kind: 'door' as const,
  ifcType: 'IfcDoor' as const,
  params: {
    kind: 'door' as const,
    wallId: 'wall-1',
    width: 900,
    height: 2100,
    sillHeight: 0,
    handing: 'left' as const,
    offsetFromStart: 1000,
  },
  geometry: {},
  validation: { isValid: true, hardErrors: [], softWarnings: [], hasCodeViolations: false },
};

const typedOpening = { ...baseOpening, id: 'op-typed', typeId: 'ft-door-90x210' };

function makeLevelManager(entity: unknown | null) {
  const scene = entity ? { entities: [entity as typeof baseOpening] } : null;
  return {
    currentLevelId: 'lvl-1',
    getLevelScene: jest.fn(() => scene),
    setLevelScene: jest.fn(),
  } as unknown as Parameters<typeof useRibbonOpeningBridge>[0]['levelManager'];
}

function makeSelection(id: string | null) {
  return {
    getPrimaryId: jest.fn(() => id),
  } as unknown as Parameters<typeof useRibbonOpeningBridge>[0]['universalSelection'];
}

function renderBridge(entity: unknown | null) {
  return renderHook(() =>
    useRibbonOpeningBridge({
      levelManager: makeLevelManager(entity),
      universalSelection: makeSelection(entity ? (entity as typeof baseOpening).id : null),
    }),
  );
}

beforeEach(() => {
  resetGlobalCommandHistory();
  (UpdateOpeningParamsCommand as jest.Mock).mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// getComboboxState — disabled flag
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonOpeningBridge — type-aware gating (getComboboxState)', () => {
  it('untyped opening: type-governed comboboxes are editable (disabled false)', () => {
    const { result } = renderBridge(baseOpening);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.stringParams.kind)?.disabled).toBe(false);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.params.width)?.disabled).toBe(false);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.params.height)?.disabled).toBe(false);
  });

  it('typed opening: kind/width/height comboboxes are read-only (disabled true)', () => {
    const { result } = renderBridge(typedOpening);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.stringParams.kind)?.disabled).toBe(true);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.params.width)?.disabled).toBe(true);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.params.height)?.disabled).toBe(true);
  });

  it('typed opening: still exposes the type value (read-only, not blanked)', () => {
    const { result } = renderBridge(typedOpening);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.params.width)?.value).toBe('900');
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.stringParams.kind)?.value).toBe('door');
  });

  it('typed opening: instance-owned comboboxes stay editable (disabled false)', () => {
    const { result } = renderBridge(typedOpening);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.params.sillHeight)?.disabled).toBe(false);
    expect(result.current.getComboboxState(OPENING_RIBBON_KEYS.stringParams.handing)?.disabled).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// onComboboxChange — defense-in-depth guard
// ─────────────────────────────────────────────────────────────────────────────

describe('useRibbonOpeningBridge — type-aware gating (onComboboxChange guard)', () => {
  it('typed opening: gated field edit is a no-op (no command dispatched)', () => {
    const { result } = renderBridge(typedOpening);
    act(() => result.current.onComboboxChange(OPENING_RIBBON_KEYS.params.width, '1200'));
    act(() => result.current.onComboboxChange(OPENING_RIBBON_KEYS.stringParams.kind, 'window'));
    expect((UpdateOpeningParamsCommand as jest.Mock).mock.calls.length).toBe(0);
  });

  it('typed opening: instance field edit still dispatches', () => {
    const { result } = renderBridge(typedOpening);
    act(() => result.current.onComboboxChange(OPENING_RIBBON_KEYS.params.sillHeight, '150'));
    expect((UpdateOpeningParamsCommand as jest.Mock).mock.calls.length).toBe(1);
  });

  it('untyped opening: gated field edit still dispatches (zero regression)', () => {
    const { result } = renderBridge(baseOpening);
    act(() => result.current.onComboboxChange(OPENING_RIBBON_KEYS.params.width, '1200'));
    const next = (UpdateOpeningParamsCommand as jest.Mock).mock.calls[0]?.[1];
    expect(next.width).toBe(1200);
  });
});
