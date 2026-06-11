/**
 * ADR-362 Phase E3 — Tests for the Home → Dimensions QUICK-ACCESS launcher.
 *
 * The full toolset lives on the Annotate tab (`annotate-tab-dimensions.ts`);
 * Home keeps a single compact split-button (AutoCAD "Home → Annotation" pattern).
 *
 * Coverage:
 *   - One large split button, commandKey `dim-smart`, shortcut DIM
 *   - Dropdown = 6 common types, all `commandKey`s ∈ the Annotate full set
 *   - i18n labels in the `ribbon.commands.dim*` namespace; non-empty icons
 */

import { HOME_DIMENSIONS_PANEL } from '../home-tab-dimensions';
import { ANNOTATE_DIMENSION_PANELS } from '../annotate-tab-dimensions';

const ANNOTATE_KEYS = new Set(
  ANNOTATE_DIMENSION_PANELS.flatMap((p) => p.rows.flatMap((r) => r.buttons.map((b) => b.command.commandKey))),
);

describe('ADR-362 Phase E3 — HOME_DIMENSIONS_PANEL quick-access launcher', () => {
  it('is a single large split button anchored on Smart DIM', () => {
    expect(HOME_DIMENSIONS_PANEL.id).toBe('dimensions');
    expect(HOME_DIMENSIONS_PANEL.labelKey).toBe('ribbon.panels.dimensions');
    expect(HOME_DIMENSIONS_PANEL.rows).toHaveLength(1);
    expect(HOME_DIMENSIONS_PANEL.rows[0].buttons).toHaveLength(1);
    const btn = HOME_DIMENSIONS_PANEL.rows[0].buttons[0];
    expect(btn.type).toBe('split');
    expect(btn.size).toBe('large');
    expect(btn.command.commandKey).toBe('dim-smart');
    expect(btn.command.shortcut).toBe('DIM');
  });

  it('only offers common dim types that also exist in the Annotate full set (SSoT)', () => {
    const variants = HOME_DIMENSIONS_PANEL.rows[0].buttons[0].variants ?? [];
    expect(variants.length).toBeGreaterThanOrEqual(5);
    for (const v of variants) {
      expect(ANNOTATE_KEYS.has(v.commandKey)).toBe(true);
      expect(v.labelKey).toMatch(/^ribbon\.commands\.dim/);
      expect(typeof v.icon).toBe('string');
      expect(v.icon).not.toBe('');
    }
  });
});
