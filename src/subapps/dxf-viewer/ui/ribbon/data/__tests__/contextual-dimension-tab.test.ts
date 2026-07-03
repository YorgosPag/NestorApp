/**
 * ADR-362 Phase E2 + ADR-562 Φ4 — Tests for the contextual DIMENSION ribbon tab.
 *
 * Pure structural assertions on the static `RibbonTab`. No React, no DOM.
 *
 * Φ4 reshape: the single «Παράκαμψη» stub panel became AutoCAD-grade PER-PART
 * panels (Γραμμή Διάστασης / Προεκτάσεις / Βελάκια), and the dim-line color went
 * from a (text-store-coupled, broken) `color-swatch` to a bridge-wired `combobox`.
 */

import {
  DIMENSION_CONTEXTUAL_TAB,
  DIMENSION_CONTEXTUAL_TRIGGER,
} from '../contextual-dimension-tab';
import { DIM_RIBBON_KEYS } from '../../hooks/bridge/dim-command-keys';

const PANEL_IDS = [
  'dim-style',
  'dim-line',
  'dim-ext',
  'dim-arrow',
  'dim-text',
  'dim-modify',
  'dim-properties',
];
const PANEL_LABEL_KEYS = [
  'ribbon.panels.dimStyle',
  'ribbon.panels.dimLine',
  'ribbon.panels.dimExt',
  'ribbon.panels.dimArrow',
  'ribbon.panels.dimText',
  'ribbon.panels.dimModify',
  'ribbon.panels.dimProperties',
];

function collectAllButtons(tab: typeof DIMENSION_CONTEXTUAL_TAB) {
  return tab.panels.flatMap((panel) =>
    panel.rows.flatMap((row) => row.buttons),
  );
}
function panelById(id: string) {
  return DIMENSION_CONTEXTUAL_TAB.panels.find((p) => p.id === id)!;
}
function buttonsOf(id: string) {
  return panelById(id).rows.flatMap((r) => r.buttons);
}

