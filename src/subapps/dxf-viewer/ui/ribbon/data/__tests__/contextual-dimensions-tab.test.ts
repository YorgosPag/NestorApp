/**
 * ADR-362 Phase E3 — Tests for the contextual «Διαστάσεις» CREATION tab.
 *
 * Mirrors the guides contextual tab: auto-opens on `dim-tool-active`, all tools
 * as LARGE buttons. Editing keeps its own `dim-selected` tab (not tested here).
 *
 * Coverage:
 *   - Contextual tab metadata (id / label / isContextual / trigger)
 *   - 4 panels (Linear / Radial-Angular / Centers / Αυτόματη), canonical ids + labels
 *   - ALL 15 dimension ToolType commandKeys present + unique (no tool lost)
 *   - The 2 auto keys (auto-dimension + auto-dim-cutline) moved here from Home
 *   - EVERY button LARGE simple, no flyout/dropdown
 *   - i18n labels in `ribbon.commands.dim*` / `.autoDimension*`; non-empty icons
 *   - Shortcut uniqueness (only Smart DIM = 'DIM')
 */

import {
  CONTEXTUAL_DIMENSIONS_TAB,
  DIMENSIONS_CONTEXTUAL_TRIGGER,
} from '../contextual-dimensions-tab';
import type { RibbonCommand } from '../../types/ribbon-types';

// The 15 dimension ToolType keys (creation tools; incl. `dim-entity` = «από οντότητα»).
const EXPECTED_TOOL_KEYS = [
  'dim-smart', 'dim-entity', 'dim-linear', 'dim-aligned', 'dim-baseline', 'dim-continued', 'dim-ordinate',
  'dim-radius', 'dim-diameter', 'dim-jogged-radius', 'dim-arc-length', 'dim-angular2L', 'dim-angular3P',
  'dim-center-mark', 'dim-centerline',
] as const;
// ADR-563 auto actions moved here from the Home launcher (2026-07-04).
const EXPECTED_AUTO_KEYS = ['auto-dimension', 'auto-dim-cutline'] as const;
// 2026-07-04 — «Κλείσιμο» action (mirror of «Ιδιότητες Κολώνας»); no «Διαγραφή» here.
const EXPECTED_ACTION_KEYS = ['dim.actions.close'] as const;
const EXPECTED_COMMAND_KEYS = [...EXPECTED_TOOL_KEYS, ...EXPECTED_AUTO_KEYS, ...EXPECTED_ACTION_KEYS] as const;

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

  it('declares the five Revit-style panels with canonical ids + label keys', () => {
    expect(CONTEXTUAL_DIMENSIONS_TAB.panels.map((p) => p.id)).toEqual([
      'dim-create-linear', 'dim-create-radial', 'dim-create-centers', 'dim-create-auto', 'dim-create-actions',
    ]);
    expect(CONTEXTUAL_DIMENSIONS_TAB.panels.map((p) => p.labelKey)).toEqual([
      'ribbon.panels.dimLinear', 'ribbon.panels.dimRadialAngular', 'ribbon.panels.dimCenters',
      'ribbon.panels.dimAuto', 'ribbon.panels.dimActions',
    ]);
  });

  it('keeps ALL 15 tool keys + 2 auto keys + the «Κλείσιμο» action, present + unique', () => {
    const keys = allCommands().map((c) => c.commandKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(keys)).toEqual(new Set(EXPECTED_COMMAND_KEYS));
    for (const k of EXPECTED_AUTO_KEYS) expect(keys).toContain(k);
    expect(keys).toContain('dim.actions.close');
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
      // Creation tools live under `ribbon.commands.dim*`; the moved auto actions
      // keep their existing `ribbon.commands.autoDimension*` keys (SSoT, no new keys).
      expect(command.labelKey).toMatch(/^ribbon\.commands\.(dim|autoDimension)/);
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
