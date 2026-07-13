/**
 * ADR-510 Φ4g — Tests for the «Στυλ Γραμμής» contextual tab reorganisation:
 *   - 5 LARGE modify tools (Trim · Extend · Offset · Fillet · Chamfer), left→right,
 *     in the leading «Τροποποίηση» panel, with the SAME command keys (zero rewire).
 *   - Zero-scroll: the FILLET radius and CHAMFER distance/angle numeric fields live
 *     in dedicated «Options Bar» panels gated by `visibilityKey` (active-tool-only),
 *     NOT crammed into the always-visible modify panel.
 */

import { CONTEXTUAL_LINE_TOOL_TAB, LINE_TOOL_CONTEXTUAL_TRIGGER } from '../contextual-line-tool-tab';
import { LINE_TOOL_PANEL_VISIBILITY_KEYS } from '../../hooks/bridge/line-tool-command-keys';

const panelById = (id: string) => CONTEXTUAL_LINE_TOOL_TAB.panels.find((p) => p.id === id);
const buttonsOf = (id: string) => panelById(id)?.rows.flatMap((r) => r.buttons) ?? [];

describe('ADR-510 Φ4g — CONTEXTUAL_LINE_TOOL_TAB modify reorg', () => {
  it('keeps the contextual tab metadata intact', () => {
    expect(CONTEXTUAL_LINE_TOOL_TAB.id).toBe('line-tool-style');
    expect(CONTEXTUAL_LINE_TOOL_TAB.isContextual).toBe(true);
    expect(CONTEXTUAL_LINE_TOOL_TAB.contextualTrigger).toBe(LINE_TOOL_CONTEXTUAL_TRIGGER);
  });

  it('leads with the «Γραμμή» draw panel, then «Τροποποίηση»', () => {
    expect(CONTEXTUAL_LINE_TOOL_TAB.panels[0]?.id).toBe('line-draw');
    expect(CONTEXTUAL_LINE_TOOL_TAB.panels[1]?.id).toBe('line-modify');
  });

  it('hosts the 3 line draw sub-modes (moved from the Home split) as LARGE buttons', () => {
    const buttons = buttonsOf('line-draw');
    expect(buttons.map((b) => b.command.commandKey)).toEqual([
      'line', 'line-perpendicular', 'line-parallel',
    ]);
    for (const button of buttons) {
      expect(button.type).toBe('simple');
      expect(button.size).toBe('large');
    }
  });

  it('hosts exactly 5 LARGE modify tools, left→right, with unchanged command keys', () => {
    const buttons = buttonsOf('line-modify');
    expect(buttons.map((b) => b.command.commandKey)).toEqual([
      'trim', 'extend', 'offset', 'fillet', 'chamfer',
    ]);
    for (const button of buttons) {
      expect(button.type).toBe('simple');
      expect(button.size).toBe('large');
      expect(button.command.icon).toBe(button.command.commandKey);
    }
  });

  it('moves the FILLET radius into an active-tool-gated «Options Bar» panel', () => {
    const panel = panelById('line-fillet-options');
    expect(panel?.visibilityKey).toBe(LINE_TOOL_PANEL_VISIBILITY_KEYS.filletOptions);
    expect(buttonsOf('line-fillet-options').map((b) => b.command.id)).toEqual([
      'lineModify.filletRadius',
    ]);
  });

  it('moves the CHAMFER distance/angle fields into an active-tool-gated «Options Bar» panel', () => {
    const panel = panelById('line-chamfer-options');
    expect(panel?.visibilityKey).toBe(LINE_TOOL_PANEL_VISIBILITY_KEYS.chamferOptions);
    expect(buttonsOf('line-chamfer-options').map((b) => b.command.id)).toEqual([
      'lineModify.chamferDist1', 'lineModify.chamferDist2', 'lineModify.chamferAngle',
    ]);
  });

  it('keeps the always-visible modify panel free of numeric fields (zero-scroll)', () => {
    for (const button of buttonsOf('line-modify')) {
      expect(button.type).not.toBe('combobox');
    }
  });

  // ADR-510 Φ2E #5 — the per-object «Γεωμετρία» + polyline «Πλάτος» panels MOVED to the
  // left Properties palette (Ribbon = tools + quick draw-defaults; palette = full object).
  it('no longer hosts the geometry / polyline-width panels (moved to the left palette)', () => {
    expect(panelById('line-geometry')).toBeUndefined();
    expect(panelById('line-width')).toBeUndefined();
  });

  it('slims «Εμφάνιση Γραμμής» to linetype + lineweight + «＋ Νέος τύπος» + «✎ Επεξεργασία» (scale moved to palette)', () => {
    const appearanceKeys = buttonsOf('line-appearance').map((b) => b.command.commandKey);
    // ADR-510 Φ2E #5 — «Κλίμακα» (linetypeScale) + «Πλάτος» (width) are palette-only now.
    expect(appearanceKeys).not.toContain('lineToolStyle.linetypeScale');
    expect(appearanceKeys).not.toContain('lineToolStyle.width');
    // ADR-642 — «✎ Επεξεργασία / ⧉ Διπλότυπο» launcher sits next to «Νέος τύπος».
    expect(appearanceKeys).toEqual([
      'lineToolStyle.linetype',
      'lineToolStyle.lineweight',
      'lineToolStyle.newLineType',
      'lineToolStyle.editLineType',
    ]);
  });

  // ADR-642 — the edit/duplicate launcher is a `line-edit-line-pattern` widget next to «Νέος τύπος».
  it('hosts the «✎ Επεξεργασία / ⧉ Διπλότυπο» launcher as a line-edit-line-pattern widget', () => {
    const widget = buttonsOf('line-appearance').find(
      (b) => b.command.id === 'lineToolStyle.editLineType',
    );
    expect(widget?.type).toBe('widget');
    expect((widget as { widgetId?: string }).widgetId).toBe('line-edit-line-pattern');
    expect(widget?.command.labelKey).toBe('ribbon.commands.lineEditLineType');
  });

  it('slims «Γενικά» to quick appearance only (transparency moved to palette)', () => {
    const generalKeys = buttonsOf('line-general').map((b) => b.command.commandKey);
    // ADR-510 Φ2E #5 — «Διαφάνεια» is palette-only now; style/color/layer stay as quick-set.
    expect(generalKeys).not.toContain('lineToolStyle.transparency');
    expect(generalKeys).toEqual([
      'lineToolStyle.lineStyle',
      'lineToolStyle.color',
      'lineToolStyle.layer',
    ]);
  });

  // ADR-510 Φ2E #3 — the «＋ Νέος τύπος» pattern-editor launcher lives on the
  // «Εμφάνιση Γραμμής» panel as a `widget` button (opens LinePatternEditorDialog,
  // assigns the created linetype to the selected line via the bridge).
  it('hosts the «＋ Νέος τύπος» pattern launcher as a line-new-line-pattern widget', () => {
    const widget = buttonsOf('line-appearance').find(
      (b) => b.command.id === 'lineToolStyle.newLineType',
    );
    expect(widget?.type).toBe('widget');
    expect((widget as { widgetId?: string }).widgetId).toBe('line-new-line-pattern');
    expect(widget?.command.labelKey).toBe('ribbon.commands.lineNewLineType');
  });
});
