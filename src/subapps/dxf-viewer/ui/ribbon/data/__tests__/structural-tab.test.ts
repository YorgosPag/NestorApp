/**
 * ADR-443 — Tests for the permanent «Δομικά» (Structural) ribbon tab.
 *
 * Revit "Structure" tab: a PERMANENT tab (NOT contextual — must not occupy the
 * single contextual slot) with all load-bearing tools as LARGE flat buttons.
 * Clicking a tool activates it; its existing property contextual tab surfaces on
 * top (not tested here — lives in ribbon-contextual-config.ts).
 *
 * Coverage:
 *   - Tab metadata (id / label / NOT contextual)
 *   - 6 Revit-style panels, canonical ids + label keys
 *   - ALL structural tool commandKeys present + unique (no tool lost vs draw.bim.group)
 *   - EVERY button LARGE simple, no flyout/dropdown
 *   - i18n container labels (no hardcoded strings, N.11); non-empty icons; no comingSoon
 *   - Shortcuts unique
 */

import { STRUCTURAL_TAB } from '../structural-tab';
import type { RibbonCommand } from '../../types/ribbon-types';

// The 24 tool commandKeys + 1 action key formerly nested in draw.bim.group.
const EXPECTED_COMMAND_KEYS = [
  // walls
  'wall', 'wall-on-entity', 'wall-region-lines', 'wall-region-inside', 'wall-region-box', 'wall-from-perimeter',
  // columns & piers
  'column', 'column-region-lines', 'column-region-inside', 'column-region-box',
  'column-discrete-from-perimeter', 'column-from-perimeter', 'column-discrete-from-perimeter-walls',
  // beams
  'beam', 'beam-from-wall',
  // floors & openings
  'slab', 'slab-opening', 'opening',
  // foundation (last = «Εσχάρα από κάναβο» action)
  'foundation-pad', 'foundation-strip', 'foundation-tie-beam', 'foundation-strip-from-wall', 'foundation.actions.fromGrid',
  // circulation
  'stair', 'railing',
] as const;

function allButtons() {
  return STRUCTURAL_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}
function allCommands(): RibbonCommand[] {
  return allButtons().map((b) => b.command);
}

describe('ADR-443 — STRUCTURAL_TAB (permanent «Δομικά» tab)', () => {
  it('is a PERMANENT tab (id/label set, NOT contextual)', () => {
    expect(STRUCTURAL_TAB.id).toBe('structural');
    expect(STRUCTURAL_TAB.labelKey).toBe('ribbon.tabs.structural');
    expect(STRUCTURAL_TAB.isContextual).toBeUndefined();
    expect(STRUCTURAL_TAB.contextualTrigger).toBeUndefined();
  });

  it('declares the six Revit-style panels with canonical ids + label keys', () => {
    expect(STRUCTURAL_TAB.panels.map((p) => p.id)).toEqual([
      'structural-walls', 'structural-columns', 'structural-beams',
      'structural-floors', 'structural-foundation', 'structural-circulation',
    ]);
    expect(STRUCTURAL_TAB.panels.map((p) => p.labelKey)).toEqual([
      'ribbon.panels.structuralWalls', 'ribbon.panels.structuralColumns', 'ribbon.panels.structuralBeams',
      'ribbon.panels.structuralFloors', 'ribbon.panels.structuralFoundation', 'ribbon.panels.structuralCirculation',
    ]);
  });

  it('keeps ALL structural commandKeys present + unique (no tool lost vs draw.bim.group)', () => {
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
    for (const panel of STRUCTURAL_TAB.panels) {
      for (const row of panel.rows) {
        expect(row.isInFlyout).toBe(false);
      }
    }
  });

  it('routes every label through the i18n namespace, no comingSoon, non-empty icon (N.11)', () => {
    for (const command of allCommands()) {
      expect(command.labelKey).toMatch(/^ribbon\.commands\./);
      expect(command.comingSoon).toBeFalsy();
      expect(typeof command.icon).toBe('string');
      expect(command.icon).not.toBe('');
    }
  });

  it('keeps shortcuts unique across the panels', () => {
    const shortcuts = allCommands().map((c) => c.shortcut).filter((s): s is string => !!s);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
    expect(shortcuts).toEqual(expect.arrayContaining(['W', 'CL', 'BM', 'SL', 'SO', 'OP', 'FP', 'FS', 'ST', 'RL']));
  });

  it('wires the «Εσχάρα από κάναβο» one-shot as an action button, not a tool', () => {
    const fromGrid = allCommands().find((c) => c.commandKey === 'foundation.actions.fromGrid');
    expect(fromGrid?.action).toBe('foundation.actions.fromGrid');
  });
});
