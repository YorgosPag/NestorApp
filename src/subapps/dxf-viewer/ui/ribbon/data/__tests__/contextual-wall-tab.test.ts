/**
 * ADR-443 §wall-entry-split — Tests for the contextual «Ιδιότητες τοίχου» tab's
 * NEW `wall-tools` panel (Revit «Modify | Place Wall»).
 *
 * Τα εργαλεία σχεδίασης τοίχου μεταφέρθηκαν από το permanent «Δομικά» tab
 * (structural-tab.test.ts) εδώ, ως LARGE buttons στο πρώτο panel. Coverage:
 *   - Tab metadata intact (contextual + trigger)
 *   - `wall-tools` = πρώτο panel, canonical id + label key
 *   - Τα 6 εργαλεία παρόντα με τα ΙΔΙΑ command keys που έφυγαν από το permanent tab
 *   - 5 simple LARGE tool buttons + 1 LARGE split «από κάναβο» με 3 variants
 */

import { CONTEXTUAL_WALL_TAB, WALL_CONTEXTUAL_TRIGGER } from '../contextual-wall-tab';

const WALL_TOOLS_PANEL = CONTEXTUAL_WALL_TAB.panels.find((p) => p.id === 'wall-tools');
function wallToolButtons() {
  return WALL_TOOLS_PANEL?.rows.flatMap((r) => r.buttons) ?? [];
}

describe('ADR-443 §wall-entry-split — CONTEXTUAL_WALL_TAB wall-tools panel', () => {
  it('keeps the contextual tab metadata intact', () => {
    expect(CONTEXTUAL_WALL_TAB.id).toBe('wall-editor');
    expect(CONTEXTUAL_WALL_TAB.isContextual).toBe(true);
    expect(CONTEXTUAL_WALL_TAB.contextualTrigger).toBe(WALL_CONTEXTUAL_TRIGGER);
  });

  it('adds `wall-tools` as the FIRST panel (leftmost, before the Draw Options Bar)', () => {
    expect(CONTEXTUAL_WALL_TAB.panels[0]?.id).toBe('wall-tools');
    expect(WALL_TOOLS_PANEL?.labelKey).toBe('ribbon.panels.wallTools');
  });

  it('hosts exactly the 6 wall tools moved from the permanent «Δομικά» tab', () => {
    const keys = wallToolButtons().map((b) => b.command.commandKey);
    expect(keys).toEqual([
      'wall-on-entity',
      'wall-region-lines',
      'wall-region-inside',
      'wall-region-box',
      'wall-from-perimeter',
      'wall.actions.fromGrid',
    ]);
  });

  it('renders every wall tool as a LARGE button (5 simple tools + 1 «από κάναβο» split)', () => {
    for (const button of wallToolButtons()) {
      expect(button.size).toBe('large');
      const isGridSplit = button.command.commandKey === 'wall.actions.fromGrid';
      expect(button.type).toBe(isGridSplit ? 'split' : 'simple');
      if (!isGridSplit) expect(button.variants).toBeUndefined();
    }
    for (const row of WALL_TOOLS_PANEL?.rows ?? []) {
      expect(row.isInFlyout).toBe(false);
    }
  });

  it('wires «Τοίχοι από κάναβο» as a split with the 3 Wall-Location-Line variants', () => {
    const grid = wallToolButtons().find((b) => b.command.commandKey === 'wall.actions.fromGrid');
    expect(grid?.type).toBe('split');
    expect(grid?.variants?.map((v) => v.action)).toEqual([
      'wall.actions.fromGrid',
      'wall.actions.fromGridCenter',
      'wall.actions.fromGridOuter',
    ]);
  });

  it('routes every label through the i18n namespace + non-empty icon (N.11)', () => {
    for (const button of wallToolButtons()) {
      expect(button.command.labelKey).toMatch(/^ribbon\.commands\./);
      expect(typeof button.command.icon).toBe('string');
      expect(button.command.icon).not.toBe('');
    }
  });
});
