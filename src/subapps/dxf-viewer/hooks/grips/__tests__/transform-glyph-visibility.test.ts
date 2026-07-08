/**
 * ADR-559 §multi-select — tests for the per-object MOVE/ROTATION glyph suppression
 * predicate SSoT (shared by the visible + pickable grip paths).
 */

import type { GripInfo } from '../../grip-types';
import {
  MULTI_SELECT_HIDE_TRANSFORM_THRESHOLD,
  hidesPerObjectTransformGlyphs,
  isTransformGlyphShape,
  dataGripGlyphShape,
  shouldHideDataGripForSelection,
} from '../transform-glyph-visibility';

function grip(partial: Partial<GripInfo>): GripInfo {
  return {
    entityId: 'e1',
    gripIndex: 0,
    type: 'vertex',
    position: { x: 0, y: 0 },
    movesEntity: false,
    ...partial,
  };
}

describe('hidesPerObjectTransformGlyphs', () => {
  it('is false for 0 or 1 selected objects (single selection keeps move + rotation)', () => {
    expect(hidesPerObjectTransformGlyphs(0)).toBe(false);
    expect(hidesPerObjectTransformGlyphs(1)).toBe(false);
  });

  it('is true from the threshold (≥2) upward', () => {
    expect(MULTI_SELECT_HIDE_TRANSFORM_THRESHOLD).toBe(2);
    expect(hidesPerObjectTransformGlyphs(2)).toBe(true);
    expect(hidesPerObjectTransformGlyphs(5)).toBe(true);
  });
});

describe('isTransformGlyphShape', () => {
  it('matches ONLY the move + rotation glyph shapes', () => {
    expect(isTransformGlyphShape('move')).toBe(true);
    expect(isTransformGlyphShape('rotation')).toBe(true);
    expect(isTransformGlyphShape('square')).toBe(false);
    expect(isTransformGlyphShape('triangle-up')).toBe(false);
    expect(isTransformGlyphShape(undefined)).toBe(false);
    expect(isTransformGlyphShape(null)).toBe(false);
  });
});

describe('dataGripGlyphShape', () => {
  it('resolves the MOVE glyph from any entity kind field', () => {
    expect(
      dataGripGlyphShape(
        grip({ wallGripKind: 'wall-midpoint', gripKind: { on: 'wall', kind: 'wall-midpoint' } }),
      ),
    ).toBe('move');
    expect(
      dataGripGlyphShape(
        grip({ columnGripKind: 'column-center', gripKind: { on: 'column', kind: 'column-center' } }),
      ),
    ).toBe('move');
    expect(
      dataGripGlyphShape(grip({ lineGripKind: 'line-move', gripKind: { on: 'line', kind: 'line-move' } })),
    ).toBe('move');
    expect(
      dataGripGlyphShape(grip({ textGripKind: 'text-move', gripKind: { on: 'text', kind: 'text-move' } })),
    ).toBe('move');
  });

  it('resolves the ROTATION glyph from any entity kind field', () => {
    expect(
      dataGripGlyphShape(
        grip({ wallGripKind: 'wall-rotation', gripKind: { on: 'wall', kind: 'wall-rotation' } }),
      ),
    ).toBe('rotation');
    expect(
      dataGripGlyphShape(
        grip({ columnGripKind: 'column-rotation', gripKind: { on: 'column', kind: 'column-rotation' } }),
      ),
    ).toBe('rotation');
    expect(
      dataGripGlyphShape(
        grip({ lineGripKind: 'line-rotation', gripKind: { on: 'line', kind: 'line-rotation' } }),
      ),
    ).toBe('rotation');
  });

  it('resolves structural grips to the default square (never hidden)', () => {
    expect(
      dataGripGlyphShape(grip({ wallGripKind: 'wall-start', gripKind: { on: 'wall', kind: 'wall-start' } })),
    ).toBe('square');
    expect(dataGripGlyphShape(grip({ type: 'vertex' }))).toBe('square');
  });
});

describe('shouldHideDataGripForSelection', () => {
  it('hides move + rotation grips ONLY when ≥2 objects are selected', () => {
    const wallMove = grip({ wallGripKind: 'wall-midpoint', gripKind: { on: 'wall', kind: 'wall-midpoint' } });
    const wallRot = grip({ wallGripKind: 'wall-rotation', gripKind: { on: 'wall', kind: 'wall-rotation' } });
    const lineRot = grip({ lineGripKind: 'line-rotation', gripKind: { on: 'line', kind: 'line-rotation' } });

    // single selection → nothing hidden (wall shows its 8 handles + move + rotation)
    expect(shouldHideDataGripForSelection(wallMove, 1)).toBe(false);
    expect(shouldHideDataGripForSelection(wallRot, 1)).toBe(false);

    // multi selection → move + rotation hidden for every selected entity (wall + line)
    expect(shouldHideDataGripForSelection(wallMove, 2)).toBe(true);
    expect(shouldHideDataGripForSelection(wallRot, 2)).toBe(true);
    expect(shouldHideDataGripForSelection(lineRot, 2)).toBe(true);
  });

  it('never hides structural corner / midpoint / vertex grips, even on multi-select', () => {
    expect(
      shouldHideDataGripForSelection(
        grip({ wallGripKind: 'wall-start', gripKind: { on: 'wall', kind: 'wall-start' } }),
        3,
      ),
    ).toBe(false);
    expect(shouldHideDataGripForSelection(grip({ type: 'corner' }), 3)).toBe(false);
    expect(shouldHideDataGripForSelection(grip({ type: 'edge' }), 3)).toBe(false);
  });
});
