/**
 * ADR-445 — `migrateBimRenderSettings` colour-refresh migration tests.
 *
 * Persisted levels froze the FULL objectStyles map (incl. default colours), so a
 * pre-versioned snapshot shadows new code defaults. The migration re-derives ONLY
 * the projection/cut colours from current defaults while preserving user pen/
 * visibility/pattern edits, and stamps the schema version (idempotent).
 */

import {
  migrateBimRenderSettings,
  BIM_SETTINGS_VERSION,
  type BimRenderSettings,
} from '../bim-render-settings-types';
import { BIM_CATEGORY_LINE_COLORS } from '../bim-object-styles';

describe('ADR-445 — migrateBimRenderSettings', () => {
  it('returns null untouched (fresh level → uses code defaults)', () => {
    expect(migrateBimRenderSettings(null)).toEqual({ settings: null, changed: false });
  });

  it('leaves an already-current doc untouched (idempotent)', () => {
    const s: BimRenderSettings = { settingsVersion: BIM_SETTINGS_VERSION, drawingScale: 100 };
    const out = migrateBimRenderSettings(s);
    expect(out.changed).toBe(false);
    expect(out.settings).toBe(s);
  });

  it('refreshes frozen structural colours to current defaults + stamps version', () => {
    const s: BimRenderSettings = {
      drawingScale: 50,
      objectStyles: {
        // pre-ADR-445 frozen grey-blue foundation + extra user pen edit
        foundation: { projectionPen: 5, cutPen: 7, projectionColor: '#6b7a8f', cutColor: '#6b7a8f', visible: true },
      },
    };
    const { settings, changed } = migrateBimRenderSettings(s);
    expect(changed).toBe(true);
    expect(settings?.settingsVersion).toBe(BIM_SETTINGS_VERSION);
    const f = settings?.objectStyles?.foundation;
    // colour healed to the new sienna default…
    expect(f?.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.foundation);
    expect(f?.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.foundation);
    // …while user pen + visibility edits survive.
    expect(f?.projectionPen).toBe(5);
    expect(f?.cutPen).toBe(7);
    expect(f?.visible).toBe(true);
    // drawingScale (and other top-level fields) untouched.
    expect(settings?.drawingScale).toBe(50);
  });

  it('refreshes subcategory colours too (column shear-wall)', () => {
    const s: BimRenderSettings = {
      drawingScale: 100,
      objectStyles: {
        column: {
          projectionPen: 4, cutPen: 6, projectionColor: '#5b6478', cutColor: '#5b6478',
          subcategories: { 'shear-wall': { projectionColor: '#2f3a4a', cutColor: '#2f3a4a' } },
        },
      },
    };
    const { settings } = migrateBimRenderSettings(s);
    const col = settings?.objectStyles?.column;
    expect(col?.projectionColor).toBe(BIM_CATEGORY_LINE_COLORS.column); // #2f6690
    expect(col?.subcategories?.['shear-wall']?.cutColor).toBe(BIM_CATEGORY_LINE_COLORS.shearWall); // #24506b
  });

  it('drops a colour the current default no longer defines (→ canvas token)', () => {
    const s: BimRenderSettings = {
      drawingScale: 100,
      // `ceiling` has no default colour → a stale persisted colour must be removed.
      objectStyles: { ceiling: { projectionPen: 3, cutPen: 4, projectionColor: '#123456' } },
    };
    const { settings } = migrateBimRenderSettings(s);
    expect(settings?.objectStyles?.ceiling?.projectionColor).toBeUndefined();
    expect(settings?.objectStyles?.ceiling?.projectionPen).toBe(3); // pen preserved
  });
});
