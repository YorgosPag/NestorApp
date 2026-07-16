/**
 * ADR-382 / ADR-405 — BIM 2D-plan visibility SSoT — Unit tests.
 *
 * Verifies `resolveBimPlanVisibility()` reads `objectStyles` +
 * `disciplineVisibility` από το render-settings store (event-time snapshot) και
 * delegate-άρει σωστά στον pure `resolveIsEntityVisible`. Επιβεβαιώνει ότι το
 * store διαβάζεται μία φορά per call (event-time, χωρίς caching/subscription).
 */

jest.mock('../../../state/drawing-scale-store', () => ({
  useDrawingScaleStore: { getState: jest.fn() },
}));

import { resolveBimPlanVisibility } from '../bim-plan-visibility';
import { useDrawingScaleStore } from '../../../state/drawing-scale-store';
import type { SceneLayer } from '../../../types/scene-types';

const mockGetState = useDrawingScaleStore.getState as jest.Mock;

function visibleLayer(overrides: Partial<SceneLayer> = {}): SceneLayer {
  return {
    id: 'lyr_test',
    name: 'Test Layer',
    color: '#ffffff',
    visible: true,
    locked: false,
    ...overrides,
  } as SceneLayer;
}

beforeEach(() => {
  mockGetState.mockReset();
});

describe('ADR-382 resolveBimPlanVisibility', () => {
  it('returns true when store is empty and no layer constraint', () => {
    mockGetState.mockReturnValue({ objectStyles: {}, disciplineVisibility: {} });
    expect(resolveBimPlanVisibility({ category: 'wall' }, null)).toBe(true);
  });

  it('hides when the V/G category override marks the category invisible', () => {
    mockGetState.mockReturnValue({
      objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
      disciplineVisibility: {},
    });
    expect(resolveBimPlanVisibility({ category: 'wall' }, null)).toBe(false);
  });

  it('hides when the entity layer is not visible', () => {
    mockGetState.mockReturnValue({ objectStyles: {}, disciplineVisibility: {} });
    expect(
      resolveBimPlanVisibility({ category: 'wall', layerId: 'lyr_a' }, visibleLayer({ visible: false })),
    ).toBe(false);
  });

  it('hides when the entity layer is frozen', () => {
    mockGetState.mockReturnValue({ objectStyles: {}, disciplineVisibility: {} });
    expect(
      resolveBimPlanVisibility({ category: 'wall' }, visibleLayer({ frozen: true } as Partial<SceneLayer>)),
    ).toBe(false);
  });

  it('hides when the discipline of the category is toggled off', () => {
    mockGetState.mockReturnValue({
      objectStyles: {},
      // 'wall' → architectural discipline (DISCIPLINE_BY_CATEGORY). false ⇒ hidden.
      disciplineVisibility: { architectural: false },
    });
    expect(resolveBimPlanVisibility({ category: 'wall' }, null)).toBe(false);
  });

  it('stays visible when all sources agree "show"', () => {
    mockGetState.mockReturnValue({
      objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: true } },
      disciplineVisibility: { architectural: true },
    });
    expect(resolveBimPlanVisibility({ category: 'wall', layerId: 'lyr_a' }, visibleLayer())).toBe(true);
  });

  it('reads the store fresh on every call (event-time, no caching)', () => {
    mockGetState.mockReturnValue({ objectStyles: {}, disciplineVisibility: {} });
    resolveBimPlanVisibility({ category: 'wall' }, null);
    resolveBimPlanVisibility({ category: 'wall' }, null);
    expect(mockGetState).toHaveBeenCalledTimes(2);
  });
});
