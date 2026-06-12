/**
 * ADR-382 — Visibility Resolver SSoT — Unit tests.
 *
 * Pure-function tests για `resolveIsEntityVisible()`. Covers:
 *   - Each of the 4 sources independently hides (V/G, Layer.visible,
 *     Layer.frozen, Floor 'hide', Building 'hide')
 *   - Ghost mode counts as visible (Q4 — stylistic-only)
 *   - undefined ctx fields default σε no-constraint
 *   - Multi-source hide combinations (AND-of-shows intersection)
 */

import { resolveIsEntityVisible } from '../visibility-resolver';
import type { SceneLayer } from '../../../types/scene-types';

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

describe('ADR-382 resolveIsEntityVisible', () => {
  describe('all sources visible (default)', () => {
    it('returns true when ctx is empty', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, {})).toBe(true);
    });

    it('returns true when all 4 sources explicitly visible', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall', layerId: 'lyr_a' },
        {
          objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: true } },
          layer: visibleLayer(),
          floorMode: 'show',
          buildingMode: 'show',
        },
      );
      expect(result).toBe(true);
    });
  });

  describe('V/G hide (source #1)', () => {
    it('returns false when V/G category visible=false', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall' },
        { objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } } },
      );
      expect(result).toBe(false);
    });

    it('returns true when objectStyles undefined (default visible)', () => {
      expect(resolveIsEntityVisible({ category: 'column' }, { objectStyles: undefined })).toBe(true);
    });

    it('returns true when category entry missing (default visible)', () => {
      expect(
        resolveIsEntityVisible({ category: 'column' }, { objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } } }),
      ).toBe(true);
    });
  });

  describe('Layer hide (source #2 — Q1 absolute hide)', () => {
    it('returns false when layer.visible=false', () => {
      expect(
        resolveIsEntityVisible({ category: 'wall', layerId: 'lyr_a' }, { layer: visibleLayer({ visible: false }) }),
      ).toBe(false);
    });

    it('returns false when layer.frozen=true', () => {
      expect(
        resolveIsEntityVisible({ category: 'wall', layerId: 'lyr_a' }, { layer: visibleLayer({ frozen: true }) }),
      ).toBe(false);
    });

    it('returns true when layer=null (no layer constraint)', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { layer: null })).toBe(true);
    });

    it('returns true when layer=undefined (no layer constraint)', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, {})).toBe(true);
    });
  });

  describe('Floor mode (source #3 — Q4 ghost stylistic)', () => {
    it('returns false when floorMode=hide', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { floorMode: 'hide' })).toBe(false);
    });

    it('returns true when floorMode=ghost (Q4 stylistic-only)', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { floorMode: 'ghost' })).toBe(true);
    });

    it('returns true when floorMode=show', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { floorMode: 'show' })).toBe(true);
    });
  });

  describe('Building mode (source #4)', () => {
    it('returns false when buildingMode=hide', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { buildingMode: 'hide' })).toBe(false);
    });

    it('returns true when buildingMode=ghost (Q4 stylistic-only)', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { buildingMode: 'ghost' })).toBe(true);
    });

    it('returns true when buildingMode=show', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, { buildingMode: 'show' })).toBe(true);
    });
  });

  describe('AND-of-shows intersection (Q2)', () => {
    it('hides when any single source disagrees (V/G fail, others pass)', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall' },
        {
          objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
          layer: visibleLayer(),
          floorMode: 'show',
          buildingMode: 'show',
        },
      );
      expect(result).toBe(false);
    });

    it('hides when any single source disagrees (Layer fail, others pass)', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall', layerId: 'lyr_a' },
        {
          objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: true } },
          layer: visibleLayer({ visible: false }),
          floorMode: 'show',
          buildingMode: 'show',
        },
      );
      expect(result).toBe(false);
    });

    it('hides when multiple sources hide', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall', layerId: 'lyr_a' },
        {
          objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
          layer: visibleLayer({ visible: false }),
          floorMode: 'hide',
          buildingMode: 'hide',
        },
      );
      expect(result).toBe(false);
    });
  });

  describe('Q4 ghost > V/G hide precedence', () => {
    it('Floor ghost + V/G hide → entity hidden (V/G wins over ghost)', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall' },
        {
          objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
          floorMode: 'ghost',
        },
      );
      expect(result).toBe(false);
    });

    it('Floor ghost + Layer hide → entity hidden', () => {
      const result = resolveIsEntityVisible(
        { category: 'wall', layerId: 'lyr_a' },
        { layer: visibleLayer({ visible: false }), floorMode: 'ghost' },
      );
      expect(result).toBe(false);
    });
  });

  describe('per-category isolation', () => {
    const categories = ['wall', 'column', 'slab', 'beam', 'stair', 'opening', 'slab-opening', 'roof'] as const;
    for (const cat of categories) {
      it(`hides ${cat} when its own V/G entry says hidden`, () => {
        const result = resolveIsEntityVisible(
          { category: cat },
          { objectStyles: { [cat]: { projectionPen: 5, cutPen: 7, visible: false } } },
        );
        expect(result).toBe(false);
      });
    }
  });

  // ── ADR-405 §4 — Discipline filter (source #5) ─────────────────────────────
  describe('Discipline hide (source #5)', () => {
    it('hides a wall (architectural) when architectural discipline = false', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'wall' },
          { disciplineVisibility: { architectural: false } },
        ),
      ).toBe(false);
    });

    it('hides a roof (architectural) when architectural discipline = false (§10 #4)', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'roof' },
          { disciplineVisibility: { architectural: false } },
        ),
      ).toBe(false);
    });

    it('does NOT hide a roof when only structural is hidden (roof is architectural, not slab)', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'roof' },
          { disciplineVisibility: { structural: false } },
        ),
      ).toBe(true);
    });

    it('hides a column (structural) when structural discipline = false', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'column' },
          { disciplineVisibility: { structural: false } },
        ),
      ).toBe(false);
    });

    it('does NOT hide a wall when only structural is hidden (type-derived discipline)', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'wall' },
          { disciplineVisibility: { structural: false } },
        ),
      ).toBe(true);
    });

    it('per-instance override wins over type-derived discipline', () => {
      // A slab (structurally derived) reassigned to architectural is hidden by
      // architectural=false, NOT by structural=false.
      expect(
        resolveIsEntityVisible(
          { category: 'slab', discipline: 'architectural' },
          { disciplineVisibility: { architectural: false } },
        ),
      ).toBe(false);
      expect(
        resolveIsEntityVisible(
          { category: 'slab', discipline: 'architectural' },
          { disciplineVisibility: { structural: false } },
        ),
      ).toBe(true);
    });

    it('never filters annotation categories (dimension/hatch/grip)', () => {
      for (const cat of ['dimension', 'hatch', 'grip'] as const) {
        expect(
          resolveIsEntityVisible(
            { category: cat },
            // even an exhaustive hide map must not touch annotations
            { disciplineVisibility: { architectural: false, structural: false } },
          ),
        ).toBe(true);
      }
    });

    it('returns true when disciplineVisibility undefined (no constraint)', () => {
      expect(resolveIsEntityVisible({ category: 'wall' }, {})).toBe(true);
    });

    it('returns true when the discipline key is absent (default visible)', () => {
      expect(
        resolveIsEntityVisible({ category: 'wall' }, { disciplineVisibility: {} }),
      ).toBe(true);
    });

    it('composes with other sources (ANY-hides-wins)', () => {
      // discipline says show, but V/G hides → hidden
      expect(
        resolveIsEntityVisible(
          { category: 'wall' },
          {
            objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: false } },
            disciplineVisibility: { architectural: true },
          },
        ),
      ).toBe(false);
    });
  });

  // ── ADR-358 §5.6.bis — Entity-scope isolate (Revit "Isolate Element") ──────
  describe('Entity-scope isolate (strongest hide source)', () => {
    const isolateOn = (ids: string[]) => ({ active: true, entityIds: new Set(ids) });

    it('keeps the isolated entity visible', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'wall', id: 'ent_keep' },
          { isolate: isolateOn(['ent_keep']) },
        ),
      ).toBe(true);
    });

    it('hides an entity outside the isolated set', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'wall', id: 'ent_other' },
          { isolate: isolateOn(['ent_keep']) },
        ),
      ).toBe(false);
    });

    it('hides an entity with no id when isolate is active (e.g. envelope/wires)', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'envelope' },
          { isolate: isolateOn(['ent_keep']) },
        ),
      ).toBe(false);
    });

    it('no constraint when isolate inactive', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'wall', id: 'ent_other' },
          { isolate: { active: false, entityIds: new Set(['ent_keep']) } },
        ),
      ).toBe(true);
    });

    it('no constraint when isolated set is empty (layer-scope session)', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'wall', id: 'ent_other' },
          { isolate: { active: true, entityIds: new Set() } },
        ),
      ).toBe(true);
    });

    it('overrides all other sources — wins even when V/G/layer say show', () => {
      // The isolated entity stays visible; a non-isolated one is hidden despite
      // every other source agreeing it should show.
      expect(
        resolveIsEntityVisible(
          { category: 'wall', id: 'ent_other', layerId: 'lyr_a' },
          {
            objectStyles: { wall: { projectionPen: 5, cutPen: 7, visible: true } },
            layer: visibleLayer(),
            floorMode: 'show',
            buildingMode: 'show',
            isolate: isolateOn(['ent_keep']),
          },
        ),
      ).toBe(false);
    });
  });

  // ── ADR-358 §5.6.bis — Category-scope isolate (Revit "Isolate Category") ───
  describe('Category-scope isolate', () => {
    const catIsolate = (cats: string[]) => ({ active: true, entityIds: new Set<string>(), categories: new Set(cats) });

    it('keeps entities of the isolated category visible', () => {
      expect(
        resolveIsEntityVisible({ category: 'wall' }, { isolate: catIsolate(['wall']) }),
      ).toBe(true);
    });

    it('hides entities of other categories', () => {
      expect(
        resolveIsEntityVisible({ category: 'column' }, { isolate: catIsolate(['wall']) }),
      ).toBe(false);
    });

    it('supports multiple isolated categories', () => {
      expect(
        resolveIsEntityVisible({ category: 'column' }, { isolate: catIsolate(['wall', 'column']) }),
      ).toBe(true);
      expect(
        resolveIsEntityVisible({ category: 'slab' }, { isolate: catIsolate(['wall', 'column']) }),
      ).toBe(false);
    });

    it('no constraint when categories empty', () => {
      expect(
        resolveIsEntityVisible({ category: 'slab' }, { isolate: { active: true, entityIds: new Set(), categories: new Set() } }),
      ).toBe(true);
    });

    it('no constraint when isolate inactive', () => {
      expect(
        resolveIsEntityVisible({ category: 'slab' }, { isolate: { active: false, entityIds: new Set(), categories: new Set(['wall']) } }),
      ).toBe(true);
    });

    it('overrides all other sources — hides non-isolated category despite show', () => {
      expect(
        resolveIsEntityVisible(
          { category: 'column', layerId: 'lyr_a' },
          {
            objectStyles: { column: { projectionPen: 5, cutPen: 7, visible: true } },
            layer: visibleLayer(),
            floorMode: 'show',
            buildingMode: 'show',
            isolate: catIsolate(['wall']),
          },
        ),
      ).toBe(false);
    });
  });
});
