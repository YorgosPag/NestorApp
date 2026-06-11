/**
 * ADR-362 Phase E3 — Tests for the contextual «Διαστάσεις» CREATION tab.
 *
 * Mirrors the guides contextual tab: auto-opens on `dim-tool-active`, all tools
 * as LARGE buttons. Editing keeps its own `dim-selected` tab (not tested here).
 *
 * Coverage:
 *   - Contextual tab metadata (id / label / isContextual / trigger)
 *   - 3 panels (Linear / Radial-Angular / Centers), canonical ids + label keys
 *   - ALL 14 dimension ToolType commandKeys present + unique (no tool lost)
 *   - EVERY button LARGE simple, no flyout/dropdown
 *   - i18n labels in `ribbon.commands.dim*`; non-empty icons; no comingSoon
 *   - Shortcut uniqueness (only Smart DIM = 'DIM')
 */

import {
  CONTEXTUAL_DIMENSIONS_TAB,
  DIMENSIONS_CONTEXTUAL_TRIGGER,
} from '../contextual-dimensions-tab';
import type { RibbonCommand } from '../../types/ribbon-types';

const EXPECTED_COMMAND_KEYS = [
  'dim-smart', 'dim-linear', 'dim-aligned', 'dim-baseline', 'dim-continued', 'dim-ordinate',
  'dim-radius', 'dim-diameter', 'dim-jogged-radius', 'dim-arc-length', 'dim-angular2L', 'dim-angular3P',
  'dim-center-mark', 'dim-centerline',
] as const;

function allButtons() {
  return CONTEXTUAL_DIMENSIONS_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}
function allCommands(): RibbonCommand[] {
  return allButtons().map((b) => b.command);
}

describe('ADR-362 Phase E3 — CONTEXTUAL_DIMENSIONS_TAB', () => {
  it('is a contextual tab keyed on the dim-tool-active trigger', () => {
    expect(CONTEXTUAL_DIMENSIONS_TAB.id).toBe('dimensions-create');
    expect(CONTEXTUAL_DIMENSIONS_TAB.labelKey).toBe('ribbon.tabs.dimensions');
    expect(CONTEXTUAL_DIMENSIONS_TAB.isContextual).toBe(true);
    expect(CONTEXTUAL_DIMENSIONS_TAB.contextualTrigger).toBe(DIMENSIONS_CONTEXTUAL_TRIGGER);
    expect(DIMENSIONS_CONTEXTUAL_TRIGGER).toBe('dim-tool-active');
  });

  it('declares the three Revit-style panels with canonical ids + label keys', () => {
    expect(CONTEXTUAL_DIMENSIONS_TAB.panels.map((p) => p.id)).toEqual([
      'dim-create-linear', 'dim-create-radial', 'dim-create-centers',
    ]);
    expect(CONTEXTUAL_DIMENSIONS_TAB.panels.map((p) => p.labelKey)).toEqual([
      'ribbon.panels.dimLinear', 'ribbon.panels.dimRadialAngular', 'ribbon.panels.dimCenters',
    ]);
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
    for (const panel of CONTEXTUAL_DIMENSIONS_TAB.panels) {
      for (const row of panel.rows) {
        expect(row.isInFlyout).toBe(false);
      }
    }
  });

  it('routes every label through the i18n namespace, no comingSoon, non-empty icon (N.11)', () => {
    for (const command of allCommands()) {
      expect(command.labelKey).toMatch(/^ribbon\.commands\.dim/);
      expect(command.comingSoon).toBeFalsy();
      expect(typeof command.icon).toBe('string');
      expect(command.icon).not.toBe('');
    }
  });

  it('keeps shortcuts unique across the panels (Smart DIM = DIM)', () => {
    const shortcuts = allCommands().map((c) => c.shortcut).filter((s): s is string => !!s);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
    expect(shortcuts).toContain('DIM');
  });
});
