/**
 * ADR-662 Φάση 1 — structural guards για το μόνιμο «Τοπογραφικό» ribbon tab.
 *
 * Robust invariants (ΟΧΙ hardcoded key list που παλιώνει): κάθε button είναι LARGE
 * simple, κάθε action key είναι `topo.*` με `action === commandKey`, τα tools είναι τα
 * ζωντανά ToolStateStore keys, και το tab είναι εγγεγραμμένο στα defaults + order.
 */

import { TOPOGRAPHY_TAB } from '../topography-tab';
import { DEFAULT_RIBBON_TABS, DEFAULT_RIBBON_TAB_ORDER } from '../ribbon-default-tabs';
import type { RibbonButton } from '../../types/ribbon-types';

/** Live ToolStateStore tools reused by the tab (toolBtn → onToolChange, no action). */
const TOOL_KEYS = new Set(['topo-breakline', 'topo-boundary']);

function allButtons(): RibbonButton[] {
  return TOPOGRAPHY_TAB.panels.flatMap((p) => p.rows.flatMap((r) => r.buttons));
}

describe('TOPOGRAPHY_TAB (ADR-662 Φάση 1)', () => {
  it('έχει το σωστό id + labelKey', () => {
    expect(TOPOGRAPHY_TAB.id).toBe('topography');
    expect(TOPOGRAPHY_TAB.labelKey).toBe('ribbon.tabs.topography');
  });

  it('έχει τα 6 panels της μετάβασης, με μοναδικά ids', () => {
    const ids = TOPOGRAPHY_TAB.panels.map((p) => p.id);
    expect(ids).toEqual([
      'topo-data', 'topo-surface', 'topo-georef',
      'topo-presentation', 'topo-analysis', 'topo-deliverables',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('κάθε button είναι LARGE simple (κανένα flyout/dropdown)', () => {
    for (const b of allButtons()) {
      expect(b.type).toBe('simple');
      expect(b.size).toBe('large');
    }
    for (const p of TOPOGRAPHY_TAB.panels)
      for (const r of p.rows) expect(r.isInFlyout).toBe(false);
  });

  it('τα action buttons είναι `topo.*` με action === commandKey· τα tools είναι ζωντανά keys', () => {
    for (const b of allButtons()) {
      const { commandKey, action } = b.command;
      if (action !== undefined) {
        expect(action).toBe(commandKey);
        expect(action.startsWith('topo.')).toBe(true);
      } else {
        expect(TOOL_KEYS.has(commandKey)).toBe(true);
      }
    }
  });

  it('όλα τα command ids είναι μοναδικά', () => {
    const ids = allButtons().map((b) => b.command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('είναι εγγεγραμμένο στα defaults + order (μετά τα ΗΛΜ, πριν το insert)', () => {
    expect(DEFAULT_RIBBON_TABS).toContain(TOPOGRAPHY_TAB);
    expect(DEFAULT_RIBBON_TAB_ORDER).toContain('topography');
    const topoIdx = DEFAULT_RIBBON_TAB_ORDER.indexOf('topography');
    expect(topoIdx).toBeGreaterThan(DEFAULT_RIBBON_TAB_ORDER.indexOf('fire-gas'));
    expect(topoIdx).toBeLessThan(DEFAULT_RIBBON_TAB_ORDER.indexOf('insert'));
  });
});
