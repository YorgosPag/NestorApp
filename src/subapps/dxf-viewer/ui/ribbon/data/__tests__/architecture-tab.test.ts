/**
 * ADR-444 — Tests for the permanent «Αρχιτεκτονικά» (Architecture) ribbon tab.
 * Sibling of STRUCTURAL_TAB (ADR-443): permanent, all-large, no flyout.
 */

import { ARCHITECTURE_TAB } from '../architecture-tab';
import type { RibbonCommand } from '../../types/ribbon-types';

const EXPECTED_COMMAND_KEYS = ['roof', 'floor-finish', 'thermal-space', 'space-separator'] as const;

function allButtons() {
  return ARCHITECTURE_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}
function allCommands(): RibbonCommand[] {
  return allButtons().map((b) => b.command);
}

describe('ADR-444 — ARCHITECTURE_TAB (permanent «Αρχιτεκτονικά» tab)', () => {
  it('is a PERMANENT tab (NOT contextual)', () => {
    expect(ARCHITECTURE_TAB.id).toBe('architecture');
    expect(ARCHITECTURE_TAB.labelKey).toBe('ribbon.tabs.architecture');
    expect(ARCHITECTURE_TAB.isContextual).toBeUndefined();
  });

  it('declares the two Revit-style panels with canonical ids + label keys', () => {
    expect(ARCHITECTURE_TAB.panels.map((p) => p.id)).toEqual(['arch-roof-floor', 'arch-spaces']);
    expect(ARCHITECTURE_TAB.panels.map((p) => p.labelKey)).toEqual([
      'ribbon.panels.archRoofFloor', 'ribbon.panels.archSpaces',
    ]);
  });

  it('keeps ALL architecture commandKeys present + unique', () => {
    const keys = allCommands().map((c) => c.commandKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(EXPECTED_COMMAND_KEYS));
  });

  it('renders EVERY command as a LARGE simple button — nothing in a flyout', () => {
    for (const button of allButtons()) {
      expect(button.type).toBe('simple');
      expect(button.size).toBe('large');
      expect(button.variants).toBeUndefined();
    }
    for (const panel of ARCHITECTURE_TAB.panels) {
      for (const row of panel.rows) expect(row.isInFlyout).toBe(false);
    }
  });

  it('routes every label through i18n, no comingSoon, non-empty icon (N.11)', () => {
    for (const command of allCommands()) {
      expect(command.labelKey).toMatch(/^ribbon\.commands\./);
      expect(command.comingSoon).toBeFalsy();
      expect(command.icon).toBeTruthy();
    }
  });
});