describe('ADR-562 Φ4 — DIMENSION_CONTEXTUAL_TAB', () => {
  it('exports DIMENSION_CONTEXTUAL_TRIGGER = "dim-selected"', () => {
    expect(DIMENSION_CONTEXTUAL_TRIGGER).toBe('dim-selected');
  });

  it('declares tab with isContextual=true, correct trigger and labelKey', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.id).toBe('dimension');
    expect(DIMENSION_CONTEXTUAL_TAB.isContextual).toBe(true);
    expect(DIMENSION_CONTEXTUAL_TAB.contextualTrigger).toBe(DIMENSION_CONTEXTUAL_TRIGGER);
    expect(DIMENSION_CONTEXTUAL_TAB.labelKey).toBe('ribbon.tabs.dimension');
  });

  it('declares exactly 7 panels in the canonical per-part order', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.panels).toHaveLength(7);
    expect(DIMENSION_CONTEXTUAL_TAB.panels.map((p) => p.id)).toEqual(PANEL_IDS);
    expect(DIMENSION_CONTEXTUAL_TAB.panels.map((p) => p.labelKey)).toEqual(PANEL_LABEL_KEYS);
  });

  it('dim-style panel: chooser + apply/edit/reset (4 buttons, 2 rows)', () => {
    const panel = panelById('dim-style');
    expect(panel.rows).toHaveLength(2);
    expect(panel.rows[0].buttons).toHaveLength(1);
    expect(panel.rows[1].buttons).toHaveLength(3);
    const chooser = panel.rows[0].buttons[0];
    expect(chooser.type).toBe('combobox');
    expect(chooser.command.commandKey).toBe('dim.style.chooser');
    expect((chooser.command.options ?? []).length).toBeGreaterThanOrEqual(3);
  });

  // ── ADR-562 Φ4 per-part panels ────────────────────────────────────────────
  it('dim-line panel wires 3 comboboxes → dimclrd / dimlwd / dimltype keys', () => {
    const btns = buttonsOf('dim-line');
    expect(btns).toHaveLength(3);
    expect(btns.every((b) => b.type === 'combobox')).toBe(true);
    expect(btns.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.override.color,
      DIM_RIBBON_KEYS.override.lineWeight,
      DIM_RIBBON_KEYS.override.lineType,
    ]);
  });

  it('dim-line color is now a bridge-wired combobox (not the broken color-swatch)', () => {
    const colorBtn = buttonsOf('dim-line')[0];
    expect(colorBtn.type).toBe('combobox');
    expect((colorBtn.command.options ?? []).length).toBeGreaterThan(1);
  });

  it('dim-ext panel wires 3 comboboxes → dimclre / dimlwe / dimltex keys', () => {
    expect(buttonsOf('dim-ext').map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.override.extColor,
      DIM_RIBBON_KEYS.override.extWeight,
      DIM_RIBBON_KEYS.override.extType,
    ]);
  });

  it('dim-arrow panel wires style / color / size; style options come from the bridge', () => {
    const btns = buttonsOf('dim-arrow');
    expect(btns.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.override.arrowStyle,
      DIM_RIBBON_KEYS.override.arrowColor,
      DIM_RIBBON_KEYS.override.arrowSize,
    ]);
    // Arrow-style + linetype options are empty in the tab → supplied live by the bridge.
    expect(btns[0].command.options ?? []).toEqual([]);
  });

  it('dim-text panel adds color + font and keeps height/position/rotation (8 buttons, 4 rows)', () => {
    const panel = panelById('dim-text');
    const btns = panel.rows.flatMap((r) => r.buttons);
    expect(btns).toHaveLength(8);
    expect(panel.rows).toHaveLength(4);
    expect(btns[0].command.commandKey).toBe(DIM_RIBBON_KEYS.override.textColor);
    expect(btns[1].command.commandKey).toBe(DIM_RIBBON_KEYS.override.textFont);
  });

  it('dim-modify panel: DIMBREAK + DIMSPACE + Select-Row carry actions (not stubs)', () => {
    const btns = buttonsOf('dim-modify');
    expect(btns.map((b) => b.command.commandKey)).toEqual([
      'dim.modify.dimBreak',
      'dim.modify.dimSpace',
      'dim.select.row',
    ]);
    for (const btn of btns) {
      expect(btn.command.comingSoon).toBeFalsy();
      expect(btn.command.action).toBe(btn.command.commandKey);
    }
  });

  it('dim-properties panel has 3 buttons across 2 rows', () => {
    const panel = panelById('dim-properties');
    expect(panel.rows.flatMap((r) => r.buttons)).toHaveLength(3);
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

  it('simple buttons carry a non-empty icon token', () => {
    for (const btn of collectAllButtons(DIMENSION_CONTEXTUAL_TAB).filter((b) => b.type === 'simple')) {
      expect(typeof btn.command.icon).toBe('string');
      expect((btn.command.icon as string).length).toBeGreaterThan(0);
    }
  });

  it('remaining action stubs are marked comingSoon: true', () => {
    // ADR-562 Φ5 — `dim.style.apply` is now LIVE (applies the primary dim's
    // DIMSTYLE to every selected dimension via `dim:apply-style-requested`).
    const comingSoonKeys = [
      'dim.style.edit',
      'dim.override.reset',
      'dim.text.resetPosition',
      'dim.properties.openPanel',
    ];
    const allButtons = collectAllButtons(DIMENSION_CONTEXTUAL_TAB);
    for (const key of comingSoonKeys) {
      const btn = allButtons.find((b) => b.command.commandKey === key);
      expect(btn?.command.comingSoon).toBe(true);
    }
  });

  it('dim.style.apply is wired (action set, not comingSoon)', () => {
    const btn = collectAllButtons(DIMENSION_CONTEXTUAL_TAB)
      .find((b) => b.command.commandKey === 'dim.style.apply');
    expect(btn?.command.comingSoon).toBeUndefined();
    expect(btn?.command.action).toBe('dim.style.apply');
  });
});
