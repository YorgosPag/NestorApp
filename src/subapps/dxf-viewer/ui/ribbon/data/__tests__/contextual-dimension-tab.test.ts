/**
 * ADR-362 Phase E2 — Tests for the contextual DIMENSION ribbon tab definition.
 *
 * Pure structural assertions on the static `RibbonTab`. No React, no DOM.
 *
 * Coverage:
 *   - Tab shape: isContextual, contextualTrigger, labelKey, 4 panels
 *   - Panel ids + labelKeys (SOS N.11 — ribbon.panels.dim* namespace)
 *   - Button count per panel
 *   - Style chooser is combobox type (industry pattern: AutoCAD/Revit)
 *   - Color override is color-swatch type
 *   - All commandKeys non-empty (or comingSoon: true for Phase E2 stubs)
 *   - Icon tokens non-empty on simple buttons
 *   - No hardcoded label strings — all via ribbon.* namespace (SOS N.11)
 *   - Trigger constant matches tab's contextualTrigger
 */

import {
  DIMENSION_CONTEXTUAL_TAB,
  DIMENSION_CONTEXTUAL_TRIGGER,
} from '../contextual-dimension-tab';

const PANEL_IDS = [
  'dim-style',
  'dim-override',
  'dim-text',
  'dim-modify',
  'dim-properties',
];
const PANEL_LABEL_KEYS = [
  'ribbon.panels.dimStyle',
  'ribbon.panels.dimOverride',
  'ribbon.panels.dimText',
  'ribbon.panels.dimModify',
  'ribbon.panels.dimProperties',
];

function collectAllButtons(tab: typeof DIMENSION_CONTEXTUAL_TAB) {
  return tab.panels.flatMap((panel) =>
    panel.rows.flatMap((row) => row.buttons),
  );
}

describe('ADR-362 Phase E2 — DIMENSION_CONTEXTUAL_TAB', () => {
  it('exports DIMENSION_CONTEXTUAL_TRIGGER = "dim-selected"', () => {
    expect(DIMENSION_CONTEXTUAL_TRIGGER).toBe('dim-selected');
  });

  it('declares tab with isContextual=true, correct trigger and labelKey', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.id).toBe('dimension');
    expect(DIMENSION_CONTEXTUAL_TAB.isContextual).toBe(true);
    expect(DIMENSION_CONTEXTUAL_TAB.contextualTrigger).toBe(DIMENSION_CONTEXTUAL_TRIGGER);
    expect(DIMENSION_CONTEXTUAL_TAB.labelKey).toBe('ribbon.tabs.dimension');
  });

  it('declares exactly 5 panels in the canonical order', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.panels).toHaveLength(5);
    expect(DIMENSION_CONTEXTUAL_TAB.panels.map((p) => p.id)).toEqual(PANEL_IDS);
  });

  it('assigns correct labelKeys to all 5 panels (ribbon.panels.dim* namespace)', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.panels.map((p) => p.labelKey)).toEqual(PANEL_LABEL_KEYS);
  });

  it('dim-style panel has 3 buttons across 2 rows (chooser + apply + edit)', () => {
    const panel = DIMENSION_CONTEXTUAL_TAB.panels[0];
    const buttons = panel.rows.flatMap((r) => r.buttons);
    expect(buttons).toHaveLength(3);
    expect(panel.rows).toHaveLength(2);
    expect(panel.rows[0].buttons).toHaveLength(1);
    expect(panel.rows[1].buttons).toHaveLength(2);
  });

  it('style chooser is a combobox with 3 preset DIMSTYLE options (E2 stubs)', () => {
    const chooser = DIMENSION_CONTEXTUAL_TAB.panels[0].rows[0].buttons[0];
    expect(chooser.type).toBe('combobox');
    expect(chooser.command.commandKey).toBe('dim.style.chooser');
    const options = chooser.command.options ?? [];
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  it('dim-override panel has 3 buttons across 2 rows', () => {
    const panel = DIMENSION_CONTEXTUAL_TAB.panels[1];
    const buttons = panel.rows.flatMap((r) => r.buttons);
    expect(buttons).toHaveLength(3);
    expect(panel.rows).toHaveLength(2);
  });

  it('color override is a color-swatch button', () => {
    const colorBtn = DIMENSION_CONTEXTUAL_TAB.panels[1].rows[0].buttons[0];
    expect(colorBtn.type).toBe('color-swatch');
    expect(colorBtn.command.commandKey).toBe('dim.override.color');
  });

  it('dim-text panel has 6 buttons across 4 rows (ADR-362 Phase G1 override + K3 tfill)', () => {
    const panel = DIMENSION_CONTEXTUAL_TAB.panels[2];
    const buttons = panel.rows.flatMap((r) => r.buttons);
    expect(buttons).toHaveLength(6);
    expect(panel.rows).toHaveLength(4);
  });

  it('dim-modify panel has 2 buttons in 1 row (ADR-362 Phase K — DIMBREAK + DIMSPACE)', () => {
    const panel = DIMENSION_CONTEXTUAL_TAB.panels[3];
    const buttons = panel.rows.flatMap((r) => r.buttons);
    expect(panel.id).toBe('dim-modify');
    expect(buttons).toHaveLength(2);
    expect(panel.rows).toHaveLength(1);
    expect(buttons.map((b) => b.command.commandKey)).toEqual([
      'dim.modify.dimBreak',
      'dim.modify.dimSpace',
    ]);
  });

  it('dim-properties panel has 3 buttons across 2 rows', () => {
    const panel = DIMENSION_CONTEXTUAL_TAB.panels[4];
    const buttons = panel.rows.flatMap((r) => r.buttons);
    expect(buttons).toHaveLength(3);
    expect(panel.rows).toHaveLength(2);
  });

  it('routes all labelKeys through the ribbon.* namespace (SOS N.11 — no hardcoded text)', () => {
    for (const btn of collectAllButtons(DIMENSION_CONTEXTUAL_TAB)) {
      expect(btn.command.labelKey).toMatch(/^ribbon\./);
    }
  });

  it('every commandKey is a non-empty string', () => {
    for (const btn of collectAllButtons(DIMENSION_CONTEXTUAL_TAB)) {
      expect(typeof btn.command.commandKey).toBe('string');
      expect((btn.command.commandKey as string).length).toBeGreaterThan(0);
    }
  });

  it('simple buttons with actions carry a non-empty icon token', () => {
    const simpleButtons = collectAllButtons(DIMENSION_CONTEXTUAL_TAB).filter(
      (b) => b.type === 'simple',
    );
    for (const btn of simpleButtons) {
      expect(typeof btn.command.icon).toBe('string');
      expect((btn.command.icon as string).length).toBeGreaterThan(0);
    }
  });

  it('action stubs are marked comingSoon: true (Phase F/G will remove this)', () => {
    const comingSoonKeys = [
      'dim.style.apply',
      'dim.style.edit',
      'dim.override.reset',
      'dim.text.resetPosition',
      'dim.properties.openPanel',
    ];
    const allButtons = collectAllButtons(DIMENSION_CONTEXTUAL_TAB);
    for (const key of comingSoonKeys) {
      const btn = allButtons.find((b) => b.command.commandKey === key);
      expect(btn).toBeDefined();
      expect(btn?.command.comingSoon).toBe(true);
    }
  });

  it('tab labelKey matches ribbon.tabs.dimension i18n key', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.labelKey).toBe('ribbon.tabs.dimension');
  });
});
