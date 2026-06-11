/**
 * ADR-362 Phase E3 / ADR-442 follow-on — Tests for the Annotate-tab DIMENSION
 * CREATION panels. Pure structural assertions on the static `RibbonPanelDef`s.
 *
 * Revit-grade IA: dimension creation moved from Home → Dimensions (legacy
 * mega-dropdown) to the persistent «Επισημείωση» tab as LARGE grouped buttons.
 *
 * Coverage (invariants carried over from the retired home-tab-dimensions test):
 *   - 3 panels (Linear / Radial-Angular / Centers), canonical ids + label keys
 *   - ALL 14 dimension ToolType commandKeys present + unique (no tool lost)
 *   - EVERY button is a LARGE simple button — nothing hidden in a flyout/dropdown
 *   - i18n labels in the `ribbon.commands.dim*` namespace (no hardcoded text — N.11)
 *   - Non-empty icon token on every command; no `comingSoon`
 *   - Shortcut uniqueness across the panels (only Smart DIM = 'DIM')
 */

import {
  ANNOTATE_DIM_LINEAR_PANEL,
  ANNOTATE_DIM_RADIAL_PANEL,
  ANNOTATE_DIM_CENTERS_PANEL,
  ANNOTATE_DIMENSION_PANELS,
} from '../annotate-tab-dimensions';
import type { RibbonCommand } from '../../types/ribbon-types';

// Every dimension creation ToolType that must remain reachable (was: Smart DIM
// dropdown + baseline/continued + center mark/line in the legacy Home panel).
const EXPECTED_COMMAND_KEYS = [
  'dim-smart', 'dim-linear', 'dim-aligned', 'dim-baseline', 'dim-continued', 'dim-ordinate',
  'dim-radius', 'dim-diameter', 'dim-jogged-radius', 'dim-arc-length', 'dim-angular2L', 'dim-angular3P',
  'dim-center-mark', 'dim-centerline',
] as const;

function allButtons() {
  return ANNOTATE_DIMENSION_PANELS.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}
function allCommands(): RibbonCommand[] {
  return allButtons().map((b) => b.command);
}

describe('ADR-362 Phase E3 — Annotate-tab dimension creation panels', () => {
  it('declares the three Revit-style panels with canonical ids + label keys', () => {
    expect(ANNOTATE_DIMENSION_PANELS).toHaveLength(3);
    expect(ANNOTATE_DIM_LINEAR_PANEL.id).toBe('dim-create-linear');
    expect(ANNOTATE_DIM_LINEAR_PANEL.labelKey).toBe('ribbon.panels.dimLinear');
    expect(ANNOTATE_DIM_RADIAL_PANEL.id).toBe('dim-create-radial');
    expect(ANNOTATE_DIM_RADIAL_PANEL.labelKey).toBe('ribbon.panels.dimRadialAngular');
    expect(ANNOTATE_DIM_CENTERS_PANEL.id).toBe('dim-create-centers');
    expect(ANNOTATE_DIM_CENTERS_PANEL.labelKey).toBe('ribbon.panels.dimCenters');
  });

  it('keeps ALL 14 dimension ToolType commandKeys present + unique (no tool lost)', () => {
    const keys = allCommands().map((c) => c.commandKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(EXPECTED_COMMAND_KEYS));
  });

  it('renders EVERY command as a LARGE simple button — nothing in a flyout/dropdown', () => {
    for (const button of allButtons()) {
      expect(button.type).toBe('simple');
      expect(button.size).toBe('large');
      expect(button.variants).toBeUndefined();
    }
    for (const panel of ANNOTATE_DIMENSION_PANELS) {
      for (const row of panel.rows) {
        expect(row.isInFlyout).toBe(false);
      }
    }
  });

  it('exposes Smart DIM with the DIM shortcut as the first linear tool', () => {
    const smart = ANNOTATE_DIM_LINEAR_PANEL.rows[0].buttons[0];
    expect(smart.command.commandKey).toBe('dim-smart');
    expect(smart.command.shortcut).toBe('DIM');
    expect(smart.command.icon).toBe('dim-smart');
  });

  it('routes every label through the i18n namespace, with no comingSoon (N.11)', () => {
    for (const command of allCommands()) {
      expect(command.labelKey).toMatch(/^ribbon\.commands\.dim/);
      expect(command.comingSoon).toBeFalsy();
    }
  });

  it('attaches a non-empty icon token to every command', () => {
    for (const command of allCommands()) {
      expect(typeof command.icon).toBe('string');
      expect(command.icon).not.toBe('');
    }
  });

  it('keeps shortcuts unique across the panels', () => {
    const shortcuts = allCommands().map((c) => c.shortcut).filter((s): s is string => !!s);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
  });
});
