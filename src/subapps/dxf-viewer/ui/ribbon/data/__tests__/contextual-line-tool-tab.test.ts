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

  // ADR-510 Φ3d — «Πλάτος» (polyline-only) lives in its OWN visibility-gated panel so it
  // self-hides for a selected plain LINE (where width is meaningless), mirroring the
  // line-only Geometry panel.
  it('isolates the polyline «Πλάτος» field into a widthApplicable-gated panel', () => {
    const panel = panelById('line-width');
    expect(panel?.visibilityKey).toBe(LINE_TOOL_PANEL_VISIBILITY_KEYS.widthApplicable);
    expect(buttonsOf('line-width').map((b) => b.command.id)).toEqual(['lineToolStyle.width']);
  });

  it('leaves the always-visible «Εμφάνιση Γραμμής» panel free of the polyline width field', () => {
    const appearanceKeys = buttonsOf('line-appearance').map((b) => b.command.commandKey);
    expect(appearanceKeys).not.toContain('lineToolStyle.width');
    // linetype / lineweight / scale (valid for a plain LINE) stay put; ADR-510 Φ2E #3
    // adds the «＋ Νέος τύπος» pattern-editor launcher as a trailing widget column.
    expect(appearanceKeys).toEqual([
      'lineToolStyle.linetype',
      'lineToolStyle.lineweight',
      'lineToolStyle.linetypeScale',
      'lineToolStyle.newLineType',
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
