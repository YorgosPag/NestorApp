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
  // ADR-362 Round 36 — per-part visibility toggles panel.
  'dim-visibility',
  'dim-text',
  'dim-modify',
  'dim-properties',
  'dim-actions',
];
const PANEL_LABEL_KEYS = [
  'ribbon.panels.dimStyle',
  'ribbon.panels.dimLine',
  'ribbon.panels.dimExt',
  'ribbon.panels.dimArrow',
  'ribbon.panels.dimVisibility',
  'ribbon.panels.dimText',
  'ribbon.panels.dimModify',
  'ribbon.panels.dimProperties',
  'ribbon.panels.dimActions',
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

  it('declares exactly 9 panels in the canonical per-part order', () => {
    expect(DIMENSION_CONTEXTUAL_TAB.panels).toHaveLength(9);
    expect(DIMENSION_CONTEXTUAL_TAB.panels.map((p) => p.id)).toEqual(PANEL_IDS);
    expect(DIMENSION_CONTEXTUAL_TAB.panels.map((p) => p.labelKey)).toEqual(PANEL_LABEL_KEYS);
  });

  it('dim-style panel: chooser + apply/edit/reset stacked in one column (4 buttons, 1 row)', () => {
    // Giorgio 2026-07-07 — compacted to a single column: chooser on top, then
    // Apply / Edit / Reset stacked beneath it.
    const panel = panelById('dim-style');
    expect(panel.rows).toHaveLength(1);
    expect(panel.rows[0].buttons).toHaveLength(4);
    const chooser = panel.rows[0].buttons[0];
    expect(chooser.type).toBe('combobox');
    expect(chooser.command.commandKey).toBe('dim.style.chooser');
    expect((chooser.command.options ?? []).length).toBeGreaterThanOrEqual(3);
    // The 3 stacked actions keep their canonical order below the chooser.
    expect(panel.rows[0].buttons.slice(1).map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.style.applyStyle,
      DIM_RIBBON_KEYS.style.editStyle,
      DIM_RIBBON_KEYS.override.resetOverrides,
    ]);
  });

  // ── ADR-562 Φ4 per-part panels ────────────────────────────────────────────
  it('dim-line panel: color/weight/type/density comboboxes + new-pattern widget (ADR-362)', () => {
    const btns = buttonsOf('dim-line');
    // ADR-362 — density (dimltscale) + «Νέος τύπος» launcher added right of «Τύπος».
    expect(btns).toHaveLength(5);
    const comboKeys = btns.slice(0, 4);
    expect(comboKeys.every((b) => b.type === 'combobox')).toBe(true);
    expect(comboKeys.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.override.color,
      DIM_RIBBON_KEYS.override.lineWeight,
      DIM_RIBBON_KEYS.override.lineType,
      DIM_RIBBON_KEYS.override.lineTypeScale,
    ]);
    const widget = btns[4];
    expect(widget.type).toBe('widget');
    expect((widget as { widgetId?: string }).widgetId).toBe('dim-new-line-pattern');
    expect(widget.command.commandKey).toBe(DIM_RIBBON_KEYS.override.newLineType);
  });

  it('dim-line color is now the enterprise dxf-color picker (ADR-562 Φ6, not the broken color-swatch)', () => {
    const colorBtn = buttonsOf('dim-line')[0];
    expect(colorBtn.type).toBe('combobox');
    // Φ6 — hex/true-color picker variant; options are supplied by the picker, not statically.
    expect(colorBtn.command.comboboxVariant).toBe('dxf-color');
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

  it('dim-visibility panel: 5 toggle buttons stacked in one column (Giorgio 2026-07-07)', () => {
    const btns = buttonsOf('dim-visibility');
    // Giorgio 2026-07-07 — all five toggles in ONE column: left ext / dim line /
    // right ext, then the two markers stacked below «Δεξιά Βοηθητική».
    expect(btns.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.visibility.extLine1,
      DIM_RIBBON_KEYS.visibility.dimLine,
      DIM_RIBBON_KEYS.visibility.extLine2,
      DIM_RIBBON_KEYS.visibility.arrow1,
      DIM_RIBBON_KEYS.visibility.arrow2,
    ]);
    // All are on/off toggle controls (not comboboxes / actions).
    for (const b of btns) expect(b.type).toBe('toggle');
    expect(panelById('dim-visibility').rows).toHaveLength(1);
  });

  it('dim-text panel: 2 columns of 4 (Giorgio 2026-07-07 compaction — 8 buttons, 2 rows)', () => {
    const panel = panelById('dim-text');
    const btns = panel.rows.flatMap((r) => r.buttons);
    expect(btns).toHaveLength(8);
    expect(panel.rows).toHaveLength(2);
    // Column 1: color / font / height / position (top→bottom).
    expect(panel.rows[0].buttons.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.override.textColor,
      DIM_RIBBON_KEYS.override.textFont,
      DIM_RIBBON_KEYS.text.height,
      DIM_RIBBON_KEYS.text.position,
    ]);
    // Column 2: rotation / reset-position / text-override / mask (top→bottom).
    expect(panel.rows[1].buttons.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.text.rotation,
      DIM_RIBBON_KEYS.text.resetPosition,
      DIM_RIBBON_KEYS.text.override,
      DIM_RIBBON_KEYS.text.tfillToggle,
    ]);
  });

  it('dim-modify panel: DIMBREAK + DIMSPACE + Select-Row carry actions (not stubs)', () => {
    const btns = buttonsOf('dim-modify');
    expect(btns.map((b) => b.command.commandKey)).toEqual([
      'dim.modify.dimBreak',
      'dim.modify.dimSpace',
      'dim.select.row',
      // ADR-362 Round 35 — «Λαβές Μετακίνησης Σειρών» toggle widget.
      'dim.rowHandles.toggle',
    ]);
    // The 3 action buttons dispatch (action === commandKey); the row-handles entry
    // is a self-contained toggle widget (no action — flips the store directly).
    const actionBtns = btns.filter((b) => b.command.commandKey !== 'dim.rowHandles.toggle');
    for (const btn of actionBtns) {
      expect(btn.command.comingSoon).toBeFalsy();
      expect(btn.command.action).toBe(btn.command.commandKey);
    }
    const rowHandles = btns.find((b) => b.command.commandKey === 'dim.rowHandles.toggle');
    expect(rowHandles?.type).toBe('widget');
    expect((rowHandles as { widgetId?: string }).widgetId).toBe('dim-row-handles-toggle');
  });

  it('dim-properties panel: layer / annotation-scale / properties stacked in one column (3 buttons, 1 row)', () => {
    // Giorgio 2026-07-07 — «Ιδιότητες» stacked below «Κλίμακα Σχολιασμού».
    const panel = panelById('dim-properties');
    expect(panel.rows).toHaveLength(1);
    expect(panel.rows[0].buttons.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.properties.layer,
      DIM_RIBBON_KEYS.properties.annotationScale,
      DIM_RIBBON_KEYS.properties.openPanel,
    ]);
  });

  it('dim-actions panel: «Κλείσιμο» + «Διαγραφή», both wired (action === commandKey)', () => {
    const btns = buttonsOf('dim-actions');
    expect(btns.map((b) => b.command.commandKey)).toEqual([
      DIM_RIBBON_KEYS.actions.close,
      DIM_RIBBON_KEYS.actions.delete,
    ]);
    for (const btn of btns) {
      expect(btn.type).toBe('simple');
      expect(btn.command.action).toBe(btn.command.commandKey);
      expect(btn.command.comingSoon).toBeFalsy();
    }
    // Close carries the selection-arrow icon (mirror of «Ιδιότητες Κολώνας»).
    expect(btns[0].command.icon).toBe('select');
    expect(btns[1].command.icon).toBe('trash');
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
